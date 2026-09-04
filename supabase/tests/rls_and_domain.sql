begin;
select plan(15);

select has_table('public','trackers','trackers exists');
select has_table('public','grade_entries','de-identified grade entries exist');
select has_function('public','submit_grade_upload',array['uuid','numeric[]'],'grade upload RPC exists');
select col_is_pk('public','profiles','id','profiles use auth user primary key');
select ok((select relrowsecurity from pg_class where oid='public.trackers'::regclass),'trackers RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.grade_entries'::regclass),'grade entries RLS enabled');
select results_eq($$select count(*)::bigint from public.academic_terms where is_current$$,array[1::bigint],'one current term');
select results_eq($$select average_threshold::numeric from public.grade_benchmark_settings where scope='faculty'$$,array[70::numeric],'prototype average threshold seeded');
select throws_ok($$insert into public.stages(tracker_id,title,due_date,is_required,status,sort_order,created_by) values('20000000-0000-0000-0000-000000000001','Invalid','2026-12-01',true,'skipped',99,'00000000-0000-0000-0000-000000000001')$$,'23514',null,'required stages cannot be skipped');
select throws_ok($$insert into public.grade_entries(grade_upload_id,source_row,final_grade) values(gen_random_uuid(),1,50)$$,'23503',null,'orphan grade entries rejected');

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select results_eq($$select count(*)::bigint from public.trackers$$,array[3::bigint],'Dean can read every tracker');

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select results_eq($$select count(*)::bigint from public.trackers$$,array[1::bigint],'Instructor sees only an assigned tracker');
select results_eq($$select count(*)::bigint from public.course_terms$$,array[1::bigint],'Instructor sees only their assigned course term');
select lives_ok($$select public.submit_grade_upload('50000000-0000-0000-0000-000000000001',array[85,75,65,45]::numeric[])$$,'Instructor can submit de-identified grades for their course');
select throws_ok($$select public.submit_grade_upload('50000000-0000-0000-0000-000000000002',array[85,75]::numeric[])$$,'42501','Not authorized for this course term','Instructor cannot submit grades for another course');
reset role;

select * from finish();
rollback;
