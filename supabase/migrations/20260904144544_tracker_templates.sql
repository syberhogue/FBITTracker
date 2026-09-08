create table public.tracker_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 3 and 120),
  description text not null default '' check (length(description) <= 1000),
  type public.tracker_type not null,
  category public.tracker_category not null,
  scope text not null default 'personal' check (scope in ('personal','faculty')),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tracker_template_stages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.tracker_templates(id) on delete cascade,
  title text not null check (length(title) between 2 and 160),
  description text not null default '' check (length(description) <= 2000),
  due_offset_days integer not null check (due_offset_days between -3650 and 3650),
  is_required boolean not null default true,
  sort_order integer not null check (sort_order between 1 and 50),
  unique(template_id,sort_order)
);

create index tracker_templates_owner_idx on public.tracker_templates(owner_id,scope);
create index tracker_template_stages_template_idx on public.tracker_template_stages(template_id,sort_order);

create trigger tracker_templates_updated
before update on public.tracker_templates
for each row execute function public.set_updated_at();

alter table public.tracker_templates enable row level security;
alter table public.tracker_template_stages enable row level security;

grant select,insert,update,delete on table public.tracker_templates to authenticated;
grant select,insert,update,delete on table public.tracker_template_stages to authenticated;

create policy templates_read on public.tracker_templates
for select to authenticated
using (
  private.is_active_staff()
  and (scope='faculty' or owner_id=(select auth.uid()))
);

create policy templates_insert on public.tracker_templates
for insert to authenticated
with check (
  private.is_active_staff()
  and owner_id=(select auth.uid())
  and (scope='personal' or private.current_role()='dean')
);

create policy templates_update on public.tracker_templates
for update to authenticated
using (
  private.is_active_staff()
  and ((scope='personal' and owner_id=(select auth.uid())) or (scope='faculty' and private.current_role()='dean'))
)
with check (
  private.is_active_staff()
  and ((scope='personal' and owner_id=(select auth.uid())) or (scope='faculty' and private.current_role()='dean'))
);

create policy templates_delete on public.tracker_templates
for delete to authenticated
using (
  private.is_active_staff()
  and ((scope='personal' and owner_id=(select auth.uid())) or (scope='faculty' and private.current_role()='dean'))
);

create policy template_stages_read on public.tracker_template_stages
for select to authenticated
using (
  exists(
    select 1 from public.tracker_templates template
    where template.id=template_id
      and (template.scope='faculty' or template.owner_id=(select auth.uid()))
  )
);

create policy template_stages_insert on public.tracker_template_stages
for insert to authenticated
with check (
  exists(
    select 1 from public.tracker_templates template
    where template.id=template_id
      and ((template.scope='personal' and template.owner_id=(select auth.uid())) or (template.scope='faculty' and private.current_role()='dean'))
  )
);

create policy template_stages_update on public.tracker_template_stages
for update to authenticated
using (
  exists(
    select 1 from public.tracker_templates template
    where template.id=template_id
      and ((template.scope='personal' and template.owner_id=(select auth.uid())) or (template.scope='faculty' and private.current_role()='dean'))
  )
)
with check (
  exists(
    select 1 from public.tracker_templates template
    where template.id=template_id
      and ((template.scope='personal' and template.owner_id=(select auth.uid())) or (template.scope='faculty' and private.current_role()='dean'))
  )
);

create policy template_stages_delete on public.tracker_template_stages
for delete to authenticated
using (
  exists(
    select 1 from public.tracker_templates template
    where template.id=template_id
      and ((template.scope='personal' and template.owner_id=(select auth.uid())) or (template.scope='faculty' and private.current_role()='dean'))
  )
);

drop policy trackers_insert on public.trackers;
drop policy trackers_read on public.trackers;
create policy trackers_read on public.trackers
for select to authenticated
using (
  private.is_active_staff()
  and (created_by=(select auth.uid()) or private.can_access_tracker(id))
);
create policy trackers_insert on public.trackers
for insert to authenticated
with check (
  private.is_active_staff()
  and created_by=(select auth.uid())
  and private.can_access_unit(organization_unit_id)
);

create function public.save_tracker_template(
  p_template_id uuid,
  p_name text,
  p_description text,
  p_type public.tracker_type,
  p_category public.tracker_category,
  p_scope text,
  p_stages jsonb
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  saved_id uuid;
  stage_item jsonb;
  stage_number integer;
  affected integer;
begin
  if not private.is_active_staff() then
    raise exception 'An active staff account is required.' using errcode='42501';
  end if;
  if p_name is null or length(trim(p_name)) not between 3 and 120 then raise exception 'Template name must be 3 to 120 characters.'; end if;
  if coalesce(length(p_description),0)>1000 then raise exception 'Template description cannot exceed 1,000 characters.'; end if;
  if p_scope not in ('personal','faculty') then raise exception 'Choose a valid template scope.'; end if;
  if p_scope='faculty' and private.current_role()<>'dean' then raise exception 'Only deans can create faculty templates.' using errcode='42501'; end if;
  if jsonb_typeof(p_stages)<>'array' or jsonb_array_length(p_stages) not between 1 and 50 then raise exception 'Templates must contain 1 to 50 stages.'; end if;

  if p_template_id is null then
    insert into public.tracker_templates(name,description,type,category,scope,owner_id)
    values(trim(p_name),trim(coalesce(p_description,'')),p_type,p_category,p_scope,(select auth.uid()))
    returning id into saved_id;
  else
    update public.tracker_templates
    set name=trim(p_name),description=trim(coalesce(p_description,'')),type=p_type,category=p_category,scope=p_scope
    where id=p_template_id
    returning id into saved_id;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Template not found or not editable.' using errcode='42501'; end if;
    delete from public.tracker_template_stages where template_id=saved_id;
  end if;

  for stage_item,stage_number in
    select value,ordinality::integer from jsonb_array_elements(p_stages) with ordinality
  loop
    if length(trim(coalesce(stage_item->>'title',''))) not between 2 and 160 then raise exception 'Every stage needs a title between 2 and 160 characters.'; end if;
    if coalesce(length(stage_item->>'description'),0)>2000 then raise exception 'Stage descriptions cannot exceed 2,000 characters.'; end if;
    if not (stage_item ? 'due_offset_days') or (stage_item->>'due_offset_days')::integer not between -3650 and 3650 then raise exception 'Every stage offset must be between -3,650 and 3,650 days.'; end if;
    insert into public.tracker_template_stages(template_id,title,description,due_offset_days,is_required,sort_order)
    values(saved_id,trim(stage_item->>'title'),trim(coalesce(stage_item->>'description','')),(stage_item->>'due_offset_days')::integer,coalesce((stage_item->>'is_required')::boolean,true),stage_number);
  end loop;

  insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
  values((select auth.uid()),case when p_template_id is null then 'tracker_template.created' else 'tracker_template.updated' end,'tracker_template',saved_id::text,jsonb_build_object('scope',p_scope,'stages',jsonb_array_length(p_stages)));
  return saved_id;
end $$;

revoke all on function public.save_tracker_template(uuid,text,text,public.tracker_type,public.tracker_category,text,jsonb) from public,anon;
grant execute on function public.save_tracker_template(uuid,text,text,public.tracker_type,public.tracker_category,text,jsonb) to authenticated;

create function public.create_tracker_from_template(
  p_template_id uuid,
  p_title text,
  p_description text,
  p_anchor_date date
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  selected_template public.tracker_templates%rowtype;
  tracker_id uuid;
  unit_id uuid;
begin
  if not private.is_active_staff() then raise exception 'An active staff account is required.' using errcode='42501'; end if;
  if p_title is null or length(trim(p_title)) not between 3 and 160 then raise exception 'Tracker title must be 3 to 160 characters.'; end if;
  if p_anchor_date is null then raise exception 'Choose an anchor date.'; end if;

  select * into selected_template from public.tracker_templates where id=p_template_id;
  if selected_template.id is null then raise exception 'Template not found or not available.' using errcode='42501'; end if;
  select organization_unit_id into unit_id from public.profiles where id=(select auth.uid()) and is_active;

  insert into public.trackers(title,type,category,description,organization_unit_id,created_by)
  values(trim(p_title),selected_template.type,selected_template.category,coalesce(nullif(trim(p_description),''),selected_template.description),unit_id,(select auth.uid()))
  returning id into tracker_id;

  insert into public.stages(tracker_id,title,description,due_date,is_required,status,sort_order,created_by)
  select tracker_id,title,description,p_anchor_date+due_offset_days,is_required,'pending',sort_order,(select auth.uid())
  from public.tracker_template_stages
  where template_id=p_template_id
  order by sort_order;

  insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
  values((select auth.uid()),'tracker.created_from_template','tracker',tracker_id::text,jsonb_build_object('template_id',p_template_id,'anchor_date',p_anchor_date));
  return tracker_id;
end $$;

revoke all on function public.create_tracker_from_template(uuid,text,text,date) from public,anon;
grant execute on function public.create_tracker_from_template(uuid,text,text,date) to authenticated;

alter publication supabase_realtime add table public.tracker_templates,public.tracker_template_stages;
