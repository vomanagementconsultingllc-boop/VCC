-- Build steps 6 and 7: posting, the performance log, and notifications.
--
-- Decision (Nathan): performance numbers wait for platform API access, so
-- v1 has no number entry. The table exists so numbers can be pulled in
-- later; for now a row records that a video was posted, where and when.

create table public.performance_logs (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'other')),
  posted_at timestamptz not null default now(),
  post_url text not null default '',
  views_24h bigint,
  views_72h bigint,
  views_7d bigint,
  saves bigint,
  comments bigint,
  source text not null default 'pending' check (source in ('pending', 'client', 'team', 'platform')),
  updated_at timestamptz not null default now(),
  foreign key (deliverable_id, client_id) references public.deliverables (id, client_id) on delete cascade,
  unique (deliverable_id, platform)
);

create trigger performance_logs_touch before update on public.performance_logs
  for each row execute function private.touch_updated_at();
create trigger performance_logs_audit after insert or update or delete on public.performance_logs
  for each row execute function private.audit_row();

-- The client marks a delivered video as posted. One call, their own videos only.
create function public.client_mark_posted(p_deliverable_id uuid, p_platform text, p_post_url text default '')
returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.deliverables%rowtype;
begin
  select * into d from public.deliverables where id = p_deliverable_id;
  if not found
     or (select private.user_role()) is distinct from 'client'
     or d.client_id is distinct from (select private.user_client_id()) then
    raise exception 'video not found' using errcode = '42501';
  end if;
  if p_platform not in ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'other') then
    raise exception 'Choose where you posted it.' using errcode = '23514';
  end if;
  insert into public.performance_logs (deliverable_id, client_id, platform, post_url)
  values (d.id, d.client_id, p_platform, coalesce(left(btrim(p_post_url), 500), ''))
  on conflict (deliverable_id, platform) do update set post_url = excluded.post_url;
  update public.scripts set stage = 'posted' where id = d.script_id and stage = 'delivered';
end
$$;

-- ---------------------------------------------------------------------------
-- Notifications: an outbox. Database triggers queue a row whenever something
-- happens that someone should hear about, whichever code path caused it. A
-- background job emails the queued rows.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  kind text not null,
  subject text not null,
  body text not null default '',
  link text not null default '',
  email_status text not null default 'queued' check (email_status in ('queued', 'sent', 'skipped', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notifications_queue_idx on public.notifications (created_at) where email_status = 'queued';
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

create function private.notify(p_recipient uuid, p_client uuid, p_kind text, p_subject text, p_body text, p_link text)
returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (recipient_id, client_id, kind, subject, body, link)
  select p_recipient, p_client, p_kind, p_subject, coalesce(p_body, ''), coalesce(p_link, '')
  where p_recipient is not null
$$;

-- Everyone who signs in for a client.
create function private.notify_client(p_client uuid, p_kind text, p_subject text, p_body text, p_link text)
returns void
language sql security definer set search_path = '' as $$
  select private.notify(p.id, p_client, p_kind, p_subject, p_body, p_link)
  from public.profiles p where p.client_id = p_client and p.role = 'client'
$$;

-- The team member assigned to the client, or every admin if nobody is.
create function private.notify_team(p_client uuid, p_kind text, p_subject text, p_body text, p_link text)
returns void
language sql security definer set search_path = '' as $$
  select private.notify(p.id, p_client, p_kind, p_subject, p_body, p_link)
  from public.profiles p
  where p.id = (select c.assigned_team_member from public.clients c where c.id = p_client)
     or ((select c.assigned_team_member from public.clients c where c.id = p_client) is null and p.role = 'admin')
$$;

create function private.client_label(p_client uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(c.business, ''), c.name) from public.clients c where c.id = p_client
$$;

create function private.scripts_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stage is distinct from old.stage then
    if new.stage = 'sent_to_client' then
      perform private.notify_client(new.client_id, 'script_ready', 'Your next script is ready',
        'We have written your next script: "' || new.title || '". Read it through and approve it, or tell us what to change.',
        '/portal/scripts/' || new.id);
    elsif new.stage = 'footage_received' then
      perform private.notify_team(new.client_id, 'footage_received', 'Footage is in: ' || private.client_label(new.client_id),
        'Every shot for "' || new.title || '" has passed its checks. It is ready to assign to an editor.', '/team/jobs');
    end if;
  end if;
  return new;
end
$$;
create trigger scripts_notify after update of stage on public.scripts
  for each row execute function private.scripts_notify();

create function private.footage_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.check_status = 'failed' and old.check_status is distinct from 'failed' then
    perform private.notify_team(new.client_id, 'auto_check_failed', 'A clip failed its check: ' || private.client_label(new.client_id),
      'Shot ' || new.shot_number || ' was flagged (' || array_to_string(new.flags, ', ') || '). The client has been asked to record it again.',
      '/team/scripts/' || new.script_id);
  end if;
  return new;
end
$$;
create trigger footage_notify after update of check_status on public.footage_uploads
  for each row execute function private.footage_notify();

create function private.comments_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.author_id and p.role = 'client') then
    perform private.notify_team(new.client_id, 'client_comment',
      case when new.kind = 'change_request' then 'Changes requested: ' else 'New comment: ' end || private.client_label(new.client_id),
      new.body, '/team/scripts/' || new.script_id);
  end if;
  return new;
end
$$;
create trigger comments_notify after insert on public.script_comments
  for each row execute function private.comments_notify();

create function private.jobs_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.editor_id is not null and (tg_op = 'INSERT' or new.editor_id is distinct from old.editor_id) then
    perform private.notify(new.editor_id, new.client_id, 'job_assigned', 'New edit job: ' || new.client_label,
      'A new job has been assigned to you.' || case when new.due_date is not null then ' Due ' || to_char(new.due_date, 'Mon DD') || '.' else '' end,
      '/editor/jobs/' || new.id);
  end if;
  if tg_op = 'UPDATE' and new.status = 'revision' and old.status is distinct from 'revision' then
    perform private.notify(new.editor_id, new.client_id, 'revision_requested', 'Revision requested: ' || new.client_label,
      'The team asked for changes. Their note is on the job.', '/editor/jobs/' || new.id);
  end if;
  if tg_op = 'UPDATE' and new.status = 'submitted' and old.status is distinct from 'submitted' then
    perform private.notify_team(new.client_id, 'cut_submitted', 'A cut is ready to review: ' || new.client_label,
      'The editor has submitted a cut.', '/team/jobs/' || new.id);
  end if;
  return new;
end
$$;
create trigger jobs_notify after insert or update on public.edit_jobs
  for each row execute function private.jobs_notify();

create function private.deliverables_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_client(new.client_id, 'delivered', 'Your video is ready',
    'Your finished video is ready to download, with a caption and a posting checklist.', '/portal/delivered');
  return new;
end
$$;
create trigger deliverables_notify after insert on public.deliverables
  for each row execute function private.deliverables_notify();

create function private.broll_requests_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_client(new.client_id, 'broll_added', 'New b-roll to film',
    'We have added to your b-roll list: "' || new.title || '". It says what to film and how.', '/portal/broll');
  return new;
end
$$;
create trigger broll_requests_notify after insert on public.broll_requests
  for each row execute function private.broll_requests_notify();

create function private.broll_submissions_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
begin
  if new.superseded or new.check_status is not distinct from old.check_status then
    return new;
  end if;
  select r.title into v_title from public.broll_requests r where r.id = new.request_id;
  if new.check_status = 'failed' then
    -- The advice goes to the client by email as well as onto their submission box.
    perform private.notify_client(new.client_id, 'broll_reshoot', 'Please film this one again: ' || v_title,
      new.feedback, '/portal/broll');
  end if;
  return new;
end
$$;
create trigger broll_submissions_notify after update of check_status on public.broll_submissions
  for each row execute function private.broll_submissions_notify();

-- A clip the automatic review could not judge waits for the team.
create function private.broll_pending_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.check_status = 'pending' and exists (select 1 from public.profiles p where p.id = new.uploaded_by and p.role = 'client') then
    perform private.notify_team(new.client_id, 'broll_submitted', 'B-roll sent: ' || private.client_label(new.client_id),
      'A new b-roll clip is in. If the automatic review does not settle it, it will wait for you.',
      '/team/clients/' || new.client_id || '/broll');
  end if;
  return new;
end
$$;
create trigger broll_pending_notify after insert on public.broll_submissions
  for each row execute function private.broll_pending_notify();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.performance_logs enable row level security;
alter table public.notifications enable row level security;

create policy performance_logs_staff_all on public.performance_logs for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy performance_logs_client_select on public.performance_logs for select to authenticated
  using (client_id = (select private.user_client_id()));

-- You can read your own notifications. Nobody writes them through the API.
create policy notifications_own_select on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

revoke all on public.performance_logs, public.notifications from anon;
grant select, insert, update, delete on public.performance_logs to authenticated;
grant select on public.notifications to authenticated;
revoke insert, update, delete on public.notifications from authenticated;
grant all on public.performance_logs, public.notifications to service_role;

revoke all on function public.client_mark_posted(uuid, text, text) from anon, public;
grant execute on function public.client_mark_posted(uuid, text, text) to authenticated, service_role;
revoke all on all functions in schema private from anon, public;
grant execute on all functions in schema private to authenticated, service_role;

-- The notify helpers are only ever called from triggers (which run as the
-- table owner), so signed-in users get no right to call them.
revoke execute on function private.notify(uuid, uuid, text, text, text, text) from authenticated;
revoke execute on function private.notify_client(uuid, text, text, text, text) from authenticated;
revoke execute on function private.notify_team(uuid, text, text, text, text) from authenticated;
