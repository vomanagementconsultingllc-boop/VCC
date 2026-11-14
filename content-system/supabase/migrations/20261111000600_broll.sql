-- B-roll drop box: a per-client list of b-roll to shoot, with one submission
-- box per item. Each submission is checked automatically; if it is not
-- usable the client gets specific advice and the box reopens.
--
-- Files live in the private "broll" bucket:
--   broll/{client_id}/{request_id}/{submission_id}.{ext}        the clip
--   broll/{client_id}/{request_id}/{submission_id}-f{n}.jpg     still frames used for the review

create type public.broll_status as enum ('open', 'submitted', 'needs_reshoot', 'accepted');

create table public.broll_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- What to shoot, and how to shoot it. Both are shown to the client.
  title text not null check (length(btrim(title)) > 0),
  instructions text not null default '',
  orientation public.shot_orientation not null default 'portrait',
  min_duration_seconds integer not null default 5 check (min_duration_seconds >= 0),
  reference_url text not null default '',
  due_date date,
  status public.broll_status not null default 'open',
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, client_id)
);
create index broll_requests_client_idx on public.broll_requests (client_id, sort_order, created_at);

create table public.broll_submissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  storage_path text not null unique,
  frame_paths text[] not null default '{}',
  original_name text not null default '',
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  uploaded_at timestamptz not null default now(),
  -- Everything below is written by the review, never by the uploader.
  duration_seconds numeric,
  width integer,
  height integer,
  check_status public.footage_check not null default 'pending',
  flags text[] not null default '{}',
  -- Advice shown to the client when the clip is not usable.
  feedback text not null default '',
  reviewed_by text not null default '' check (reviewed_by in ('', 'auto', 'ai', 'team')),
  checked_at timestamptz,
  superseded boolean not null default false,
  foreign key (request_id, client_id) references public.broll_requests (id, client_id) on delete cascade
);
create index broll_submissions_request_idx on public.broll_submissions (request_id, uploaded_at desc);
create index broll_submissions_pending_idx on public.broll_submissions (uploaded_at) where check_status = 'pending';

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
-- A client can submit to their own request until the team has accepted it.
create function private.client_can_submit_broll(p_request_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.broll_requests r
    where r.id = p_request_id
      and r.client_id = (select private.user_client_id())
      and r.status <> 'accepted'
  )
$$;

create function private.client_can_upload_broll_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[] := string_to_array(p_name, '/');
begin
  if array_length(parts, 1) is distinct from 3 or not private.is_uuid(parts[1]) or not private.is_uuid(parts[2]) then
    return false;
  end if;
  return parts[1]::uuid = (select private.user_client_id())
     and private.client_can_submit_broll(parts[2]::uuid);
end
$$;

-- An editor can use a client's ACCEPTED b-roll while they have an open job for that client.
create function private.editor_has_client(p_client_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.edit_jobs j
    where j.client_id = p_client_id and j.editor_id = (select auth.uid()) and j.status <> 'done'
  )
$$;

create function private.editor_can_read_broll_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.broll_submissions s
    where s.storage_path = p_name and s.check_status = 'passed' and not s.superseded
      and private.editor_has_client(s.client_id)
  )
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger broll_requests_touch before update on public.broll_requests
  for each row execute function private.touch_updated_at();

create function private.broll_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prefix text := new.client_id::text || '/' || new.request_id::text || '/';
  f text;
begin
  if left(new.storage_path, length(v_prefix)) <> v_prefix then
    raise exception 'b-roll path does not match its client and request' using errcode = '23514';
  end if;
  foreach f in array new.frame_paths loop
    if left(f, length(v_prefix)) <> v_prefix then
      raise exception 'frame path does not match its client and request' using errcode = '23514';
    end if;
  end loop;

  -- The uploader records the upload and nothing else.
  if (select auth.uid()) is not null and not (select private.is_staff()) then
    new.uploaded_by := (select auth.uid());
    new.uploaded_at := now();
    new.check_status := 'pending';
    new.flags := '{}';
    new.feedback := '';
    new.reviewed_by := '';
    new.checked_at := null;
    new.duration_seconds := null;
    new.width := null;
    new.height := null;
    new.superseded := false;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'broll' and o.name = new.storage_path) then
      raise exception 'the file has not finished uploading' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

create trigger broll_guard before insert on public.broll_submissions
  for each row execute function private.broll_before_insert();

-- The request's status follows its newest submission.
create function private.broll_after_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.broll_submissions set superseded = true
     where request_id = new.request_id and id <> new.id and not superseded;
  end if;
  if new.superseded then
    return new;
  end if;
  update public.broll_requests
     set status = case new.check_status
                    when 'passed' then 'accepted'::public.broll_status
                    when 'failed' then 'needs_reshoot'::public.broll_status
                    else 'submitted'::public.broll_status
                  end
   where id = new.request_id;
  return new;
end
$$;

create trigger broll_progress after insert or update of check_status on public.broll_submissions
  for each row execute function private.broll_after_change();

create trigger broll_requests_audit after insert or update or delete on public.broll_requests
  for each row execute function private.audit_row();
create trigger broll_submissions_audit after insert or update or delete on public.broll_submissions
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.broll_requests enable row level security;
alter table public.broll_submissions enable row level security;

create policy broll_requests_staff_all on public.broll_requests for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy broll_requests_client_select on public.broll_requests for select to authenticated
  using (client_id = (select private.user_client_id()));
create policy broll_requests_editor_select on public.broll_requests for select to authenticated
  using (status = 'accepted' and private.editor_has_client(client_id));

create policy broll_submissions_staff_all on public.broll_submissions for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy broll_submissions_client_select on public.broll_submissions for select to authenticated
  using (client_id = (select private.user_client_id()));
create policy broll_submissions_client_insert on public.broll_submissions for insert to authenticated
  with check (client_id = (select private.user_client_id()) and private.client_can_submit_broll(request_id));
create policy broll_submissions_editor_select on public.broll_submissions for select to authenticated
  using (check_status = 'passed' and not superseded and private.editor_has_client(client_id));

revoke all on public.broll_requests, public.broll_submissions from anon;
grant select, insert, update, delete on public.broll_requests, public.broll_submissions to authenticated;
grant all on public.broll_requests, public.broll_submissions to service_role;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('broll', 'broll', false, 5368709120, array['video/*', 'image/jpeg'])
on conflict (id) do update set public = false;

create policy broll_objects_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'broll' and (select private.is_staff()))
  with check (bucket_id = 'broll' and (select private.is_staff()));
create policy broll_objects_client_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'broll' and private.client_can_upload_broll_path(name));
create policy broll_objects_client_select on storage.objects for select to authenticated
  using (bucket_id = 'broll' and (storage.foldername(name))[1] = (select private.user_client_id())::text);
create policy broll_objects_editor_select on storage.objects for select to authenticated
  using (bucket_id = 'broll' and private.editor_can_read_broll_path(name));

revoke all on all functions in schema private from anon, public;
grant execute on all functions in schema private to authenticated, service_role;
