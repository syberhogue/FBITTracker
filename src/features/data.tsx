/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { demoCourses, demoProfiles, demoTrackers } from '../lib/demo-data';
import { gradeMetrics } from '../lib/domain';
import { demoMode, supabase } from '../lib/supabase';
import type { AppSettings, Course, Profile, Stage, SubmissionOverride, Tracker } from '../lib/types';
import { useAuth } from './auth';

interface DataValue {
  trackers: Tracker[];
  courses: Course[];
  profiles: Profile[];
  overrides: Record<string, SubmissionOverride>;
  settings: AppSettings;
  currentTerm: string;
  terms: string[];
  loading: boolean;
  error?: string;
  refresh(): Promise<void>;
  saveTracker(value: Partial<Tracker> & Pick<Tracker, 'title' | 'type' | 'category' | 'description'>): Promise<string>;
  deleteTracker(id: string): Promise<void>;
  saveStage(trackerId: string, stage: Omit<Stage, 'documents'>): Promise<void>;
  deleteStage(trackerId: string, stageId: string): Promise<void>;
  submitGrades(courseId: string, termCode: string, grades: number[]): Promise<void>;
  setOverride(courseId: string, termCode: string, value?: 'submitted' | 'outstanding', reason?: string): Promise<void>;
  importTargets(trackerId: string, rows: Array<{ CourseCode: string; CourseTitle: string; Instructor: string; Department: string; InstructorEmail?: string }>, sourceFile?: File): Promise<void>;
  saveSettings(settings: AppSettings): Promise<void>;
  inviteUser(payload: Record<string, unknown>): Promise<void>;
  manageUser(payload: { action: 'update-access' | 'activate' | 'deactivate'; userId: string; role?: string; organizationUnit?: string }): Promise<void>;
  uploadDocument(trackerId: string, stageId: string, file: File): Promise<void>;
}

const DataContext = createContext<DataValue | null>(null);
const clone = <T,>(value: T): T => structuredClone(value);

export function DataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [trackers, setTrackers] = useState<Tracker[]>(clone(demoTrackers));
  const [courses, setCourses] = useState<Course[]>(clone(demoCourses));
  const [profiles, setProfiles] = useState<Profile[]>(clone(demoProfiles));
  const [overrides, setOverrides] = useState<Record<string, SubmissionOverride>>({});
  const [settings, setSettingsState] = useState<AppSettings>({ averageThreshold: 70, passRateThreshold: 80 });
  const [terms, setTerms] = useState<string[]>(demoMode ? Object.keys(demoCourses[0]?.terms ?? {}) : []);
  const [currentTerm, setCurrentTerm] = useState(demoMode ? 'F26' : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (demoMode || !profile) return;
    setLoading(true); setError(undefined);
    const [trackersResult, coursesResult, profilesResult, termsResult, settingsResult, overridesResult] = await Promise.all([
      supabase.from('trackers').select('*, stages(*, documents(*))').order('created_at'),
      supabase.from('courses').select('*, course_terms(*, instructor:profiles!course_terms_instructor_id_fkey(full_name,email), grade_uploads(*))').order('code'),
      profile.role === 'dean' ? supabase.from('profiles').select('*, organization_units!profiles_organization_unit_id_fkey(name)').order('full_name') : Promise.resolve({ data: [], error: null }),
      supabase.from('academic_terms').select('*').order('starts_on', { ascending: false }),
      supabase.from('grade_benchmark_settings').select('*').is('tracker_id', null).maybeSingle(),
      supabase.from('submission_status_overrides').select('*').is('cleared_at', null),
    ]);
    const firstError = [trackersResult, coursesResult, profilesResult, termsResult, settingsResult, overridesResult].find((result: any) => result.error)?.error;
    if (firstError) { setError(firstError.message); setLoading(false); return; }
    setTrackers((trackersResult.data ?? []).map((row: any) => ({
      id: row.id, title: row.title, type: row.type.replace('_', '-'), category: row.category, description: row.description,
      organizationUnitId: row.organization_unit_id, createdAt: row.created_at,
      averageThreshold: row.average_threshold, passRateThreshold: row.pass_rate_threshold,
      stages: (row.stages ?? []).sort((a: any,b: any) => a.sort_order-b.sort_order).map((s: any) => ({ id:s.id,title:s.title,description:s.description,dueDate:s.due_date,isRequired:s.is_required,status:s.status.replace('_','-'),sortOrder:s.sort_order,documents:(s.documents??[]).map((d:any)=>({id:d.id,name:d.file_name,mimeType:d.mime_type,size:d.size_bytes,createdAt:d.created_at})) })),
    })));
    setCourses((coursesResult.data ?? []).map((row: any) => ({
      id: row.id, code: row.code, title: row.title, department: row.department,
      instructor: row.course_terms?.[0]?.instructor?.full_name ?? 'Unassigned', instructorEmail: row.course_terms?.[0]?.instructor?.email,
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
    setOverrides(mapped); setLoading(false);
  }, [profile]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (demoMode || !profile) return;
    const channel = supabase.channel('fbit-live').on('postgres_changes', { event:'*', schema:'public' }, () => void refresh()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile, refresh]);

  const value = useMemo<DataValue>(() => ({ trackers, courses, profiles, overrides, settings, currentTerm, terms, loading, error, refresh,
    async saveTracker(input) {
      if (demoMode) {
        const id = input.id ?? crypto.randomUUID();
        setTrackers((all) => input.id ? all.map((t) => t.id === id ? { ...t, ...input } as Tracker : t) : [...all, { ...input, id, createdAt:new Date().toISOString(), stages:[] } as Tracker]);
        return id;
      }
      const payload = { title:input.title,type:input.type.replace('-','_'),category:input.category,description:input.description,organization_unit_id:input.organizationUnitId,average_threshold:input.averageThreshold,pass_rate_threshold:input.passRateThreshold };
      const query = input.id ? supabase.from('trackers').update(payload).eq('id', input.id) : supabase.from('trackers').insert(payload);
      const { data, error } = await query.select('id').single(); if (error) throw error; await refresh(); return data.id;
    },
    async deleteTracker(id) { if (demoMode) setTrackers((all)=>all.filter((t)=>t.id!==id)); else { const {error}=await supabase.from('trackers').delete().eq('id',id); if(error) throw error; await refresh(); } },
    async saveStage(trackerId, stage) {
      if (demoMode) { setTrackers((all)=>all.map((t)=>t.id===trackerId?{...t,stages:t.stages.some((s)=>s.id===stage.id)?t.stages.map((s)=>s.id===stage.id?{...stage,documents:s.documents}:s):[...t.stages,{...stage,id:stage.id||crypto.randomUUID(),documents:[]}]}:t)); return; }
      const payload={tracker_id:trackerId,title:stage.title,description:stage.description,due_date:stage.dueDate,is_required:stage.isRequired,status:stage.status.replace('-','_'),sort_order:stage.sortOrder};
      const {error}=stage.id?await supabase.from('stages').update(payload).eq('id',stage.id):await supabase.from('stages').insert(payload);if(error)throw error;await refresh();
    },
    async deleteStage(trackerId, stageId) { if(demoMode)setTrackers((all)=>all.map((t)=>t.id===trackerId?{...t,stages:t.stages.filter((s)=>s.id!==stageId)}:t));else{const{error}=await supabase.from('stages').delete().eq('id',stageId);if(error)throw error;await refresh();} },
    async submitGrades(courseId, termCode, grades) {
      if(demoMode){const metrics=gradeMetrics(grades);setCourses((all)=>all.map((c)=>c.id===courseId?{...c,terms:{...c.terms,[termCode]:{...metrics,uploadVersion:(c.terms[termCode]?.uploadVersion??0)+1,uploadedAt:new Date().toISOString()}}}:c));return;}
      const {data:ct,error:ctError}=await supabase.from('course_terms').select('id').eq('course_id',courseId).eq('term_code',termCode).single();if(ctError)throw ctError;
      const {error}=await supabase.rpc('submit_grade_upload',{p_course_term_id:ct.id,p_grades:grades});if(error)throw error;await refresh();
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
    async inviteUser(payload) { if(demoMode){setProfiles((all)=>[...all,{id:crypto.randomUUID(),fullName:String(payload.fullName),email:String(payload.email),role:payload.role as any,organizationUnit:String(payload.organizationUnit),isActive:true}]);return;}const{error}=await supabase.functions.invoke('manage-user',{body:{action:'invite',...payload}});if(error)throw error;await refresh(); },
    async manageUser(payload) { if(demoMode){setProfiles((all)=>all.map((item)=>item.id===payload.userId?{...item,role:(payload.role as any)??item.role,organizationUnit:payload.organizationUnit??item.organizationUnit,isActive:payload.action==='activate'?true:payload.action==='deactivate'?false:item.isActive}:item));return;}const{error}=await supabase.functions.invoke('manage-user',{body:payload});if(error)throw error;await refresh(); },
    async uploadDocument(trackerId, stageId, file) {
      if(!['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type))throw new Error('Only PDF, DOC, and DOCX files are allowed.');
      if(file.size>10*1024*1024)throw new Error('File exceeds the 10 MB limit.');
      if(demoMode){setTrackers((all)=>all.map((t)=>t.id===trackerId?{...t,stages:t.stages.map((s)=>s.id===stageId?{...s,documents:[...s.documents,{id:crypto.randomUUID(),name:file.name,mimeType:file.type,size:file.size,createdAt:new Date().toISOString()}]}:s)}:t));return;}
      const path=`${trackerId}/${stageId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const{error:uploadError}=await supabase.storage.from('tracker-documents').upload(path,file,{upsert:false});if(uploadError)throw uploadError;
      const{error}=await supabase.from('documents').insert({tracker_id:trackerId,stage_id:stageId,bucket_id:'tracker-documents',object_path:path,file_name:file.name,mime_type:file.type,size_bytes:file.size});if(error)throw error;await refresh();
    },
  }), [trackers,courses,profiles,overrides,settings,currentTerm,terms,loading,error,refresh,profile]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(){const value=useContext(DataContext);if(!value)throw new Error('useData must be used in DataProvider');return value;}
