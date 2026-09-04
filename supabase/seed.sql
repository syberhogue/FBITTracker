insert into public.organization_units(id,name,code) values
 ('10000000-0000-0000-0000-000000000001','Faculty of Business and Information Technology','FBIT'),
 ('10000000-0000-0000-0000-000000000002','Information Technology','IT'),
 ('10000000-0000-0000-0000-000000000003','Business Administration','BUSI')
on conflict do nothing;

insert into public.academic_terms(code,name,starts_on,ends_on,is_current) values
 ('F24','Fall 2024','2024-09-01','2024-12-31',false),
 ('W25','Winter 2025','2025-01-01','2025-04-30',false),
 ('S25','Spring/Summer 2025','2025-05-01','2025-08-31',false),
 ('F25','Fall 2025','2025-09-01','2025-12-31',false),
 ('W26','Winter 2026','2026-01-01','2026-04-30',false),
 ('F26','Fall 2026','2026-09-01','2026-12-31',true)
on conflict do nothing;

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  confirmation_token,recovery_token,email_change_token_new,email_change,
  phone_change_token,email_change_token_current,reauthentication_token,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
)
values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','morgan.ellis@ontariotechu.ca',crypt('LocalDemo2026!',gen_salt('bf')),now(),'','','','','','','','{"provider":"email","providers":["email"]}','{"full_name":"Dr. Morgan Ellis"}',now(),now()),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','alex.mercer@ontariotechu.ca',crypt('LocalDemo2026!',gen_salt('bf')),now(),'','','','','','','','{"provider":"email","providers":["email"]}','{"full_name":"Dr. Alex Mercer"}',now(),now()),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','karen.vance@ontariotechu.ca',crypt('LocalDemo2026!',gen_salt('bf')),now(),'','','','','','','','{"provider":"email","providers":["email"]}','{"full_name":"Prof. Karen Vance"}',now(),now())
on conflict(id) do nothing;

update public.profiles set role='dean',organization_unit_id='10000000-0000-0000-0000-000000000001',is_active=true where id='00000000-0000-0000-0000-000000000001';
update public.profiles set role='instructor',organization_unit_id='10000000-0000-0000-0000-000000000002',is_active=true where id='00000000-0000-0000-0000-000000000002';
update public.profiles set role='chair',organization_unit_id='10000000-0000-0000-0000-000000000003',is_active=true where id='00000000-0000-0000-0000-000000000003';
insert into public.profile_scopes values
 ('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003',now()) on conflict do nothing;

insert into public.grade_benchmark_settings(scope,average_threshold,pass_rate_threshold,updated_by)
values('faculty',70,80,'00000000-0000-0000-0000-000000000001') on conflict(scope) do nothing;

insert into public.trackers(id,title,type,category,description,organization_unit_id,created_by,created_at) values
 ('20000000-0000-0000-0000-000000000001','Fall 2026 Grade Submission Portal','grade_submission','Administrative','Faculty-wide portal to upload, compare, and analyze Fall 2026 course grade submissions against historical standards.','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','2026-08-15'),
 ('20000000-0000-0000-0000-000000000002','MSc Defense Tracker','general','Academic','Scheduling and milestone tracking for a Master''s thesis defense.','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','2026-08-20'),
 ('20000000-0000-0000-0000-000000000003','ACM CHI 2027 Research Paper','general','Research','Timeline for the FBIT HCI lab paper submission.','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','2026-08-25')
on conflict do nothing;

insert into public.stages(id,tracker_id,title,description,due_date,is_required,status,sort_order,created_by) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Initial Reminder Email','Send instructions to all instructors.','2026-11-20',true,'completed',1,'00000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Final Exams End','End of official examination period.','2026-12-15',true,'pending',2,'00000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','Follow-up Email','Target instructors with outstanding submissions.','2026-12-18',false,'pending',3,'00000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','Grades Due to Registrar','Hard deadline to push grades to MyCampus.','2026-12-20',true,'pending',4,'00000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000002','Submit Draft to Supervisor','Full thesis draft for preliminary review.','2026-09-10',true,'in_progress',1,'00000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000002','Oral Defense','Live oral thesis examination.','2026-10-23',true,'pending',2,'00000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.courses(id,code,title,department,organization_unit_id) values
 ('40000000-0000-0000-0000-000000000001','INFT 1020U','Intro to Data Structures & Algorithms','Information Technology','10000000-0000-0000-0000-000000000002'),
 ('40000000-0000-0000-0000-000000000002','BUSI 1100U','Introduction to Business Operations','Business Administration','10000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into public.course_terms(id,course_id,term_code,instructor_id) values
 ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','F26','00000000-0000-0000-0000-000000000002'),
 ('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','F26','00000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into public.grade_submission_targets(tracker_id,course_term_id,created_by) values
 ('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001')
on conflict do nothing;
