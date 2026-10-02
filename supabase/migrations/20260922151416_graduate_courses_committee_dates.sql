alter table public.graduate_students
  add column thesis_submission_date date,
  add column committee_members text[] not null default '{}',
  add column committee_chair text not null default '' check (length(committee_chair) <= 200),
  add column university_examiner text not null default '' check (length(university_examiner) <= 200),
  add constraint graduate_submission_schedule check (thesis_submission_date is null or
    (thesis_submission_date >= start_date and (defence_date is null or thesis_submission_date <= defence_date))),
  add constraint graduate_committee_members_size check (cardinality(committee_members) <= 12 and length(array_to_string(committee_members,',')) <= 2400 and array_position(committee_members,null) is null),
  add constraint graduate_chair_is_member check (committee_chair='' or committee_chair=supervisor_name or committee_chair=co_supervisor_name or committee_chair=any(committee_members));
grant update(thesis_submission_date,committee_members,committee_chair,university_examiner) on public.graduate_students to authenticated;

alter table public.graduate_task_records
  add column course_semester_start date,
  add constraint graduate_course_semester check (course_semester_start is null or
    (task_key ~ '^course:[1-5]$' and extract(day from course_semester_start)=1
      and extract(month from course_semester_start) in (1,5,9)
      and expected_on is not null and expected_on=(course_semester_start+interval '4 months'-interval '1 day')::date));
-- Existing course dates are retained until the user explicitly assigns a semester.
