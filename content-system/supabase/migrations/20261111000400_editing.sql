-- Build step 4: edit jobs, revision threads, deliverables.
--
-- An editor (a person, or a Claude session holding an access key for an
-- editor seat) sees only the jobs assigned to them, and through those jobs
-- only that script's words, shots and raw clips. They never see clients,
-- voice profiles, pricing, or anyone else's jobs. Access to a job's footage
-- ends when the job is done.

create type public.job_status as enum ('queued', 'in_progress', 'submitted', 'revision', 'done');

create table public.edit_jobs (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null unique,
  client_id uuid not null references public.clients (id) on delete cascade,
  editor_id uuid references public.profiles (id) on delete set null,
  status public.job_status not null default 'queued',
  -- The editor cannot read the clients table, so the job carries a label.
  client_label text not null default '',
  style_notes text not null default '',
  deliverable_path text,
  deliverable_alt_path text,
  editor_notes text not null default '',
  revision_count integer not null default 0 check (revision_count >= 0),
  due_date date,
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (script_id, client_id) references public.scripts (id, client_id) on delete cascade,
  unique (id, client_id)
);
create index edit_jobs_editor_idx on public.edit_jobs (editor_id, status);
create index edit_jobs_client_idx on public.edit_jobs (client_id);

-- What each edit costs. Admin only, so margins stay out of the team's view.
create table public.edit_job_costs (
  job_id uuid primary key,
  client_id uuid not null references public.clients (id) on delete cascade,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  updated_at timestamptz not null default now(),
  foreign key (job_id, client_id) references public.edit_jobs (id, client_id) on delete cascade
);

-- Notes, submissions and revision requests, threaded on the job.
create table public.job_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  kind text not null default 'note' check (kind in ('note', 'submission', 'revision_request', 'approval')),
  body text not null default '',
  created_at timestamptz not null default now(),
  foreign key (job_id, client_id) references public.edit_jobs (id, client_id) on delete cascade
);
create index job_messages_job_idx on public.job_messages (job_id, created_at);

-- The finished video as the client receives it. A row only exists once the
-- team has approved a cut, so clients can never see work in progress.
create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  edit_job_id uuid not null unique,
  script_id uuid not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  file_path text not null,
  alt_file_path text,
  caption_draft text not null default '',
  delivered_at timestamptz not null default now(),
  client_downloaded_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  foreign key (edit_job_id, client_id) references public.edit_jobs (id, client_id) on delete cascade,
  foreign key (script_id, client_id) references public.scripts (id, client_id) on delete cascade,
  unique (id, client_id)
);
create index deliverables_client_idx on public.deliverables (client_id, delivered_at desc);

-- Access keys for editor seats, so a Claude session can act as an editor
-- through the API. Only a hash is stored; the key is shown once on creation.
create table public.editor_access_keys (
  id uuid primary key default gen_random_uuid(),
  editor_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default '',
  key_hash text not null unique,
  key_prefix text not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index editor_access_keys_editor_idx on public.editor_access_keys (editor_id);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create function private.is_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'editor' from public.profiles p where p.id = (select auth.uid())), false)
$$;

-- The caller is the editor on this job (any status: they keep their history).
create function private.editor_on_job(p_job_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.edit_jobs j
    where j.id = p_job_id and j.editor_id = (select auth.uid())
  )
$$;

-- The caller is the editor on a job for this script that is still open.
create function private.editor_has_script(p_script_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.edit_jobs j
    where j.script_id = p_script_id and j.editor_id = (select auth.uid()) and j.status <> 'done'
  )
$$;

create function private.is_uuid(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

-- footage/{client}/{script}/{shot}/{file}: readable by the editor on that script's open job.
create function private.editor_can_read_footage_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[] := string_to_array(p_name, '/');
begin
  if array_length(parts, 1) is distinct from 4 or not private.is_uuid(parts[1]) or not private.is_uuid(parts[2]) then
    return false;
  end if;
  return exists (
    select 1 from public.edit_jobs j
    where j.script_id = parts[2]::uuid and j.client_id = parts[1]::uuid
      and j.editor_id = (select auth.uid()) and j.status <> 'done'
  );
end
$$;

-- deliverables/{client}/{job}/{file}: the editor on that open job may write and read it.
create function private.editor_can_use_deliverable_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[] := string_to_array(p_name, '/');
begin
  if array_length(parts, 1) is distinct from 3 or not private.is_uuid(parts[1]) or not private.is_uuid(parts[2]) then
    return false;
  end if;
  return exists (
    select 1 from public.edit_jobs j
    where j.id = parts[2]::uuid and j.client_id = parts[1]::uuid
      and j.editor_id = (select auth.uid()) and j.status <> 'done'
  );
end
$$;

-- A client may read a file in the deliverables bucket only once it has been
-- delivered to them: unapproved cuts sit in the same bucket and stay hidden.
create function private.client_can_read_deliverable_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.deliverables d
    where d.client_id = (select private.user_client_id())
      and (d.file_path = p_name or d.alt_file_path = p_name)
  )
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function private.edit_jobs_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.editor_id is not null
     and (tg_op = 'INSERT' or new.editor_id is distinct from old.editor_id)
     and not exists (select 1 from public.profiles p where p.id = new.editor_id and p.role = 'editor') then
    raise exception 'Jobs can only be assigned to an editor.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.script_id is distinct from old.script_id or new.client_id is distinct from old.client_id then
      raise exception 'a job cannot be moved to another script' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;
  return new;
end
$$;

create trigger edit_jobs_guard before insert or update on public.edit_jobs
  for each row execute function private.edit_jobs_guard();

-- Each new job gets a cost row pre-filled from settings (about $20 a video).
create function private.edit_jobs_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.edit_job_costs (job_id, client_id, cost_cents)
  values (new.id, new.client_id, coalesce((select s.default_edit_cost_cents from public.app_settings s limit 1), 0))
  on conflict (job_id) do nothing;
  return new;
end
$$;

create trigger edit_jobs_cost after insert on public.edit_jobs
  for each row execute function private.edit_jobs_after_insert();

create trigger edit_job_costs_touch before update on public.edit_job_costs
  for each row execute function private.touch_updated_at();

create trigger edit_jobs_audit after insert or update or delete on public.edit_jobs
  for each row execute function private.audit_row();
create trigger edit_job_costs_audit after insert or update or delete on public.edit_job_costs
  for each row execute function private.audit_row();
create trigger job_messages_audit after insert or update or delete on public.job_messages
  for each row execute function private.audit_row();
create trigger deliverables_audit after insert or update or delete on public.deliverables
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Team actions
-- ---------------------------------------------------------------------------
create function public.create_edit_job(p_script_id uuid, p_editor_id uuid, p_due_date date)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.scripts%rowtype;
  v_job uuid;
begin
  if not (select private.is_staff()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into s from public.scripts where id = p_script_id for update;
  if not found then
    raise exception 'script not found' using errcode = '42501';
  end if;
  if s.stage <> 'footage_received' then
    raise exception 'An edit job can be created once all the footage is in and checked.' using errcode = '23514';
  end if;

  insert into public.edit_jobs (script_id, client_id, editor_id, due_date, client_label, style_notes)
  values (
    s.id, s.client_id, p_editor_id, p_due_date,
    (select coalesce(nullif(c.business, ''), c.name) from public.clients c where c.id = s.client_id),
    coalesce((select i.style_notes from public.script_internal i where i.script_id = s.id), '')
  )
  returning id into v_job;

  update public.scripts set stage = 'in_edit' where id = s.id;
  return v_job;
end
$$;

create function public.request_revision(p_job_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  j public.edit_jobs%rowtype;
begin
  if not (select private.is_staff()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into j from public.edit_jobs where id = p_job_id for update;
  if not found then
    raise exception 'job not found' using errcode = '42501';
  end if;
  if j.status <> 'submitted' then
    raise exception 'A revision can be requested once a cut has been submitted.' using errcode = '23514';
  end if;
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'Say what needs to change.' using errcode = '23514';
  end if;

  update public.edit_jobs set status = 'revision', revision_count = revision_count + 1 where id = j.id;
  insert into public.job_messages (job_id, client_id, author_id, kind, body)
  values (j.id, j.client_id, (select auth.uid()), 'revision_request', btrim(p_note));
  update public.scripts set stage = 'in_edit' where id = j.script_id and stage = 'review';
end
$$;

-- Approving a cut is what delivers it: the deliverable row appears, the
-- client can now read that one file, and the script moves to "delivered".
create function public.approve_cut(p_job_id uuid, p_caption text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  j public.edit_jobs%rowtype;
  v_deliverable uuid;
begin
  if not (select private.is_staff()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into j from public.edit_jobs where id = p_job_id for update;
  if not found then
    raise exception 'job not found' using errcode = '42501';
  end if;
  if j.status <> 'submitted' or j.deliverable_path is null then
    raise exception 'There is no submitted cut to approve.' using errcode = '23514';
  end if;

  update public.edit_jobs set status = 'done', completed_at = now() where id = j.id;
  insert into public.deliverables (edit_job_id, script_id, client_id, file_path, alt_file_path, caption_draft, created_by)
  values (j.id, j.script_id, j.client_id, j.deliverable_path, j.deliverable_alt_path, coalesce(p_caption, ''), (select auth.uid()))
  returning id into v_deliverable;
  insert into public.job_messages (job_id, client_id, author_id, kind, body)
  values (j.id, j.client_id, (select auth.uid()), 'approval', 'Approved and delivered to the client.');
  update public.scripts set stage = 'delivered' where id = j.script_id;
  return v_deliverable;
end
$$;

-- ---------------------------------------------------------------------------
-- Editor actions. Editors have no UPDATE rights on jobs; these two functions
-- are all they can do to one.
-- ---------------------------------------------------------------------------
create function public.editor_start_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  j public.edit_jobs%rowtype;
begin
  select * into j from public.edit_jobs where id = p_job_id for update;
  if not found or j.editor_id is distinct from (select auth.uid()) then
    raise exception 'job not found' using errcode = '42501';
  end if;
  if j.status not in ('queued', 'revision') then
    raise exception 'This job cannot be started from its current status.' using errcode = '23514';
  end if;
  update public.edit_jobs set status = 'in_progress', started_at = coalesce(started_at, now()) where id = j.id;
end
$$;

create function public.editor_submit_cut(p_job_id uuid, p_path text, p_alt_path text, p_notes text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  j public.edit_jobs%rowtype;
  v_prefix text;
begin
  select * into j from public.edit_jobs where id = p_job_id for update;
  if not found or j.editor_id is distinct from (select auth.uid()) then
    raise exception 'job not found' using errcode = '42501';
  end if;
  if j.status not in ('queued', 'in_progress', 'revision') then
    raise exception 'This job is not open for a new cut.' using errcode = '23514';
  end if;

  v_prefix := j.client_id::text || '/' || j.id::text || '/';
  if p_path is null or left(p_path, length(v_prefix)) <> v_prefix
     or not exists (select 1 from storage.objects o where o.bucket_id = 'deliverables' and o.name = p_path) then
    raise exception 'Upload the finished cut before submitting.' using errcode = '23514';
  end if;
  if p_alt_path is not null and (
       left(p_alt_path, length(v_prefix)) <> v_prefix
       or not exists (select 1 from storage.objects o where o.bucket_id = 'deliverables' and o.name = p_alt_path)) then
    raise exception 'The second version has not finished uploading.' using errcode = '23514';
  end if;

  update public.edit_jobs
     set status = 'submitted', submitted_at = now(), started_at = coalesce(started_at, now()),
         deliverable_path = p_path, deliverable_alt_path = p_alt_path, editor_notes = coalesce(p_notes, '')
   where id = j.id;
  insert into public.job_messages (job_id, client_id, author_id, kind, body)
  values (j.id, j.client_id, (select auth.uid()), 'submission', coalesce(btrim(p_notes), ''));
  update public.scripts set stage = 'review' where id = j.script_id and stage = 'in_edit';
end
$$;

-- ---------------------------------------------------------------------------
-- Client action
-- ---------------------------------------------------------------------------
create function public.client_mark_downloaded(p_deliverable_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.deliverables
     set client_downloaded_at = coalesce(client_downloaded_at, now())
   where id = p_deliverable_id and client_id = (select private.user_client_id());
  if not found then
    raise exception 'video not found' using errcode = '42501';
  end if;
end
$$;

-- Editors may only write audit events for clients they have an open job with.
create or replace function public.log_event(p_client_id uuid, p_table text, p_record_id text, p_action text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.app_role := (select private.user_role());
begin
  if (select auth.uid()) is null or v_role is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if v_role = 'client' and p_client_id is distinct from (select private.user_client_id()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_role = 'editor' and not exists (
       select 1 from public.edit_jobs j where j.client_id = p_client_id and j.editor_id = (select auth.uid())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, actor_role, client_id, table_name, record_id, action, details)
  values ((select auth.uid()), v_role::text, p_client_id, p_table, p_record_id, p_action, coalesce(p_details, '{}'::jsonb));
end
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.edit_jobs enable row level security;
alter table public.edit_job_costs enable row level security;
alter table public.job_messages enable row level security;
alter table public.deliverables enable row level security;
alter table public.editor_access_keys enable row level security;

create policy edit_jobs_staff_all on public.edit_jobs for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy edit_jobs_editor_select on public.edit_jobs for select to authenticated
  using (editor_id = (select auth.uid()));

create policy edit_job_costs_admin_all on public.edit_job_costs for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy job_messages_staff_all on public.job_messages for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy job_messages_editor_select on public.job_messages for select to authenticated
  using (private.editor_on_job(job_id));
create policy job_messages_editor_insert on public.job_messages for insert to authenticated
  with check (private.editor_on_job(job_id) and author_id = (select auth.uid()) and kind = 'note');

create policy deliverables_staff_all on public.deliverables for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy deliverables_client_select on public.deliverables for select to authenticated
  using (client_id = (select private.user_client_id()));

create policy editor_access_keys_admin_all on public.editor_access_keys for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Editors: read-only view of the script, shots and clips behind an open job.
create policy scripts_editor_select on public.scripts for select to authenticated
  using (private.editor_has_script(id));
create policy shots_editor_select on public.shots for select to authenticated
  using (private.editor_has_script(script_id));
create policy footage_editor_select on public.footage_uploads for select to authenticated
  using (private.editor_has_script(script_id));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deliverables', 'deliverables', false, 5368709120, array['video/*'])
on conflict (id) do update set public = false;

create policy footage_objects_editor_select on storage.objects for select to authenticated
  using (bucket_id = 'footage' and private.editor_can_read_footage_path(name));

create policy deliverable_objects_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'deliverables' and (select private.is_staff()))
  with check (bucket_id = 'deliverables' and (select private.is_staff()));
create policy deliverable_objects_editor_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'deliverables' and private.editor_can_use_deliverable_path(name));
create policy deliverable_objects_editor_select on storage.objects for select to authenticated
  using (bucket_id = 'deliverables' and private.editor_can_use_deliverable_path(name));
create policy deliverable_objects_client_select on storage.objects for select to authenticated
  using (bucket_id = 'deliverables' and private.client_can_read_deliverable_path(name));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on public.edit_jobs, public.edit_job_costs, public.job_messages, public.deliverables, public.editor_access_keys from anon;
grant select, insert, update, delete on
  public.edit_jobs, public.edit_job_costs, public.job_messages, public.deliverables, public.editor_access_keys
  to authenticated;
grant all on public.edit_jobs, public.edit_job_costs, public.job_messages, public.deliverables, public.editor_access_keys to service_role;

revoke all on all functions in schema private from anon, public;
grant execute on all functions in schema private to authenticated, service_role;

revoke all on function public.create_edit_job(uuid, uuid, date) from anon, public;
revoke all on function public.request_revision(uuid, text) from anon, public;
revoke all on function public.approve_cut(uuid, text) from anon, public;
revoke all on function public.editor_start_job(uuid) from anon, public;
revoke all on function public.editor_submit_cut(uuid, text, text, text) from anon, public;
revoke all on function public.client_mark_downloaded(uuid) from anon, public;
revoke all on function public.log_event(uuid, text, text, text, jsonb) from anon, public;
grant execute on function public.create_edit_job(uuid, uuid, date) to authenticated, service_role;
grant execute on function public.request_revision(uuid, text) to authenticated, service_role;
grant execute on function public.approve_cut(uuid, text) to authenticated, service_role;
grant execute on function public.editor_start_job(uuid) to authenticated, service_role;
grant execute on function public.editor_submit_cut(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.client_mark_downloaded(uuid) to authenticated, service_role;
grant execute on function public.log_event(uuid, text, text, text, jsonb) to authenticated, service_role;

-- Decision (Nathan): two revision rounds are included per video. Jobs past
-- this are flagged as over. Editable in Settings.
update public.app_settings set revision_allowance = 2 where revision_allowance is null;
