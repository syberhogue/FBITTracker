create table public.stage_links (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  stage_id uuid not null,
  title text not null check (length(title) between 2 and 160),
  url text not null check (length(url) between 8 and 2048 and url ~* '^https?://'),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (stage_id,tracker_id) references public.stages(id,tracker_id) on delete cascade,
  unique(stage_id,url)
);

create index stage_links_stage_idx on public.stage_links(stage_id,created_at);

alter table public.stage_links enable row level security;
grant select,insert,delete on table public.stage_links to authenticated;

create policy stage_links_read on public.stage_links
for select to authenticated
using(private.can_access_tracker(tracker_id));

create policy stage_links_insert on public.stage_links
for insert to authenticated
with check(private.can_manage_tracker(tracker_id) and created_by=(select auth.uid()));

create policy stage_links_delete on public.stage_links
for delete to authenticated
using(private.can_manage_tracker(tracker_id));

alter publication supabase_realtime add table public.stage_links;
