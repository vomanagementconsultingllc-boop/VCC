-- Build step 5: research engine, hook library, AI call log.
--
-- Research is pulled per NICHE TAG, never per client, so it carries no
-- client_id and is reused across every client in that niche. Nothing in
-- these two tables is client data, and clients and editors cannot read them.

create type public.hook_format as enum ('question', 'bold_claim', 'contrarian', 'story_open', 'number_list');
create type public.research_status as enum ('new', 'worth_copying', 'dismissed');

create table public.research_items (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  platform text not null check (platform in ('tiktok', 'instagram', 'youtube', 'other')),
  creator_handle text not null default '',
  follower_count bigint check (follower_count is null or follower_count >= 0),
  view_count bigint not null default 0 check (view_count >= 0),
  likes bigint,
  comments bigint,
  posted_at timestamptz,
  -- Median views over the creator's last 20 posts at capture time.
  creator_median_views bigint check (creator_median_views is null or creator_median_views >= 0),
  -- "Proven" is numeric: views divided by the creator's own median. Raw view
  -- count alone is not a signal.
  performance_ratio numeric generated always as (
    case when creator_median_views > 0 then round(view_count::numeric / creator_median_views, 2) end
  ) stored,
  transcript text not null default '',
  hook_text text not null default '',
  format_label public.video_format,
  niche_tags text[] not null default '{}',
  status public.research_status not null default 'new',
  source text not null default 'manual' check (source in ('manual', 'apify')),
  captured_at timestamptz not null default now(),
  added_by uuid references public.profiles (id) on delete set null default auth.uid()
);
create index research_items_niche_idx on public.research_items using gin (niche_tags);
create index research_items_ratio_idx on public.research_items (performance_ratio desc nulls last);

create table public.hooks (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(btrim(text)) > 0),
  format_type public.hook_format not null,
  research_item_id uuid references public.research_items (id) on delete set null,
  niche_tags text[] not null default '{}',
  archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index hooks_niche_idx on public.hooks using gin (niche_tags);

-- Usage history: which hook was used for which client's script. This is what
-- lets the team see which hook families actually worked for which clients.
create table public.hook_uses (
  id uuid primary key default gen_random_uuid(),
  hook_id uuid not null references public.hooks (id) on delete cascade,
  script_id uuid not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  used_at timestamptz not null default now(),
  foreign key (script_id, client_id) references public.scripts (id, client_id) on delete cascade,
  unique (hook_id, script_id)
);
create index hook_uses_client_idx on public.hook_uses (client_id);

-- Every AI call, with the client it was for and a hash of what was sent, so
-- there is a record without keeping a second copy of the prompt.
create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  purpose text not null,
  model text not null,
  input_hash text not null,
  input_chars integer not null default 0,
  output_chars integer not null default 0,
  status text not null default 'ok' check (status in ('ok', 'refused', 'error')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index ai_calls_client_idx on public.ai_calls (client_id, created_at desc);

alter table public.script_internal
  add constraint script_internal_hook_fkey foreign key (hook_id) references public.hooks (id) on delete set null,
  add constraint script_internal_research_fkey foreign key (source_research_item_id) references public.research_items (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Ranking. A video is an outlier at 3x its creator's median. Hooks rank by
-- that ratio and by recency: full weight for 60 days, then the score halves
-- every 30 days.
-- ---------------------------------------------------------------------------
create function public.hook_score(p_ratio numeric, p_posted_at timestamptz, p_now timestamptz default now())
returns numeric
language sql immutable set search_path = '' as $$
  select case
    when p_ratio is null then 0
    when p_posted_at is null then p_ratio
    when p_now - p_posted_at <= interval '60 days' then p_ratio
    else round(p_ratio * power(0.5, (extract(epoch from (p_now - p_posted_at)) / 86400 - 60) / 30)::numeric, 2)
  end
$$;

-- security_invoker: the view runs with the caller's rights, so the row level
-- security on the tables underneath still applies.
create view public.hook_rankings with (security_invoker = true) as
select
  h.id,
  h.text,
  h.format_type,
  h.niche_tags,
  h.archived,
  h.created_at,
  h.research_item_id,
  r.source_url,
  r.platform,
  r.creator_handle,
  r.performance_ratio,
  r.posted_at,
  r.format_label,
  public.hook_score(r.performance_ratio, coalesce(r.posted_at, r.captured_at)) as score,
  (select count(*) from public.hook_uses u where u.hook_id = h.id) as times_used
from public.hooks h
left join public.research_items r on r.id = h.research_item_id;

-- A hook counts as used when its script actually goes to the client.
create function private.record_hook_use() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_hook uuid;
begin
  if new.stage = 'sent_to_client' and old.stage is distinct from new.stage then
    select i.hook_id into v_hook from public.script_internal i where i.script_id = new.id;
    if v_hook is not null then
      insert into public.hook_uses (hook_id, script_id, client_id)
      values (v_hook, new.id, new.client_id)
      on conflict (hook_id, script_id) do nothing;
    end if;
  end if;
  return new;
end
$$;

create trigger scripts_hook_use after update of stage on public.scripts
  for each row execute function private.record_hook_use();

create trigger hook_uses_audit after insert or update or delete on public.hook_uses
  for each row execute function private.audit_row();
create trigger ai_calls_audit after insert on public.ai_calls
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Row level security: staff only, all four tables.
-- ---------------------------------------------------------------------------
alter table public.research_items enable row level security;
alter table public.hooks enable row level security;
alter table public.hook_uses enable row level security;
alter table public.ai_calls enable row level security;

create policy research_items_staff_all on public.research_items for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy hooks_staff_all on public.hooks for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy hook_uses_staff_all on public.hook_uses for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy ai_calls_staff_select on public.ai_calls for select to authenticated
  using ((select private.is_staff()));
create policy ai_calls_staff_insert on public.ai_calls for insert to authenticated
  with check ((select private.is_staff()) and created_by = (select auth.uid()));

revoke all on public.research_items, public.hooks, public.hook_uses, public.ai_calls, public.hook_rankings from anon;
grant select, insert, update, delete on public.research_items, public.hooks, public.hook_uses to authenticated;
grant select, insert on public.ai_calls to authenticated;
revoke update, delete on public.ai_calls from authenticated;
grant select on public.hook_rankings to authenticated;
grant all on public.research_items, public.hooks, public.hook_uses, public.ai_calls to service_role;
grant select on public.hook_rankings to service_role;

revoke all on function public.hook_score(numeric, timestamptz, timestamptz) from anon, public;
grant execute on function public.hook_score(numeric, timestamptz, timestamptz) to authenticated, service_role;
revoke all on all functions in schema private from anon, public;
grant execute on all functions in schema private to authenticated, service_role;
