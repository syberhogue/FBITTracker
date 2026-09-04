create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum ('dean','academic_director','chair','program_lead','instructor','research_lead','graduate_supervisor');
create type public.tracker_type as enum ('general','grade_submission');
create type public.tracker_category as enum ('Administrative','Academic','Research','Other');
create type public.stage_status as enum ('pending','in_progress','completed','skipped');
create type public.member_access as enum ('viewer','editor','manager');
create type public.submission_status as enum ('submitted','outstanding');

create table public.organization_units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.app_role not null default 'instructor',
  organization_unit_id uuid references public.organization_units(id),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_scopes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_unit_id uuid not null references public.organization_units(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, organization_unit_id)
);

create table public.trackers (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 160),
  type public.tracker_type not null,
  category public.tracker_category not null,
  description text not null default '',
  organization_unit_id uuid references public.organization_units(id),
  created_by uuid not null default auth.uid() references public.profiles(id),
  average_threshold numeric(5,2) check (average_threshold between 0 and 100),
  pass_rate_threshold numeric(5,2) check (pass_rate_threshold between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tracker_members (
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  access public.member_access not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (tracker_id, profile_id)
);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  title text not null check (length(title) between 2 and 160),
  description text not null default '',
  due_date date not null,
  is_required boolean not null default true,
  status public.stage_status not null default 'pending',
  sort_order integer not null check (sort_order > 0),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tracker_id, sort_order),
  unique (id, tracker_id),
  check (not (is_required and status = 'skipped'))
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  stage_id uuid,
  bucket_id text not null check (bucket_id in ('tracker-documents','course-target-imports')),
  object_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (stage_id, tracker_id) references public.stages(id, tracker_id) on delete cascade
);

create table public.academic_terms (
  code text primary key check (code ~ '^[FWS][0-9]{2}$'),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  check (ends_on >= starts_on)
);
create unique index one_current_academic_term on public.academic_terms (is_current) where is_current;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  department text not null,
  organization_unit_id uuid references public.organization_units(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_terms (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  term_code text not null references public.academic_terms(code),
  instructor_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, term_code)
);

create table public.grade_submission_targets (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  course_term_id uuid not null references public.course_terms(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (tracker_id, course_term_id)
);

create table public.grade_uploads (
  id uuid primary key default gen_random_uuid(),
  course_term_id uuid not null references public.course_terms(id) on delete cascade,
  version integer not null check (version > 0),
  is_active boolean not null default true,
  enrolled_count integer not null default 0 check (enrolled_count between 0 and 5000),
  class_average numeric(5,2) not null default 0 check (class_average between 0 and 100),
  pass_rate numeric(5,2) not null default 0 check (pass_rate between 0 and 100),
  distribution_json jsonb not null default '{"A":0,"B":0,"C":0,"D":0,"F":0}'::jsonb,
  uploaded_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (course_term_id, version)
);
create unique index one_active_grade_upload on public.grade_uploads(course_term_id) where is_active;

create table public.grade_entries (
  id bigint generated always as identity primary key,
  grade_upload_id uuid not null references public.grade_uploads(id) on delete cascade,
  source_row integer not null check (source_row > 0),
  final_grade numeric(5,2) not null check (final_grade between 0 and 100),
  unique (grade_upload_id, source_row)
);

create table public.submission_status_overrides (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  term_code text not null references public.academic_terms(code),
  status public.submission_status not null,
  reason text not null check (length(reason) >= 5),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  cleared_by uuid references public.profiles(id),
  cleared_at timestamptz,
  check ((cleared_at is null) = (cleared_by is null))
);
create unique index one_current_submission_override on public.submission_status_overrides(course_id,term_code) where cleared_at is null;

create table public.grade_benchmark_settings (
  id uuid primary key default gen_random_uuid(),
  scope text not null unique default 'faculty' check (scope = 'faculty'),
  tracker_id uuid references public.trackers(id) on delete cascade,
  average_threshold numeric(5,2) not null default 70 check (average_threshold between 0 and 100),
  pass_rate_threshold numeric(5,2) not null default 80 check (pass_rate_threshold between 0 and 100),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check (tracker_id is null)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index trackers_unit_idx on public.trackers(organization_unit_id);
create index tracker_members_profile_idx on public.tracker_members(profile_id,tracker_id);
create index stages_tracker_due_idx on public.stages(tracker_id,due_date);
create index profiles_unit_idx on public.profiles(organization_unit_id);
create index course_terms_instructor_idx on public.course_terms(instructor_id,term_code);
create index targets_course_term_idx on public.grade_submission_targets(course_term_id,tracker_id);
create index grade_entries_upload_idx on public.grade_entries(grade_upload_id);
create index audit_events_entity_idx on public.audit_events(entity_type,entity_id,created_at desc);

create function private.current_role() returns public.app_role language sql stable security definer set search_path='' as $$
  select role from public.profiles where id = (select auth.uid()) and is_active
$$;
create function private.is_active_staff() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
$$;
create function private.can_access_unit(unit_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select case
    when private.current_role() in ('dean','academic_director') then true
    when unit_id is null then private.current_role() in ('chair','program_lead')
    else exists(select 1 from public.profile_scopes where profile_id=(select auth.uid()) and organization_unit_id=unit_id)
      or exists(select 1 from public.profiles where id=(select auth.uid()) and organization_unit_id=unit_id)
  end
$$;
create function private.can_access_tracker(tracker uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active_staff() and exists(
    select 1 from public.trackers t where t.id=tracker and (
      private.current_role() in ('dean','academic_director') or
      (private.current_role() in ('chair','program_lead') and private.can_access_unit(t.organization_unit_id)) or t.created_by=(select auth.uid()) or
      exists(select 1 from public.tracker_members tm where tm.tracker_id=t.id and tm.profile_id=(select auth.uid())) or
      exists(select 1 from public.grade_submission_targets gst join public.course_terms ct on ct.id=gst.course_term_id where gst.tracker_id=t.id and ct.instructor_id=(select auth.uid()))
    )
  )
$$;
create function private.can_manage_tracker(tracker uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active_staff() and exists(
    select 1 from public.trackers t where t.id=tracker and (
      private.current_role() in ('dean','academic_director') or
      (private.current_role() in ('chair','program_lead') and private.can_access_unit(t.organization_unit_id)) or
      t.created_by=(select auth.uid()) or
      exists(select 1 from public.tracker_members tm where tm.tracker_id=t.id and tm.profile_id=(select auth.uid()) and tm.access in ('editor','manager'))
    )
  )
$$;
create function private.can_access_course_term(course_term uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active_staff() and exists(
    select 1 from public.course_terms ct join public.courses c on c.id=ct.course_id where ct.id=course_term and (
      private.current_role() in ('dean','academic_director') or ct.instructor_id=(select auth.uid()) or
      (private.current_role() in ('chair','program_lead') and private.can_access_unit(c.organization_unit_id))
    )
  )
$$;
create function private.can_submit_course_term(course_term uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active_staff() and exists(
    select 1 from public.course_terms ct join public.courses c on c.id=ct.course_id where ct.id=course_term and (
      private.current_role() in ('dean','academic_director') or ct.instructor_id=(select auth.uid()) or
      (private.current_role() in ('chair','program_lead') and private.can_access_unit(c.organization_unit_id))
    )
  )
$$;
create function private.can_manage_course_term(course_term uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active_staff() and exists(
    select 1 from public.course_terms ct join public.courses c on c.id=ct.course_id where ct.id=course_term and (
      private.current_role() in ('dean','academic_director') or
      (private.current_role() in ('chair','program_lead') and private.can_access_unit(c.organization_unit_id))
    )
  )
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

create function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end $$;
revoke all on function public.set_updated_at() from public,anon;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trackers_updated before update on public.trackers for each row execute function public.set_updated_at();
create trigger stages_updated before update on public.stages for each row execute function public.set_updated_at();
create trigger courses_updated before update on public.courses for each row execute function public.set_updated_at();
create trigger course_terms_updated before update on public.course_terms for each row execute function public.set_updated_at();

create function public.submit_grade_upload(p_course_term_id uuid,p_grades numeric[]) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare upload_id uuid; next_version integer; row_count integer; avg_grade numeric; pass_pct numeric; dist jsonb;
begin
  if not private.can_submit_course_term(p_course_term_id) then raise exception 'Not authorized for this course term' using errcode='42501'; end if;
  row_count:=coalesce(array_length(p_grades,1),0);
  if row_count<1 or row_count>5000 then raise exception 'Grades must contain 1 to 5000 rows'; end if;
  if exists(select 1 from unnest(p_grades) g where g is null or g<0 or g>100) then raise exception 'Every grade must be between 0 and 100'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_course_term_id::text,0));
  select coalesce(max(version),0)+1 into next_version from public.grade_uploads where course_term_id=p_course_term_id;
  update public.grade_uploads set is_active=false where course_term_id=p_course_term_id and is_active;
  insert into public.grade_uploads(course_term_id,version,is_active,uploaded_by) values(p_course_term_id,next_version,true,(select auth.uid())) returning id into upload_id;
  insert into public.grade_entries(grade_upload_id,source_row,final_grade) select upload_id,ordinality,grade from unnest(p_grades) with ordinality as x(grade,ordinality);
  select round(avg(g),2),round(100.0*count(*) filter(where g>=50)/count(*),2),jsonb_build_object('A',count(*) filter(where g>=80),'B',count(*) filter(where g>=70 and g<80),'C',count(*) filter(where g>=60 and g<70),'D',count(*) filter(where g>=50 and g<60),'F',count(*) filter(where g<50)) into avg_grade,pass_pct,dist from unnest(p_grades) g;
  update public.grade_uploads set enrolled_count=row_count,class_average=avg_grade,pass_rate=pass_pct,distribution_json=dist where id=upload_id;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,details) values((select auth.uid()),'grade_upload.created','course_term',p_course_term_id::text,jsonb_build_object('upload_id',upload_id,'version',next_version,'rows',row_count));
  return jsonb_build_object('upload_id',upload_id,'version',next_version,'enrolled_count',row_count,'class_average',avg_grade,'pass_rate',pass_pct,'distribution',dist);
end $$;
revoke all on function public.submit_grade_upload(uuid,numeric[]) from public,anon;
grant execute on function public.submit_grade_upload(uuid,numeric[]) to authenticated;

create function public.import_grade_targets(p_tracker_id uuid,p_term_code text,p_rows jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare item jsonb; unit_id uuid; instructor uuid; course uuid; course_term uuid; imported integer:=0;
begin
  if not private.can_manage_tracker(p_tracker_id) then raise exception 'Not authorized for this tracker' using errcode='42501'; end if;
  if not exists(select 1 from public.academic_terms where code=p_term_code) then raise exception 'Unknown academic term'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    select id into unit_id from public.organization_units where lower(name)=lower(item->>'Department') limit 1;
    select id into instructor from public.profiles where lower(email)=lower(nullif(item->>'InstructorEmail','')) and is_active limit 1;
    insert into public.courses(code,title,department,organization_unit_id) values(upper(trim(item->>'CourseCode')),trim(item->>'CourseTitle'),trim(item->>'Department'),unit_id)
      on conflict(code) do update set title=excluded.title,department=excluded.department,organization_unit_id=coalesce(excluded.organization_unit_id,public.courses.organization_unit_id) returning id into course;
    insert into public.course_terms(course_id,term_code,instructor_id) values(course,p_term_code,instructor)
      on conflict(course_id,term_code) do update set instructor_id=coalesce(excluded.instructor_id,public.course_terms.instructor_id) returning id into course_term;
    insert into public.grade_submission_targets(tracker_id,course_term_id) values(p_tracker_id,course_term) on conflict do nothing;
    imported:=imported+1;
  end loop;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,details) values((select auth.uid()),'targets.imported','tracker',p_tracker_id::text,jsonb_build_object('term',p_term_code,'rows',imported));
  return imported;
end $$;
revoke all on function public.import_grade_targets(uuid,text,jsonb) from public,anon;
grant execute on function public.import_grade_targets(uuid,text,jsonb) to authenticated;

alter table public.organization_units enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_scopes enable row level security;
alter table public.trackers enable row level security;
alter table public.tracker_members enable row level security;
alter table public.stages enable row level security;
alter table public.documents enable row level security;
alter table public.academic_terms enable row level security;
alter table public.courses enable row level security;
alter table public.course_terms enable row level security;
alter table public.grade_submission_targets enable row level security;
alter table public.grade_uploads enable row level security;
alter table public.grade_entries enable row level security;
alter table public.submission_status_overrides enable row level security;
alter table public.grade_benchmark_settings enable row level security;
alter table public.audit_events enable row level security;

revoke all on all tables in schema public from anon;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;

create policy units_read on public.organization_units for select to authenticated using(private.is_active_staff());
create policy profiles_read on public.profiles for select to authenticated using(private.is_active_staff() and (id=(select auth.uid()) or private.current_role() in ('dean','academic_director','chair','program_lead')));
create policy profiles_dean_update on public.profiles for update to authenticated using(private.current_role()='dean') with check(private.current_role()='dean');
create policy scopes_read on public.profile_scopes for select to authenticated using(profile_id=(select auth.uid()) or private.current_role() in ('dean','academic_director'));
create policy scopes_dean_all on public.profile_scopes for all to authenticated using(private.current_role()='dean') with check(private.current_role()='dean');
create policy trackers_read on public.trackers for select to authenticated using(private.can_access_tracker(id));
create policy trackers_insert on public.trackers for insert to authenticated with check(private.current_role() in ('dean','academic_director','chair','program_lead','research_lead','graduate_supervisor') and created_by=(select auth.uid()) and private.can_access_unit(organization_unit_id));
create policy trackers_update on public.trackers for update to authenticated using(private.can_manage_tracker(id)) with check(private.can_manage_tracker(id));
create policy trackers_delete on public.trackers for delete to authenticated using(private.can_manage_tracker(id));
create policy members_read on public.tracker_members for select to authenticated using(private.can_access_tracker(tracker_id));
create policy members_manage on public.tracker_members for all to authenticated using(private.can_manage_tracker(tracker_id)) with check(private.can_manage_tracker(tracker_id));
create policy stages_read on public.stages for select to authenticated using(private.can_access_tracker(tracker_id));
create policy stages_insert on public.stages for insert to authenticated with check(private.can_manage_tracker(tracker_id) and created_by=(select auth.uid()));
create policy stages_update on public.stages for update to authenticated using(private.can_manage_tracker(tracker_id)) with check(private.can_manage_tracker(tracker_id));
create policy stages_delete on public.stages for delete to authenticated using(private.can_manage_tracker(tracker_id));
create policy documents_read on public.documents for select to authenticated using(private.can_access_tracker(tracker_id));
create policy documents_write on public.documents for insert to authenticated with check(private.can_manage_tracker(tracker_id) and created_by=(select auth.uid()));
create policy documents_delete on public.documents for delete to authenticated using(private.can_manage_tracker(tracker_id));
create policy terms_read on public.academic_terms for select to authenticated using(private.is_active_staff());
create policy terms_manage on public.academic_terms for all to authenticated using(private.current_role() in ('dean','academic_director')) with check(private.current_role() in ('dean','academic_director'));
create policy courses_read on public.courses for select to authenticated using(private.is_active_staff() and (private.current_role() in ('dean','academic_director') or (private.current_role() in ('chair','program_lead') and private.can_access_unit(organization_unit_id)) or exists(select 1 from public.course_terms ct where ct.course_id=id and private.can_access_course_term(ct.id))));
create policy courses_manage on public.courses for all to authenticated using(private.current_role() in ('dean','academic_director','chair','program_lead') and private.can_access_unit(organization_unit_id)) with check(private.current_role() in ('dean','academic_director','chair','program_lead') and private.can_access_unit(organization_unit_id));
create policy course_terms_read on public.course_terms for select to authenticated using(private.can_access_course_term(id));
create policy course_terms_insert on public.course_terms for insert to authenticated with check(private.current_role() in ('dean','academic_director','chair','program_lead') and exists(select 1 from public.courses c where c.id=course_id and private.can_access_unit(c.organization_unit_id)));
create policy course_terms_update on public.course_terms for update to authenticated using(private.can_manage_course_term(id)) with check(private.can_manage_course_term(id));
create policy course_terms_delete on public.course_terms for delete to authenticated using(private.can_manage_course_term(id));
create policy targets_read on public.grade_submission_targets for select to authenticated using(private.can_access_tracker(tracker_id) and private.can_access_course_term(course_term_id));
create policy targets_manage on public.grade_submission_targets for all to authenticated using(private.can_manage_tracker(tracker_id)) with check(private.can_manage_tracker(tracker_id));
create policy uploads_read on public.grade_uploads for select to authenticated using(private.can_access_course_term(course_term_id));
create policy uploads_insert on public.grade_uploads for insert to authenticated with check(private.can_submit_course_term(course_term_id) and uploaded_by=(select auth.uid()));
create policy uploads_update on public.grade_uploads for update to authenticated using(private.can_submit_course_term(course_term_id)) with check(private.can_submit_course_term(course_term_id));
create policy entries_read on public.grade_entries for select to authenticated using(exists(select 1 from public.grade_uploads gu where gu.id=grade_upload_id and private.can_access_course_term(gu.course_term_id)));
create policy entries_insert on public.grade_entries for insert to authenticated with check(exists(select 1 from public.grade_uploads gu where gu.id=grade_upload_id and private.can_submit_course_term(gu.course_term_id) and gu.uploaded_by=(select auth.uid())));
create policy overrides_read on public.submission_status_overrides for select to authenticated using(exists(select 1 from public.course_terms ct where ct.course_id=course_id and ct.term_code=term_code and private.can_access_course_term(ct.id)));
create policy overrides_insert on public.submission_status_overrides for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.course_terms ct where ct.course_id=course_id and ct.term_code=term_code and private.can_submit_course_term(ct.id)));
create policy overrides_update on public.submission_status_overrides for update to authenticated using(exists(select 1 from public.course_terms ct where ct.course_id=course_id and ct.term_code=term_code and private.can_submit_course_term(ct.id))) with check(exists(select 1 from public.course_terms ct where ct.course_id=course_id and ct.term_code=term_code and private.can_submit_course_term(ct.id)));
create policy settings_read on public.grade_benchmark_settings for select to authenticated using(private.is_active_staff());
create policy settings_dean on public.grade_benchmark_settings for all to authenticated using(private.current_role()='dean') with check(private.current_role()='dean');
create policy audit_read on public.audit_events for select to authenticated using(private.current_role() in ('dean','academic_director'));
create policy audit_insert on public.audit_events for insert to authenticated with check(actor_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('tracker-documents','tracker-documents',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
 ('course-target-imports','course-target-imports',false,2097152,array['text/csv','application/vnd.ms-excel'])
on conflict(id) do nothing;
create policy tracker_document_read on storage.objects for select to authenticated using(bucket_id='tracker-documents' and (storage.foldername(name))[1]~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and private.can_access_tracker(((storage.foldername(name))[1])::uuid));
create policy tracker_document_insert on storage.objects for insert to authenticated with check(bucket_id='tracker-documents' and (storage.foldername(name))[1]~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and private.can_manage_tracker(((storage.foldername(name))[1])::uuid));
create policy tracker_document_delete on storage.objects for delete to authenticated using(bucket_id='tracker-documents' and (storage.foldername(name))[1]~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and private.can_manage_tracker(((storage.foldername(name))[1])::uuid));
create policy target_import_read on storage.objects for select to authenticated using(bucket_id='course-target-imports' and private.current_role() in ('dean','academic_director','chair','program_lead'));
create policy target_import_insert on storage.objects for insert to authenticated with check(bucket_id='course-target-imports' and private.current_role() in ('dean','academic_director','chair','program_lead'));
create policy target_import_delete on storage.objects for delete to authenticated using(bucket_id='course-target-imports' and private.current_role() in ('dean','academic_director','chair','program_lead'));

alter publication supabase_realtime add table public.trackers,public.stages,public.documents,public.grade_submission_targets,public.grade_uploads,public.submission_status_overrides;

create function private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,full_name,email,role,is_active) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),new.email,'instructor',false) on conflict(id) do nothing;
  return new;
end $$;
revoke all on function private.handle_new_user() from public,anon,authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
