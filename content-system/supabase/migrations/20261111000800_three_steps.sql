-- The client side as three steps: Plan, Shoot, Finish.
--
--   Plan   : an intake questionnaire on first sign-in, then a weekly batch of
--            videos, each with its hook and a direct inspiration link.
--   Shoot  : directions per video (unchanged tables).
--   Finish : the client can ask for fixes on an edit, approve it, and
--            download everything.

-- ---------------------------------------------------------------------------
-- Plan: inspiration link and week on each script
-- ---------------------------------------------------------------------------
-- Decision (Nathan): clients now see ONE link per video, the inspiration it
-- is modelled on. The research tables themselves stay private; only this
-- link is copied onto the script.
alter table public.scripts
  add column inspo_url text not null default '',
  add column week_of date;
create index scripts_week_idx on public.scripts (client_id, week_of);

-- ---------------------------------------------------------------------------
-- Plan: the intake questionnaire a client fills in when they first sign in.
-- It feeds the research engine (niche keywords) and the shooting directions
-- (where they can film, what they film with).
-- ---------------------------------------------------------------------------
create table public.client_intake (
  client_id uuid primary key references public.clients (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger client_intake_touch before update on public.client_intake
  for each row execute function private.touch_updated_at();
create trigger client_intake_audit after insert or update or delete on public.client_intake
  for each row execute function private.audit_row();

alter table public.client_intake enable row level security;
create policy client_intake_staff_all on public.client_intake for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy client_intake_client_select on public.client_intake for select to authenticated
  using (client_id = (select private.user_client_id()));

revoke all on public.client_intake from anon;
grant select, insert, update, delete on public.client_intake to authenticated;
grant all on public.client_intake to service_role;

-- A client saves their own answers. If the team has not set niche tags yet,
-- the keywords the client gave become the starting point for research.
create function public.submit_intake(p_answers jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_client uuid := (select private.user_client_id());
  v_tags text[];
begin
  if v_client is null or (select private.user_role()) is distinct from 'client' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 60000 then
    raise exception 'Those answers could not be saved.' using errcode = '23514';
  end if;

  insert into public.client_intake (client_id, answers, completed_at)
  values (v_client, p_answers, now())
  on conflict (client_id) do update set answers = excluded.answers, completed_at = coalesce(public.client_intake.completed_at, now());

  if jsonb_typeof(p_answers -> 'niche_keywords') = 'array' then
    select coalesce(array_agg(distinct tag), '{}') into v_tags
    from (
      select lower(btrim(value)) as tag
      from jsonb_array_elements_text(p_answers -> 'niche_keywords')
      limit 12
    ) t
    where tag <> '' and length(tag) <= 60;
    update public.clients set niche_tags = v_tags
     where id = v_client and niche_tags = '{}' and cardinality(v_tags) > 0;
  end if;

  perform private.notify_team(v_client, 'intake_completed', 'Intake answers in: ' || private.client_label(v_client),
    'The client has filled in their questionnaire, including where they can film.', '/team/clients/' || v_client);
end
$$;

-- ---------------------------------------------------------------------------
-- Finish: the client approves the edit, or sends it back with what to fix.
-- ---------------------------------------------------------------------------
alter table public.deliverables add column client_approved_at timestamptz;

create function public.client_approve_video(p_deliverable_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.deliverables
     set client_approved_at = coalesce(client_approved_at, now())
   where id = p_deliverable_id and client_id = (select private.user_client_id());
  if not found then
    raise exception 'video not found' using errcode = '42501';
  end if;
end
$$;

-- Asking for a fix takes the video back: the file is hidden again, the job
-- reopens as a revision with the client's note on its thread, and the script
-- returns to editing. It counts against the revision allowance.
create function public.client_request_fix(p_deliverable_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.deliverables%rowtype;
  s public.scripts%rowtype;
begin
  select * into d from public.deliverables where id = p_deliverable_id for update;
  if not found
     or (select private.user_role()) is distinct from 'client'
     or d.client_id is distinct from (select private.user_client_id()) then
    raise exception 'video not found' using errcode = '42501';
  end if;
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'Tell us what to fix.' using errcode = '23514';
  end if;
  select * into s from public.scripts where id = d.script_id;
  if s.stage = 'posted' then
    raise exception 'This video has already been posted.' using errcode = '23514';
  end if;

  update public.edit_jobs
     set status = 'revision', revision_count = revision_count + 1, completed_at = null
   where id = d.edit_job_id;
  insert into public.job_messages (job_id, client_id, author_id, kind, body)
  values (d.edit_job_id, d.client_id, (select auth.uid()), 'revision_request', 'From the client: ' || btrim(p_note));
  delete from public.deliverables where id = d.id;
  update public.scripts set stage = 'in_edit' where id = d.script_id;

  perform private.notify_team(d.client_id, 'client_fix_requested', 'Fix requested: ' || private.client_label(d.client_id),
    btrim(p_note), '/team/jobs/' || d.edit_job_id);
end
$$;

revoke all on function public.submit_intake(jsonb) from anon, public;
revoke all on function public.client_approve_video(uuid) from anon, public;
revoke all on function public.client_request_fix(uuid, text) from anon, public;
grant execute on function public.submit_intake(jsonb) to authenticated, service_role;
grant execute on function public.client_approve_video(uuid) to authenticated, service_role;
grant execute on function public.client_request_fix(uuid, text) to authenticated, service_role;
