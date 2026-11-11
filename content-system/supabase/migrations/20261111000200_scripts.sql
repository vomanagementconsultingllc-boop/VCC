-- Build step 2: scripts, shot lists, shooting briefs, client comments.
--
-- A client only sees a script once the team has sent it. Drafts (stages
-- "research" and "scripted") are invisible to them, including while the team
-- is revising after a change request. Internal notes and research sources
-- live in script_internal, which clients can never read.

create type public.script_stage as enum (
  'research',          -- idea picked from research, not written yet
  'scripted',          -- being written or revised by the team
  'sent_to_client',    -- waiting for the client to approve
  'approved',          -- client approved (moves straight on to awaiting_footage)
  'awaiting_footage',  -- upload slots open
  'footage_received',  -- every shot uploaded and passed its checks
  'in_edit',           -- with an editor
  'review',            -- cut uploaded, waiting for the team to approve
  'delivered',         -- client has the finished video
  'posted'             -- client posted it; performance tracking open
);

create type public.video_format as enum ('talking_head', 'voiceover_broll', 'skit', 'listicle', 'reaction');
create type public.shot_orientation as enum ('portrait', 'landscape');

-- ---------------------------------------------------------------------------
-- Scripts. Everything in this table is safe for the owning client to read
-- once the script has been sent.
-- ---------------------------------------------------------------------------
create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  hook text not null default '',
  body text not null default '',
  format public.video_format not null default 'talking_head',
  stage public.script_stage not null default 'scripted',
  version integer not null default 1,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  client_approved boolean not null default false,
  client_approved_at timestamptz,
  sent_at timestamptz,
  footage_requested_at timestamptz,
  footage_received_at timestamptz,
  delivered_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets child tables use a composite foreign key, so a child row can never
  -- carry a client_id that differs from its script's.
  unique (id, client_id)
);
create index scripts_client_stage_idx on public.scripts (client_id, stage);
create index scripts_stage_idx on public.scripts (stage);

-- Team-only companion row: notes, where the idea came from, AI review state.
create table public.script_internal (
  script_id uuid primary key,
  client_id uuid not null references public.clients (id) on delete cascade,
  internal_notes text not null default '',
  style_notes text not null default '',
  hook_id uuid,
  source_research_item_id uuid,
  ai_drafted boolean not null default false,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  footage_reminders_sent integer not null default 0,
  last_reminder_at timestamptz,
  foreign key (script_id, client_id) references public.scripts (id, client_id) on delete cascade
);

-- One row per shot: it is the shot list, the per-shot shooting instructions,
-- and (from step 3) the upload slot.
create table public.shots (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  shot_number integer not null check (shot_number > 0),
  instruction text not null default '',
  lines text not null default '',
  framing text not null default '',
  orientation public.shot_orientation not null default 'portrait',
  min_duration_seconds integer not null default 5 check (min_duration_seconds >= 0),
  where_to_look text not null default '',
  lighting_notes text not null default '',
  foreign key (script_id, client_id) references public.scripts (id, client_id) on delete cascade,
  unique (script_id, shot_number) deferrable initially deferred,
  unique (id, client_id)
);

create table public.shooting_briefs (
  script_id uuid primary key,
  client_id uuid not null references public.clients (id) on delete cascade,
  reference_url text not null default '',
  notes text not null default '',
  due_date date,
  updated_at timestamptz not null default now(),
  foreign key (script_id, client_id) references public.scripts (id, client_id) on delete cascade
);

-- The thread the client and team share on a script.
create table public.script_comments (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  kind text not null default 'comment' check (kind in ('comment', 'change_request')),
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  foreign key (script_id, client_id) references public.scripts (id, client_id) on delete cascade
);
create index script_comments_script_idx on public.script_comments (script_id, created_at);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function private.scripts_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.script_internal (script_id, client_id) values (new.id, new.client_id)
  on conflict (script_id) do nothing;
  insert into public.shooting_briefs (script_id, client_id) values (new.id, new.client_id)
  on conflict (script_id) do nothing;
  return new;
end
$$;

create trigger scripts_companions after insert on public.scripts
  for each row execute function private.scripts_after_insert();

-- Guards and bookkeeping for every change to a script, whoever makes it.
create function private.scripts_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  internal public.script_internal%rowtype;
begin
  if new.client_id is distinct from old.client_id then
    raise exception 'a script cannot be moved to another client' using errcode = '23514';
  end if;

  if new.body is distinct from old.body or new.hook is distinct from old.hook then
    new.version := old.version + 1;
  end if;

  if new.stage is distinct from old.stage then
    if new.stage = 'sent_to_client' then
      if length(btrim(new.body)) = 0 then
        raise exception 'Write the script before sending it to the client.' using errcode = '23514';
      end if;
      if not exists (select 1 from public.shots s where s.script_id = new.id) then
        raise exception 'Add at least one shot before sending the script to the client.' using errcode = '23514';
      end if;
      -- Never ship an unreviewed AI draft.
      select * into internal from public.script_internal i where i.script_id = new.id;
      if internal.ai_drafted and internal.reviewed_at is null then
        raise exception 'This script was drafted by AI and has not been reviewed by the team yet.' using errcode = '23514';
      end if;
      new.sent_at := now();
      new.client_approved := false;
      new.client_approved_at := null;
    elsif new.stage = 'awaiting_footage' and old.stage in ('sent_to_client', 'approved') then
      new.footage_requested_at := now();
    elsif new.stage = 'footage_received' then
      new.footage_received_at := now();
    elsif new.stage = 'delivered' then
      new.delivered_at := now();
    elsif new.stage = 'posted' then
      new.posted_at := coalesce(new.posted_at, now());
    end if;
  end if;

  new.updated_at := now();
  return new;
end
$$;

create trigger scripts_guard before update on public.scripts
  for each row execute function private.scripts_before_update();

create trigger shooting_briefs_touch before update on public.shooting_briefs
  for each row execute function private.touch_updated_at();

create trigger scripts_audit after insert or update or delete on public.scripts
  for each row execute function private.audit_row();
create trigger script_internal_audit after insert or update or delete on public.script_internal
  for each row execute function private.audit_row();
create trigger shots_audit after insert or update or delete on public.shots
  for each row execute function private.audit_row();
create trigger shooting_briefs_audit after insert or update or delete on public.shooting_briefs
  for each row execute function private.audit_row();
create trigger script_comments_audit after insert or update or delete on public.script_comments
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create function private.stage_visible_to_client(p_stage public.script_stage) returns boolean
language sql immutable set search_path = '' as $$
  select p_stage not in ('research', 'scripted')
$$;

-- True when the caller is a client user who owns this script and it has been sent.
create function private.client_can_see_script(p_script_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.scripts s
    where s.id = p_script_id
      and s.client_id = (select private.user_client_id())
      and private.stage_visible_to_client(s.stage)
  )
$$;

-- ---------------------------------------------------------------------------
-- Client actions. Clients have no UPDATE rights on scripts at all; these
-- functions are the only way they can change one, and each does one thing.
-- ---------------------------------------------------------------------------
create function public.client_approve_script(p_script_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.scripts%rowtype;
begin
  select * into s from public.scripts where id = p_script_id for update;
  if not found
     or (select private.user_role()) is distinct from 'client'
     or s.client_id is distinct from (select private.user_client_id()) then
    raise exception 'script not found' using errcode = '42501';
  end if;
  if s.stage <> 'sent_to_client' then
    raise exception 'This script is not waiting for approval.' using errcode = '23514';
  end if;

  update public.scripts
     set client_approved = true, client_approved_at = now(), stage = 'approved'
   where id = p_script_id;
  -- Approval opens the upload slots straight away.
  update public.scripts set stage = 'awaiting_footage' where id = p_script_id;
end
$$;

create function public.client_request_changes(p_script_id uuid, p_comment text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.scripts%rowtype;
begin
  select * into s from public.scripts where id = p_script_id for update;
  if not found
     or (select private.user_role()) is distinct from 'client'
     or s.client_id is distinct from (select private.user_client_id()) then
    raise exception 'script not found' using errcode = '42501';
  end if;
  if s.stage <> 'sent_to_client' then
    raise exception 'This script is not waiting for approval.' using errcode = '23514';
  end if;
  if p_comment is null or length(btrim(p_comment)) = 0 then
    raise exception 'Tell us what you would like changed.' using errcode = '23514';
  end if;

  insert into public.script_comments (script_id, client_id, author_id, kind, body)
  values (s.id, s.client_id, (select auth.uid()), 'change_request', btrim(p_comment));
  update public.scripts set stage = 'scripted', client_approved = false, client_approved_at = null
   where id = p_script_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.scripts enable row level security;
alter table public.script_internal enable row level security;
alter table public.shots enable row level security;
alter table public.shooting_briefs enable row level security;
alter table public.script_comments enable row level security;

create policy scripts_staff_all on public.scripts for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy scripts_client_select on public.scripts for select to authenticated
  using (client_id = (select private.user_client_id()) and private.stage_visible_to_client(stage));

create policy script_internal_staff_all on public.script_internal for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy shots_staff_all on public.shots for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy shots_client_select on public.shots for select to authenticated
  using (client_id = (select private.user_client_id()) and private.client_can_see_script(script_id));

create policy shooting_briefs_staff_all on public.shooting_briefs for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy shooting_briefs_client_select on public.shooting_briefs for select to authenticated
  using (client_id = (select private.user_client_id()) and private.client_can_see_script(script_id));

create policy script_comments_staff_all on public.script_comments for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy script_comments_client_select on public.script_comments for select to authenticated
  using (client_id = (select private.user_client_id()) and private.client_can_see_script(script_id));
create policy script_comments_client_insert on public.script_comments for insert to authenticated
  with check (
    client_id = (select private.user_client_id())
    and author_id = (select auth.uid())
    and kind = 'comment'
    and private.client_can_see_script(script_id)
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on public.scripts, public.script_internal, public.shots, public.shooting_briefs, public.script_comments from anon;
grant select, insert, update, delete on
  public.scripts, public.script_internal, public.shots, public.shooting_briefs, public.script_comments
  to authenticated;
grant all on public.scripts, public.script_internal, public.shots, public.shooting_briefs, public.script_comments to service_role;

revoke all on all functions in schema private from anon, public;
grant execute on all functions in schema private to authenticated, service_role;

revoke all on function public.client_approve_script(uuid) from anon, public;
revoke all on function public.client_request_changes(uuid, text) from anon, public;
grant execute on function public.client_approve_script(uuid) to authenticated, service_role;
grant execute on function public.client_request_changes(uuid, text) to authenticated, service_role;
