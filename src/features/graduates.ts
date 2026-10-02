import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { demoMode, supabase } from '../lib/supabase';
import { defaultGraduateCategories, type GraduateCategory, type GraduateDeadline, type GraduateDraft, type GraduateStudent, type GraduateTaskRecord, type GraduateTrackerLink } from '../lib/graduate';

interface GraduateData { students: GraduateStudent[]; records: GraduateTaskRecord[]; categories: GraduateCategory[]; deadlines: GraduateDeadline[]; links: GraduateTrackerLink[] }
// Demo data is kept in memory, like process trackers; real student data uses Supabase.
let demo: GraduateData = { students: [], records: [], categories: [], deadlines: [], links: [] };

export function useGraduates() {
  const { profile } = useAuth();
  const client = useQueryClient();
  const units = useQuery({
    queryKey: ['graduate-units', profile?.id], enabled: Boolean(profile),
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      if (demoMode) return [{ id: '10000000-0000-0000-0000-000000000001', name: 'Faculty of Business and Information Technology' }];
      const { data, error } = await supabase.from('organization_units').select('id,name').order('name');
      if (error) throw error;
      return data;
    },
  });
  const key = ['graduates', profile?.id];
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(profile),
    queryFn: async (): Promise<GraduateData> => {
      if (demoMode) return demo;
      const [students, records, categories, deadlines, links] = await Promise.all([
        supabase.from('graduate_students').select('*').order('student_name'),
        supabase.from('graduate_task_records').select('*'),
        supabase.from('graduate_categories').select('*').order('sort_order'),
        supabase.from('graduate_deadlines').select('*'),
        supabase.from('graduate_tracker_links').select('*'),
      ]);
      if (students.error) throw students.error;
      if (records.error) throw records.error;
      if (categories.error) throw categories.error;
      if (deadlines.error) throw deadlines.error;
      if (links.error) throw links.error;
      return { students: students.data as GraduateStudent[], records: records.data as GraduateTaskRecord[], categories: categories.data as GraduateCategory[], deadlines: deadlines.data as GraduateDeadline[], links: links.data as GraduateTrackerLink[] };
    },
  });
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: key }), client.invalidateQueries({ queryKey: ['linked-graduates'] })]); };
  const saveStudent = useMutation({
    mutationFn: async ({ id, draft }: { id?: string; draft: GraduateDraft }) => {
      if (demoMode) {
        const student = { ...demo.students.find(item => item.id === id), ...draft, id: id ?? crypto.randomUUID(), created_by: profile!.id };
        demo = { ...demo, students: id ? demo.students.map(item => item.id === id ? student : item) : [...demo.students, student] };
        if (!id) demo = { ...demo, categories: [...demo.categories, ...defaultGraduateCategories(student.id)] };
        return student.id;
      }
      const result = await (id ? supabase.from('graduate_students').update(draft).eq('id', id) : supabase.from('graduate_students').insert(draft)).select('id').single();
      if (result.error) throw result.error;
      return String(result.data.id);
    },
    onSuccess: refresh,
  });
  const saveRecord = useMutation({
    mutationFn: async (record: GraduateTaskRecord) => {
      if (demoMode) {
        demo = { ...demo, records: [...demo.records.filter(item => !(item.student_id === record.student_id && item.task_key === record.task_key)), record] };
        return;
      }
      const { error } = await supabase.from('graduate_task_records').upsert(record, { onConflict: 'student_id,task_key' });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const updateStudent = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<GraduateDraft> }) => {
      if (demoMode) { demo = { ...demo, students: demo.students.map(student => student.id === id ? { ...student, ...changes } : student) }; return; }
      const { error } = await supabase.from('graduate_students').update(changes).eq('id', id).select('id').single();
      if (error) throw error;
    }, onSuccess: refresh,
  });
  const saveRevisions = useMutation({
    mutationFn: async ({ studentId, revisionType }: { studentId: string; revisionType: 'minor' | 'major' }) => {
      if (demoMode) { demo = { ...demo, students: demo.students.map(student => student.id === studentId ? { ...student, revision_type: revisionType } : student) }; return; }
      const { error } = await supabase.from('graduate_students').update({ revision_type: revisionType }).eq('id', studentId).select('id').single();
      if (error) throw error;
    }, onSuccess: refresh,
  });
  const saveCategory = useMutation({
    mutationFn: async (category: GraduateCategory) => {
      if (demoMode) { demo = { ...demo, categories: [...demo.categories.filter(item => !(item.student_id === category.student_id && item.key === category.key)), category] }; return; }
      const { error } = await supabase.from('graduate_categories').upsert(category, { onConflict: 'student_id,key' });
      if (error) throw error;
    }, onSuccess: refresh,
  });
  const saveDeadline = useMutation({
    mutationFn: async (deadline: GraduateDeadline) => {
      if (demoMode) { demo = { ...demo, deadlines: [...demo.deadlines.filter(item => item.id !== deadline.id), deadline] }; return; }
      const { error } = await supabase.from('graduate_deadlines').upsert(deadline);
      if (error) throw error;
    }, onSuccess: refresh,
  });
  const linkTracker = useMutation({
    mutationFn: async ({ link, remove = false }: { link: GraduateTrackerLink; remove?: boolean }) => {
      if (demoMode) { demo = { ...demo, links: [...demo.links.filter(item => !(item.student_id === link.student_id && item.tracker_id === link.tracker_id)), ...(remove ? [] : [link])] }; return; }
      const { error } = remove ? await supabase.from('graduate_tracker_links').delete().eq('student_id', link.student_id).eq('tracker_id', link.tracker_id) : await supabase.from('graduate_tracker_links').upsert(link, { onConflict: 'student_id,tracker_id', ignoreDuplicates: true });
      if (error) throw error;
    }, onSuccess: refresh,
  });
  return { ...query, units: units.data ?? [], students: query.data?.students ?? [], records: query.data?.records ?? [], categories: query.data?.categories ?? [], deadlines: query.data?.deadlines ?? [], links: query.data?.links ?? [], saveStudent, updateStudent, saveRecord, saveRevisions, saveCategory, saveDeadline, linkTracker };
}

export function useLinkedGraduates(trackerId: string) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['linked-graduates', profile?.id, trackerId], enabled: Boolean(profile && trackerId),
    queryFn: async (): Promise<Array<{ id: string; student_name: string }>> => {
      if (demoMode) return demo.students.filter(student => demo.links.some(link => link.student_id === student.id && link.tracker_id === trackerId));
      const { data, error } = await supabase.from('graduate_tracker_links').select('graduate_students!inner(id,student_name)').eq('tracker_id', trackerId);
      if (error) throw error;
      return data.flatMap(row => row.graduate_students) as unknown as Array<{ id: string; student_name: string }>;
    },
  });
}
