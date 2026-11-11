-- Build step 1: roles, profiles, clients, voice profiles, audit log.
--
-- Access model (enforced here, not in app code):
--   admin  : everything
--   team   : clients, research, scripts, pipeline. No billing, settings or audit log.
--   editor : only jobs assigned to them (added in the editing migration)
--   client : only rows carrying their own client_id
--
-- Every client-scoped table has a client_id column and RLS enabled.
-- Helper functions live in the `private` schema, which the Data API does not expose.

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'team', 'editor', 'client');
create type public.client_status as enum ('onboarding', 'active', 'paused', 'offboarded');

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business text not null default '',
  niche_tags text[] not null default '{}',
  platforms text[] not null default '{}',
  posting_cadence text not null default '',
  posting_days text[] not null default '{}',
  login_contact text not null default '',
  status public.client_status not null default 'onboarding',
  assigned_team_member uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, carrying the app role.
-- A client user is tied to exactly one client; everyone else has no client_id.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  client_id uuid references public.clients (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint profiles_client_role_has_client check ((role = 'client') = (client_id is not null))
);
create index profiles_client_id_idx on public.profiles (client_id);

alter table public.clients
  add constraint clients_assigned_team_member_fkey
  foreign key (assigned_team_member) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so policies can read the caller's profile
-- without recursing through the profiles policies.
-- ---------------------------------------------------------------------------
create function private.user_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

create function private.user_client_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.client_id from public.profiles p where p.id = (select auth.uid())
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())), false)
$$;

-- "Staff" means admin or team member: the people who run the pipeline.
create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role in ('admin', 'team') from public.profiles p where p.id = (select auth.uid())), false)
$$;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger clients_touch before update on public.clients
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log: who did what and when, for every record touching client data.
-- Stores which columns changed, never the values, so the log itself does not
-- become a second copy of client data. No FK to clients: the record that a
-- client was deleted has to outlive the client.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_role text,
  client_id uuid,
  table_name text not null,
  record_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb
);
create index audit_log_client_idx on public.audit_log (client_id, at desc);
create index audit_log_at_idx on public.audit_log (at desc);

create function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb;
  changed text[] := '{}';
  k text;
begin
  if tg_op = 'DELETE' then
    rec := to_jsonb(old);
  else
    rec := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    for k in select key from jsonb_each(to_jsonb(new)) loop
      if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) and k <> 'updated_at' then
        changed := changed || k;
      end if;
    end loop;
    if cardinality(changed) = 0 then
      return new;
    end if;
  end if;

  insert into public.audit_log (actor_id, actor_role, client_id, table_name, record_id, action, details)
  values (
    (select auth.uid()),
    coalesce((select private.user_role())::text, current_setting('role', true)),
    case when tg_table_name = 'clients' then (rec ->> 'id')::uuid else (rec ->> 'client_id')::uuid end,
    tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'client_id'),
    lower(tg_op),
    case when tg_op = 'UPDATE' then jsonb_build_object('changed', to_jsonb(changed)) else '{}'::jsonb end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

-- Lets the app record events that are not row changes (a signed URL issued,
-- an export run, a login). The actor is always the caller.
create function public.log_event(p_client_id uuid, p_table text, p_record_id text, p_action text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  -- A client can only log events against their own client.
  if not (select private.is_staff())
     and (select private.user_role()) = 'client'
     and p_client_id is distinct from (select private.user_client_id()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, actor_role, client_id, table_name, record_id, action, details)
  values ((select auth.uid()), (select private.user_role())::text, p_client_id, p_table, p_record_id, p_action, coalesce(p_details, '{}'::jsonb));
end
$$;

create trigger clients_audit after insert or update or delete on public.clients
  for each row execute function private.audit_row();
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Voice profile: one per client. Staff only. Editors never see it, and the
-- client sees a curated summary through my_voice_summary() rather than the
-- team's working notes.
-- ---------------------------------------------------------------------------
create table public.voice_profiles (
  client_id uuid primary key references public.clients (id) on delete cascade,
  intake_answers jsonb not null default '{}'::jsonb,
  interview_transcript text not null default '',
  interview_source text not null default '',
  phrases_use text[] not null default '{}',
  phrases_never text[] not null default '{}',
  tone_notes text not null default '',
  topics_avoid text[] not null default '{}',
  example_posts jsonb not null default '[]'::jsonb,
  offer text not null default '',
  audience text not null default '',
  summary text not null default '',
  summary_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger voice_profiles_touch before update on public.voice_profiles
  for each row execute function private.touch_updated_at();
create trigger voice_profiles_audit after insert or update or delete on public.voice_profiles
  for each row execute function private.audit_row();

-- What the client is allowed to see of their own voice profile.
create function public.my_voice_summary()
returns table (summary text, phrases_use text[], phrases_never text[], topics_avoid text[], offer text, audience text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select v.summary, v.phrases_use, v.phrases_never, v.topics_avoid, v.offer, v.audience, v.updated_at
  from public.voice_profiles v
  where v.client_id = (select private.user_client_id())
$$;

-- Corrections a client sends back after reading "how we heard you".
create table public.voice_corrections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);
create index voice_corrections_client_idx on public.voice_corrections (client_id, created_at desc);

create trigger voice_corrections_audit after insert or update or delete on public.voice_corrections
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Internal notes about a client. Staff only; clients never see these.
-- ---------------------------------------------------------------------------
create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index client_notes_client_idx on public.client_notes (client_id, created_at desc);

create trigger client_notes_audit after insert or update or delete on public.client_notes
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Admin-only: money and settings. Team members have no access.
-- ---------------------------------------------------------------------------
create table public.client_financials (
  client_id uuid primary key references public.clients (id) on delete cascade,
  price_per_video_cents integer not null default 0 check (price_per_video_cents >= 0),
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create trigger client_financials_touch before update on public.client_financials
  for each row execute function private.touch_updated_at();
create trigger client_financials_audit after insert or update or delete on public.client_financials
  for each row execute function private.audit_row();

-- Single-row settings table. revision_allowance stays null until Nathan
-- decides it (see "Open decisions" in the spec).
create table public.app_settings (
  id boolean primary key default true check (id),
  revision_allowance integer check (revision_allowance >= 0),
  default_edit_cost_cents integer not null default 2000 check (default_edit_cost_cents >= 0),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (true);

create trigger app_settings_touch before update on public.app_settings
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;
alter table public.voice_profiles enable row level security;
alter table public.voice_corrections enable row level security;
alter table public.client_notes enable row level security;
alter table public.client_financials enable row level security;
alter table public.app_settings enable row level security;

-- clients
create policy clients_staff_select on public.clients for select to authenticated
  using ((select private.is_staff()));
create policy clients_own_select on public.clients for select to authenticated
  using (id = (select private.user_client_id()));
create policy clients_staff_insert on public.clients for insert to authenticated
  with check ((select private.is_staff()));
create policy clients_staff_update on public.clients for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy clients_admin_delete on public.clients for delete to authenticated
  using ((select private.is_admin()));

-- profiles: you see yourself; staff see everyone (to assign work).
-- Nobody changes a role through the Data API: only name and notification
-- preferences are updatable, and only on your own row. Users are created and
-- roles assigned server-side with the service role.
create policy profiles_self_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_staff_select on public.profiles for select to authenticated
  using ((select private.is_staff()));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- audit log: admin reads; rows are only ever written by triggers and log_event().
create policy audit_admin_select on public.audit_log for select to authenticated
  using ((select private.is_admin()));

-- voice profiles: staff only.
create policy voice_profiles_staff_all on public.voice_profiles for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- voice corrections: client writes and reads their own; staff handle them.
create policy voice_corrections_staff_all on public.voice_corrections for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy voice_corrections_own_select on public.voice_corrections for select to authenticated
  using (client_id = (select private.user_client_id()));
create policy voice_corrections_own_insert on public.voice_corrections for insert to authenticated
  with check (client_id = (select private.user_client_id()) and created_by = (select auth.uid()) and resolved_at is null);

-- client notes: staff only.
create policy client_notes_staff_all on public.client_notes for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- financials: admin only.
create policy client_financials_admin_all on public.client_financials for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- settings: staff read, admin write.
create policy app_settings_staff_select on public.app_settings for select to authenticated
  using ((select private.is_staff()));
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Grants. Signed-out visitors (anon) get nothing at all. Signed-in users get
-- table access that the policies above then narrow row by row.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
revoke all on all functions in schema private from anon, public;

grant select, insert, update, delete on
  public.clients, public.voice_profiles, public.voice_corrections,
  public.client_notes, public.client_financials
  to authenticated;
grant select on public.audit_log, public.app_settings to authenticated;
grant update (revision_allowance, default_edit_cost_cents) on public.app_settings to authenticated;

revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, notification_prefs) on public.profiles to authenticated;

revoke insert, update, delete on public.audit_log from authenticated;

grant execute on all functions in schema private to authenticated, service_role;
grant execute on function public.log_event(uuid, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.my_voice_summary() to authenticated, service_role;

grant all on all tables in schema public to service_role;
