/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { demoCourses, demoImportantDates, demoProfiles, demoTrackers, demoTrackerTemplates } from '../lib/demo-data';
import { gradeMetrics, normalizeStageLinkUrl } from '../lib/domain';
import { demoMode, supabase } from '../lib/supabase';
import type { AcademicTermDraft, AppSettings, Course, CourseEditDraft, ImportantDate, ImportantDateDraft, Profile, Stage, SubmissionOverride, Tracker, TrackerTemplate, TrackerTemplateDraft } from '../lib/types';
import { useAuth } from './auth';

interface DataValue {
  trackers: Tracker[];
  courses: Course[];
  profiles: Profile[];
  templates: TrackerTemplate[];
  importantDates: ImportantDate[];
  overrides: Record<string, SubmissionOverride>;
  settings: AppSettings;
  currentTerm: string;
  terms: string[];
  loading: boolean;
  error?: string;
  refresh(): Promise<void>;
  saveTracker(value: Partial<Tracker> & Pick<Tracker, 'title' | 'type' | 'category' | 'description'>): Promise<string>;
  createTrackerFromTemplate(templateId: string, anchorDate: string, value: Pick<Tracker, 'title' | 'description'>): Promise<string>;
  deleteTracker(id: string): Promise<void>;
  saveTemplate(value: TrackerTemplateDraft): Promise<string>;
  deleteTemplate(id: string): Promise<void>;
  saveStage(trackerId: string, stage: Omit<Stage, 'documents'>): Promise<void>;
  deleteStage(trackerId: string, stageId: string): Promise<void>;
  createAcademicTerm(value: AcademicTermDraft): Promise<string>;
  deleteCourseTermGrades(courseId: string, termCode: string): Promise<number>;
  updateCourse(courseId: string, termCode: string, value: CourseEditDraft): Promise<void>;
  removeCourse(courseId: string, termCode: string, scope: 'term' | 'history'): Promise<void>;
  submitGrades(courseCode: string, courseTitle: string | undefined, termCode: string, grades: number[]): Promise<{ duplicate: boolean; courseId: string; courseCode: string; createdCourse: boolean }>;
  setOverride(courseId: string, termCode: string, value?: 'submitted' | 'outstanding', reason?: string): Promise<void>;
  importTargets(trackerId: string, rows: Array<{ CourseCode: string; CourseTitle: string; Instructor: string; Department: string; InstructorEmail?: string }>, sourceFile?: File): Promise<void>;
  saveSettings(settings: AppSettings): Promise<void>;
  importImportantDates(academicYear: string, sourceFileName: string, rows: ImportantDateDraft[]): Promise<number>;
  saveImportantDate(id: string, value: ImportantDateDraft): Promise<void>;
  deleteImportantDate(id: string): Promise<void>;
  inviteUser(payload: Record<string, unknown>): Promise<void>;
  manageUser(payload: { action: 'update-access' | 'activate' | 'deactivate'; userId: string; role?: string; organizationUnit?: string }): Promise<void>;
  uploadDocument(trackerId: string, stageId: string, file: File): Promise<void>;
  addStageLink(trackerId: string, stageId: string, title: string, url: string): Promise<void>;
  deleteStageLink(id: string): Promise<void>;
}

const DataContext = createContext<DataValue | null>(null);
const clone = <T,>(value: T): T => structuredClone(value);
const DEMO_TERMS_KEY='fbit:demo-academic-terms';

function storedDemoTerms(){
  try{const value=JSON.parse(localStorage.getItem(DEMO_TERMS_KEY)??'[]');return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[];}catch{return[];}
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [trackers, setTrackers] = useState<Tracker[]>(clone(demoTrackers));
  const [courses, setCourses] = useState<Course[]>(clone(demoCourses));
  const [profiles, setProfiles] = useState<Profile[]>(clone(demoProfiles));
  const [templates, setTemplates] = useState<TrackerTemplate[]>(clone(demoTrackerTemplates));
  const [importantDates, setImportantDates] = useState<ImportantDate[]>(clone(demoImportantDates));
  const [overrides, setOverrides] = useState<Record<string, SubmissionOverride>>({});
  const [settings, setSettingsState] = useState<AppSettings>({ averageThreshold: 70, passRateThreshold: 80 });
  const [terms, setTerms] = useState<string[]>(demoMode ? [...new Set([...storedDemoTerms(),...Object.keys(demoCourses[0]?.terms ?? {})])] : []);
  const [currentTerm, setCurrentTerm] = useState(demoMode ? 'F26' : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (demoMode || !profile) return;
    setLoading(true); setError(undefined);
    const [trackersResult, coursesResult, profilesResult, termsResult, settingsResult, overridesResult, templatesResult, importantDatesResult] = await Promise.all([
      supabase.from('trackers').select('*, stages(*, documents(*), stage_links(*))').order('created_at'),
      supabase.from('courses').select('*, course_terms(*, instructor:profiles!course_terms_instructor_id_fkey(full_name,email), grade_uploads(*))').order('code'),
      ['dean','academic_director','chair','program_lead'].includes(profile.role) ? supabase.from('profiles').select('*, organization_units!profiles_organization_unit_id_fkey(name)').order('full_name') : Promise.resolve({ data: [], error: null }),
      supabase.from('academic_terms').select('*').order('starts_on', { ascending: false }),
      supabase.from('grade_benchmark_settings').select('*').is('tracker_id', null).maybeSingle(),
      supabase.from('submission_status_overrides').select('*').is('cleared_at', null),
      supabase.from('tracker_templates').select('*, owner:profiles!tracker_templates_owner_id_fkey(full_name), tracker_template_stages(*)').order('scope').order('name'),
      supabase.from('important_dates').select('*').order('academic_year', { ascending:false }).order('sort_order'),
    ]);
    const firstError = [trackersResult, coursesResult, profilesResult, termsResult, settingsResult, overridesResult, templatesResult, importantDatesResult].find((result: any) => result.error)?.error;
    if (firstError) { setError(firstError.message); setLoading(false); return; }
    setTrackers((trackersResult.data ?? []).map((row: any) => ({
      id: row.id, title: row.title, type: row.type.replace('_', '-'), category: row.category, description: row.description,
      organizationUnitId: row.organization_unit_id, createdAt: row.created_at,
      averageThreshold: row.average_threshold, passRateThreshold: row.pass_rate_threshold,
      stages: (row.stages ?? []).sort((a: any,b: any) => a.sort_order-b.sort_order).map((s: any) => ({ id:s.id,title:s.title,description:s.description,dueDate:s.due_date,isRequired:s.is_required,status:s.status.replace('_','-'),sortOrder:s.sort_order,documents:(s.documents??[]).map((d:any)=>({id:d.id,name:d.file_name,mimeType:d.mime_type,size:d.size_bytes,createdAt:d.created_at})),links:(s.stage_links??[]).map((link:any)=>({id:link.id,title:link.title,url:link.url,createdAt:link.created_at})) })),
    })));
    setCourses((coursesResult.data ?? []).map((row: any) => ({
      id: row.id, code: row.code, title: row.title, department: row.department,
      instructor: row.course_terms?.[0]?.instructor?.full_name ?? 'Unassigned', instructorEmail: row.course_terms?.[0]?.instructor?.email,
      termDetails: Object.fromEntries((row.course_terms ?? []).map((ct:any)=>[ct.term_code,{section:ct.section??'',instructorId:ct.instructor_id??undefined,instructor:ct.instructor?.full_name??'Unassigned',instructorEmail:ct.instructor?.email??undefined}])),
      terms: Object.fromEntries((row.course_terms ?? []).map((ct: any) => {
        const upload = (ct.grade_uploads ?? []).find((u: any) => u.is_active);
        return [ct.term_code, upload ? { average:Number(upload.class_average),passRate:Number(upload.pass_rate),enrolled:upload.enrolled_count,distribution:upload.distribution_json,uploadVersion:upload.version,uploadedAt:upload.created_at } : undefined];
      })),
    })));
    setProfiles((profilesResult.data ?? []).map((row: any) => ({ id:row.id,fullName:row.full_name,email:row.email,role:row.role,organizationUnitId:row.organization_unit_id,organizationUnit:row.organization_units?.name,isActive:row.is_active })));
    const termRows = termsResult.data ?? [];
    setTerms(termRows.map((term: any) => term.code));
    const activeTerm = termRows.find((term: any) => term.is_current);
    if (activeTerm) setCurrentTerm(activeTerm.code);
    if (settingsResult.data) setSettingsState({ averageThreshold:Number(settingsResult.data.average_threshold), passRateThreshold:Number(settingsResult.data.pass_rate_threshold) });
    const mapped: Record<string, SubmissionOverride> = {};
    (overridesResult.data ?? []).forEach((row: any) => { mapped[`${row.course_id}_${row.term_code}`] = { value:row.status,reason:row.reason,createdAt:row.created_at,createdBy:row.created_by }; });
    setTemplates((templatesResult.data ?? []).map((row: any) => ({
      id:row.id,name:row.name,description:row.description,type:row.type.replace('_','-'),category:row.category,scope:row.scope,
      ownerId:row.owner_id,ownerName:row.owner?.full_name,createdAt:row.created_at,
      stages:(row.tracker_template_stages ?? []).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((stage:any)=>({id:stage.id,title:stage.title,description:stage.description,dueOffsetDays:stage.due_offset_days,isRequired:stage.is_required,sortOrder:stage.sort_order})),
    })));
    setImportantDates((importantDatesResult.data ?? []).map((row:any)=>({id:row.id,academicYear:row.academic_year,semester:row.semester,startsOn:row.starts_on,endsOn:row.ends_on,shortName:row.short_name,description:row.description,sortOrder:row.sort_order,sourceFileName:row.source_file_name,updatedAt:row.updated_at})));
    setOverrides(mapped); setLoading(false);
  }, [profile]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (demoMode || !profile) return;
    const channel = supabase.channel('fbit-live').on('postgres_changes', { event:'*', schema:'public' }, () => void refresh()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile, refresh]);

  const value = useMemo<DataValue>(() => ({ trackers, courses, profiles, templates, importantDates, overrides, settings, currentTerm, terms, loading, error, refresh,
    async saveTracker(input) {
      if (demoMode) {
        const id = input.id ?? crypto.randomUUID();
        setTrackers((all) => input.id ? all.map((t) => t.id === id ? { ...t, ...input } as Tracker : t) : [...all, { ...input, id, createdAt:new Date().toISOString(), stages:[] } as Tracker]);
        return id;
      }
      const payload = { title:input.title,type:input.type.replace('-','_'),category:input.category,description:input.description,organization_unit_id:input.organizationUnitId??profile?.organizationUnitId,average_threshold:input.averageThreshold,pass_rate_threshold:input.passRateThreshold };
      const query = input.id ? supabase.from('trackers').update(payload).eq('id', input.id) : supabase.from('trackers').insert(payload);
      const { data, error } = await query.select('id').single(); if (error) throw error; await refresh(); return data.id;
    },
    async createTrackerFromTemplate(templateId, anchorDate, input) {
      if (demoMode) {
        const template=templates.find((item)=>item.id===templateId);if(!template)throw new Error('Template not found or not available.');
        const id=crypto.randomUUID();const anchor=new Date(`${anchorDate}T00:00:00Z`);
        const stages=template.stages.map((stage)=>({id:crypto.randomUUID(),title:stage.title,description:stage.description,dueDate:new Date(anchor.getTime()+stage.dueOffsetDays*86_400_000).toISOString().slice(0,10),isRequired:stage.isRequired,status:'pending' as const,sortOrder:stage.sortOrder,documents:[],links:[]}));
        setTrackers((all)=>[...all,{id,title:input.title,description:input.description||template.description,type:template.type,category:template.category,createdAt:new Date().toISOString(),stages}]);return id;
      }
      const{data,error}=await supabase.rpc('create_tracker_from_template',{p_template_id:templateId,p_title:input.title,p_description:input.description,p_anchor_date:anchorDate});if(error)throw error;await refresh();return String(data);
    },
    async deleteTracker(id) { if (demoMode) setTrackers((all)=>all.filter((t)=>t.id!==id)); else { const {error}=await supabase.from('trackers').delete().eq('id',id); if(error) throw error; await refresh(); } },
    async saveTemplate(input) {
      if(demoMode){
        if(input.scope==='faculty'&&profile?.role!=='dean')throw new Error('Only deans can create faculty templates.');
        const id=input.id??crypto.randomUUID();setTemplates((all)=>{const current=all.find((item)=>item.id===id);const next:TrackerTemplate={id,name:input.name,description:input.description,type:input.type,category:input.category,scope:input.scope,ownerId:current?.ownerId??profile?.id??'demo',ownerName:current?.ownerName??profile?.fullName,createdAt:current?.createdAt??new Date().toISOString(),stages:input.stages.map((stage,index)=>({...stage,id:current?.stages[index]?.id??crypto.randomUUID(),sortOrder:index+1}))};return current?all.map((item)=>item.id===id?next:item):[...all,next]});return id;
      }
      const{data,error}=await supabase.rpc('save_tracker_template',{p_template_id:input.id??null,p_name:input.name,p_description:input.description,p_type:input.type.replace('-','_'),p_category:input.category,p_scope:input.scope,p_stages:input.stages.map((stage)=>({title:stage.title,description:stage.description,due_offset_days:stage.dueOffsetDays,is_required:stage.isRequired}))});if(error)throw error;await refresh();return String(data);
    },
    async deleteTemplate(id) {if(demoMode){setTemplates((all)=>all.filter((item)=>item.id!==id));return;}const{error}=await supabase.from('tracker_templates').delete().eq('id',id);if(error)throw error;await refresh();},
    async saveStage(trackerId, stage) {
      if (demoMode) { setTrackers((all)=>all.map((t)=>t.id===trackerId?{...t,stages:t.stages.some((s)=>s.id===stage.id)?t.stages.map((s)=>s.id===stage.id?{...stage,documents:s.documents,links:s.links??[]}:s):[...t.stages,{...stage,id:stage.id||crypto.randomUUID(),documents:[],links:[]}]}:t)); return; }
      const payload={tracker_id:trackerId,title:stage.title,description:stage.description,due_date:stage.dueDate,is_required:stage.isRequired,status:stage.status.replace('-','_'),sort_order:stage.sortOrder};
      const {error}=stage.id?await supabase.from('stages').update(payload).eq('id',stage.id):await supabase.from('stages').insert(payload);if(error)throw error;await refresh();
    },
    async deleteStage(trackerId, stageId) { if(demoMode)setTrackers((all)=>all.map((t)=>t.id===trackerId?{...t,stages:t.stages.filter((s)=>s.id!==stageId)}:t));else{const{error}=await supabase.from('stages').delete().eq('id',stageId);if(error)throw error;await refresh();} },
    async createAcademicTerm(input) {
      const code=input.code.trim().toUpperCase();
      if(demoMode){
        if(!['dean','academic_director'].includes(profile?.role??''))throw new Error('Only deans and academic directors can create academic terms.');
        if(terms.includes(code))throw new Error('That academic term already exists.');
        setTerms((all)=>{const next=[code,...all];localStorage.setItem(DEMO_TERMS_KEY,JSON.stringify(next));return next;});
        if(input.isCurrent)setCurrentTerm(code);
        return code;
      }
      const{data,error}=await supabase.rpc('create_academic_term',{p_code:code,p_name:input.name,p_starts_on:input.startsOn,p_ends_on:input.endsOn,p_is_current:input.isCurrent});if(error)throw error;await refresh();return String(data);
    },
    async deleteCourseTermGrades(courseId,termCode) {
      if(demoMode){const hadData=Boolean(courses.find((item)=>item.id===courseId)?.terms[termCode]);setCourses((all)=>all.map((item)=>item.id===courseId?{...item,terms:{...item.terms,[termCode]:undefined}}:item));return hadData?1:0;}
      const{data,error}=await supabase.rpc('delete_course_term_grades',{p_course_id:courseId,p_term_code:termCode});if(error)throw error;await refresh();return Number(data);
    },
    async updateCourse(courseId,termCode,input) {
      if(demoMode){const instructor=profiles.find(item=>item.id===input.instructorId);setCourses(all=>all.map(course=>course.id===courseId?{...course,code:input.code.trim().toUpperCase(),title:input.title.trim(),department:input.department.trim(),instructor:instructor?.fullName??'Unassigned',instructorEmail:instructor?.email,termDetails:{...(course.termDetails??{}),[termCode]:{section:input.section.trim(),instructorId:instructor?.id,instructor:instructor?.fullName??'Unassigned',instructorEmail:instructor?.email}}}:course));return;}
      const{error}=await supabase.rpc('update_course_details',{p_course_id:courseId,p_term_code:termCode,p_code:input.code,p_title:input.title,p_department:input.department,p_section:input.section,p_instructor_id:input.instructorId??null});if(error)throw error;await refresh();
    },
    async removeCourse(courseId,termCode,scope) {
      if(demoMode){if(scope==='history'){setCourses(all=>all.filter(course=>course.id!==courseId));setOverrides(all=>Object.fromEntries(Object.entries(all).filter(([key])=>!key.startsWith(`${courseId}_`))));}else{setCourses(all=>all.map(course=>course.id===courseId?{...course,terms:Object.fromEntries(Object.entries(course.terms).filter(([key])=>key!==termCode)),termDetails:Object.fromEntries(Object.entries(course.termDetails??{}).filter(([key])=>key!==termCode))}:course));setOverrides(all=>Object.fromEntries(Object.entries(all).filter(([key])=>key!==`${courseId}_${termCode}`)));}return;}
      const{error}=await supabase.rpc('remove_course_scope',{p_course_id:courseId,p_term_code:termCode,p_scope:scope});if(error)throw error;await refresh();
    },
    async submitGrades(courseCode, courseTitle, termCode, grades) {
      if(demoMode){const existing=courses.find((item)=>item.code.replace(/[^A-Z0-9]/gi,'').toUpperCase()===courseCode.replace(/[^A-Z0-9]/gi,'').toUpperCase());const courseId=existing?.id??crypto.randomUUID();const canonical=courseCode;const metrics=gradeMetrics(grades);const fingerprint=grades.join(',');const current=existing?.terms[termCode];if(existing&&current?.gradeFingerprint===fingerprint)return{duplicate:true,courseId,courseCode:existing.code,createdCourse:false};setCourses((all)=>{const found=all.find((item)=>item.id===courseId);if(found)return all.map((item)=>item.id===courseId?{...item,terms:{...item.terms,[termCode]:{...metrics,uploadVersion:(item.terms[termCode]?.uploadVersion??0)+1,uploadedAt:new Date().toISOString(),gradeFingerprint:fingerprint}}}:item);return[...all,{id:courseId,code:canonical,title:courseTitle||canonical,department:canonical.slice(0,4),instructor:profile?.fullName??'Current user',instructorEmail:profile?.email,terms:{[termCode]:{...metrics,uploadVersion:1,uploadedAt:new Date().toISOString(),gradeFingerprint:fingerprint}}}]});return{duplicate:false,courseId,courseCode:canonical,createdCourse:!existing};}
      const {data:resolved,error:resolveError}=await supabase.rpc('resolve_grade_course',{p_course_code:courseCode,p_course_title:courseTitle??'',p_term_code:termCode});if(resolveError)throw resolveError;
      if(!resolved||typeof resolved!=='object'||Array.isArray(resolved))throw new Error('The course could not be resolved.');
      const {data,error}=await supabase.rpc('submit_grade_upload',{p_course_term_id:String(resolved.course_term_id),p_grades:grades});if(error)throw error;await refresh();return{duplicate:Boolean(data&&typeof data==='object'&&!Array.isArray(data)&&data.duplicate),courseId:String(resolved.course_id),courseCode:String(resolved.course_code),createdCourse:Boolean(resolved.created_course)};
    },
    async setOverride(courseId, termCode, status, reason='') {
      const key=`${courseId}_${termCode}`;
      if(demoMode){setOverrides((all)=>{const next={...all};if(!status)delete next[key];else next[key]={value:status,reason,createdAt:new Date().toISOString(),createdBy:profile?.id??'demo'};return next;});return;}
      const {error}=status?await supabase.from('submission_status_overrides').insert({course_id:courseId,term_code:termCode,status,reason}):await supabase.from('submission_status_overrides').update({cleared_at:new Date().toISOString(),cleared_by:profile?.id}).eq('course_id',courseId).eq('term_code',termCode).is('cleared_at',null);if(error)throw error;await refresh();
    },
    async importTargets(trackerId, rows, sourceFile) {
      if(demoMode){setCourses((all)=>{const byCode=new Map(all.map((c)=>[c.code,c]));rows.forEach((r)=>{if(!byCode.has(r.CourseCode))byCode.set(r.CourseCode,{id:crypto.randomUUID(),code:r.CourseCode,title:r.CourseTitle,department:r.Department,instructor:r.Instructor,instructorEmail:r.InstructorEmail,terms:{}});});return [...byCode.values()];});return;}
      const {error}=await supabase.rpc('import_grade_targets',{p_tracker_id:trackerId,p_rows:rows,p_term_code:currentTerm});if(error)throw error;
      if(sourceFile){const path=`${trackerId}/${crypto.randomUUID()}-${sourceFile.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const{error:uploadError}=await supabase.storage.from('course-target-imports').upload(path,sourceFile,{upsert:false,contentType:'text/csv'});if(uploadError)throw uploadError;const{error:documentError}=await supabase.from('documents').insert({tracker_id:trackerId,stage_id:null,bucket_id:'course-target-imports',object_path:path,file_name:sourceFile.name,mime_type:'text/csv',size_bytes:sourceFile.size});if(documentError)throw documentError;}
      await refresh();
    },
    async saveSettings(next) { if(demoMode)setSettingsState(next);else{const{error}=await supabase.from('grade_benchmark_settings').upsert({scope:'faculty',tracker_id:null,average_threshold:next.averageThreshold,pass_rate_threshold:next.passRateThreshold},{onConflict:'scope'});if(error)throw error;await refresh();} },
    async importImportantDates(academicYear, sourceFileName, rows) {if(demoMode){setImportantDates((all)=>[...all.filter((item)=>item.academicYear!==academicYear),...rows.map((row)=>({id:crypto.randomUUID(),academicYear,sourceFileName,updatedAt:new Date().toISOString(),...row}))]);return rows.length;}const{data,error}=await supabase.rpc('import_important_dates',{p_academic_year:academicYear,p_source_file_name:sourceFileName,p_rows:rows.map((row)=>({semester:row.semester,starts_on:row.startsOn,ends_on:row.endsOn,short_name:row.shortName,description:row.description}))});if(error)throw error;await refresh();return Number(data);},
    async saveImportantDate(id, input) {if(demoMode){setImportantDates((all)=>all.map((item)=>item.id===id?{...item,...input,updatedAt:new Date().toISOString()}:item));return;}const{error}=await supabase.from('important_dates').update({semester:input.semester,starts_on:input.startsOn,ends_on:input.endsOn,short_name:input.shortName,description:input.description,sort_order:input.sortOrder}).eq('id',id);if(error)throw error;await refresh();},
    async deleteImportantDate(id) {if(demoMode){setImportantDates((all)=>all.filter((item)=>item.id!==id));return;}const{error}=await supabase.from('important_dates').delete().eq('id',id);if(error)throw error;await refresh();},
    async inviteUser(payload) { if(demoMode){setProfiles((all)=>[...all,{id:crypto.randomUUID(),fullName:String(payload.fullName),email:String(payload.email),role:payload.role as any,organizationUnit:String(payload.organizationUnit),isActive:true}]);return;}const{error}=await supabase.functions.invoke('manage-user',{body:{action:'invite',...payload}});if(error)throw error;await refresh(); },
    async manageUser(payload) { if(demoMode){setProfiles((all)=>all.map((item)=>item.id===payload.userId?{...item,role:(payload.role as any)??item.role,organizationUnit:payload.organizationUnit??item.organizationUnit,isActive:payload.action==='activate'?true:payload.action==='deactivate'?false:item.isActive}:item));return;}const{error}=await supabase.functions.invoke('manage-user',{body:payload});if(error)throw error;await refresh(); },
    async uploadDocument(trackerId, stageId, file) {
      if(!['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type))throw new Error('Only PDF, DOC, and DOCX files are allowed.');
      if(file.size>10*1024*1024)throw new Error('File exceeds the 10 MB limit.');
      if(demoMode){setTrackers((all)=>all.map((t)=>t.id===trackerId?{...t,stages:t.stages.map((s)=>s.id===stageId?{...s,documents:[...s.documents,{id:crypto.randomUUID(),name:file.name,mimeType:file.type,size:file.size,createdAt:new Date().toISOString()}]}:s)}:t));return;}
      const path=`${trackerId}/${stageId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const{error:uploadError}=await supabase.storage.from('tracker-documents').upload(path,file,{upsert:false});if(uploadError)throw uploadError;
      const{error}=await supabase.from('documents').insert({tracker_id:trackerId,stage_id:stageId,bucket_id:'tracker-documents',object_path:path,file_name:file.name,mime_type:file.type,size_bytes:file.size});if(error)throw error;await refresh();
    },
    async addStageLink(trackerId, stageId, title, url) {
      const cleanTitle=title.trim();const cleanUrl=normalizeStageLinkUrl(url);if(cleanTitle.length<2||cleanTitle.length>160)throw new Error('Link name must be between 2 and 160 characters.');
      if(demoMode){if(trackers.some((tracker)=>tracker.id===trackerId&&tracker.stages.some((stage)=>stage.id===stageId&&(stage.links??[]).some((link)=>link.url===cleanUrl))))throw new Error('That URL is already attached to this stage.');setTrackers((all)=>all.map((tracker)=>tracker.id===trackerId?{...tracker,stages:tracker.stages.map((stage)=>stage.id===stageId?{...stage,links:[...(stage.links??[]),{id:crypto.randomUUID(),title:cleanTitle,url:cleanUrl,createdAt:new Date().toISOString()}]}:stage)}:tracker));return;}
      const{error}=await supabase.from('stage_links').insert({tracker_id:trackerId,stage_id:stageId,title:cleanTitle,url:cleanUrl});if(error){if(error.code==='23505')throw new Error('That URL is already attached to this stage.');throw error;}await refresh();
    },
    async deleteStageLink(id) {if(demoMode){setTrackers((all)=>all.map((tracker)=>({...tracker,stages:tracker.stages.map((stage)=>({...stage,links:(stage.links??[]).filter((link)=>link.id!==id)}))})));return;}const{error}=await supabase.from('stage_links').delete().eq('id',id);if(error)throw error;await refresh();},
  }), [trackers,courses,profiles,templates,importantDates,overrides,settings,currentTerm,terms,loading,error,refresh,profile]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(){const value=useContext(DataContext);if(!value)throw new Error('useData must be used in DataProvider');return value;}
