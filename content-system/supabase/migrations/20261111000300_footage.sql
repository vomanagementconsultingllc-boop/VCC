-- Build step 3: footage upload slots and auto-checks.
--
-- Raw footage lives in a PRIVATE storage bucket and is only ever served
-- through signed URLs that expire in 15 minutes. Object paths always start
-- with the client's id:
--
--   footage/{client_id}/{script_id}/{shot_id}/{upload_id}.{ext}
--
-- so storage policies can scope every object to one client, and offboarding
-- can delete a client's files by prefix.

create type public.footage_check as enum ('pending', 'passed', 'failed');

-- Lets footage point at (shot, script) together, so an upload can never be
-- filed under a shot from a different script.
alter table public.shots add constraint shots_id_script_key unique (id, script_id);

create table public.footage_uploads (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null,
  shot_id uuid not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  shot_number integer not null default 0,
  storage_path text not null unique,
  original_name text not null default '',
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  uploaded_at timestamptz not null default now(),
  -- Filled in by the server-side check, never by the uploader.
  duration_seconds numeric,
  width integer,
  height integer,
  has_audio boolean,
  check_status public.footage_check not null default 'pending',
  flags text[] not null default '{}',
  checked_at timestamptz,
  -- True once a newer upload for the same shot replaces this one.
  superseded boolean not null default false,
  foreign key (script_id, client_id) references public.scripts (id, client_id) on delete cascade,
  foreign key (shot_id, script_id) references public.shots (id, script_id)
);
create index footage_uploads_script_idx on public.footage_uploads (script_id, shot_number);
create index footage_uploads_pending_idx on public.footage_uploads (uploaded_at) where check_status = 'pending';

-- ---------------------------------------------------------------------------
-- Who may upload. A client can add footage only to their own script, and
-- only while it is waiting for footage.
-- ---------------------------------------------------------------------------
create function private.client_can_upload(p_script_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.scripts s
    where s.id = p_script_id
      and s.client_id = (select private.user_client_id())
      and s.stage = 'awaiting_footage'
  )
$$;

-- Same rule, applied to a storage object path before the file is accepted.
create function private.client_can_upload_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[] := string_to_array(p_name, '/');
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if array_length(parts, 1) is distinct from 4 then
    return false;
  end if;
  if parts[1] !~ uuid_re or parts[2] !~ uuid_re or parts[3] !~ uuid_re then
    return false;
  end if;
  return exists (
    select 1
    from public.shots sh
    join public.scripts s on s.id = sh.script_id
    where sh.id = parts[3]::uuid
      and s.id = parts[2]::uuid
      and s.client_id = parts[1]::uuid
      and s.client_id = (select private.user_client_id())
      and s.stage = 'awaiting_footage'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function private.footage_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select s.shot_number into new.shot_number
  from public.shots s
  where s.id = new.shot_id and s.script_id = new.script_id;
  if not found then
    raise exception 'that shot does not belong to this script' using errcode = '23514';
  end if;

  if new.storage_path not like (new.client_id::text || '/' || new.script_id::text || '/' || new.shot_id::text || '/%') then
    raise exception 'footage path does not match its client, script and shot' using errcode = '23514';
  end if;

  -- An uploader who is not staff records the upload and nothing else: the
  -- check result is decided by the server, and the file must really exist.
  if (select auth.uid()) is not null and not (select private.is_staff()) then
    new.uploaded_by := (select auth.uid());
    new.uploaded_at := now();
    new.check_status := 'pending';
    new.flags := '{}';
    new.checked_at := null;
    new.duration_seconds := null;
    new.width := null;
    new.height := null;
    new.has_audio := null;
    new.superseded := false;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'footage' and o.name = new.storage_path) then
      raise exception 'the file has not finished uploading' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

create trigger footage_guard before insert on public.footage_uploads
  for each row execute function private.footage_before_insert();

-- A new upload replaces earlier ones for the same shot, and a script that
-- had all its footage goes back to waiting until the new clip is checked.
create function private.footage_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.footage_uploads
     set superseded = true
   where shot_id = new.shot_id and id <> new.id and not superseded;
  if new.check_status <> 'passed' then
    update public.scripts set stage = 'awaiting_footage'
     where id = new.script_id and stage = 'footage_received';
  end if;
  return new;
end
$$;

create trigger footage_supersede after insert on public.footage_uploads
  for each row execute function private.footage_after_insert();

-- When every shot has a current upload that passed its checks, the script
-- moves on by itself. A failed check (or a reshoot request) moves it back.
create function private.footage_after_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total integer;
  passed integer;
begin
  if new.superseded then
    return new;
  end if;
  if new.check_status = 'passed' then
    select count(*) into total from public.shots s where s.script_id = new.script_id;
    select count(distinct f.shot_id) into passed
      from public.footage_uploads f
     where f.script_id = new.script_id and f.check_status = 'passed' and not f.superseded;
    if total > 0 and passed = total then
      update public.scripts set stage = 'footage_received'
       where id = new.script_id and stage = 'awaiting_footage';
    end if;
  elsif new.check_status = 'failed' then
    update public.scripts set stage = 'awaiting_footage'
     where id = new.script_id and stage = 'footage_received';
  end if;
  return new;
end
$$;

create trigger footage_progress after insert or update of check_status on public.footage_uploads
  for each row execute function private.footage_after_check();

create trigger footage_uploads_audit after insert or update or delete on public.footage_uploads
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Row level security: table
-- ---------------------------------------------------------------------------
alter table public.footage_uploads enable row level security;

create policy footage_staff_all on public.footage_uploads for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy footage_client_select on public.footage_uploads for select to authenticated
  using (client_id = (select private.user_client_id()));
create policy footage_client_insert on public.footage_uploads for insert to authenticated
  with check (client_id = (select private.user_client_id()) and private.client_can_upload(script_id));

revoke all on public.footage_uploads from anon;
grant select, insert, update, delete on public.footage_uploads to authenticated;
grant all on public.footage_uploads to service_role;

-- ---------------------------------------------------------------------------
-- Private bucket and its policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('footage', 'footage', false, 5368709120, array['video/*'])
on conflict (id) do update set public = false;

create policy footage_objects_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'footage' and (select private.is_staff()))
  with check (bucket_id = 'footage' and (select private.is_staff()));

create policy footage_objects_client_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'footage' and private.client_can_upload_path(name));

create policy footage_objects_client_select on storage.objects for select to authenticated
  using (
    bucket_id = 'footage'
    and (storage.foldername(name))[1] = (select private.user_client_id())::text
  );

revoke all on all functions in schema private from anon, public;
grant execute on all functions in schema private to authenticated, service_role;
