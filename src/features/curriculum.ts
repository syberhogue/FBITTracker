import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { demoMode, supabase } from '../lib/supabase';
import { academicYear, defaultMeetings, type CommitteeMeeting, type CurriculumChange, type CurriculumDraft } from '../lib/curriculum';

interface Calendar { academic_year: number; meetings: CommitteeMeeting[]; version: number }
interface CurriculumData { changes: CurriculumChange[]; calendars: Calendar[] }
let demo: CurriculumData = { changes: [], calendars: [] };

export function useCurriculum() {
  const { profile } = useAuth();
  const client = useQueryClient();
  const key = ['curriculum', profile?.id];
  const query = useQuery({ queryKey: key, enabled: Boolean(profile), queryFn: async (): Promise<CurriculumData> => {
    if (demoMode) return demo;
    const [changes, calendars] = await Promise.all([supabase.from('curriculum_changes').select('*').order('created_at'), supabase.from('curriculum_calendars').select('*')]);
    if (changes.error) throw changes.error;
    if (calendars.error) throw calendars.error;
    return { changes: changes.data as CurriculumChange[], calendars: calendars.data as Calendar[] };
  } });
  const units = useQuery({ queryKey: ['curriculum-units', profile?.id], enabled: Boolean(profile), queryFn: async () => {
    if (demoMode) return [{ id: '10000000-0000-0000-0000-000000000001', name: 'Faculty of Business and Information Technology' }];
    const result = await supabase.from('organization_units').select('id,name').order('name');
    if (result.error) throw result.error;
    return result.data as Array<{ id: string; name: string }>;
  } });
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const saveChange = useMutation({ mutationFn: async ({ id, draft, version }: { id?: string; draft: CurriculumDraft; version?: number }) => {
    if (demoMode) {
      const existing = demo.changes.find(change => change.id === id);
      if (id && (!existing || existing.version !== version)) throw new Error('This change was updated elsewhere. Reload it before saving.');
      const change: CurriculumChange = { ...draft, id: id ?? crypto.randomUUID(), created_by: existing?.created_by ?? profile!.id, created_at: existing?.created_at ?? new Date().toISOString(), version: (existing?.version ?? 0) + 1 };
      demo = { ...demo, changes: [...demo.changes.filter(item => item.id !== id), change] };
      return change.id;
    }
    const result = await (id ? supabase.from('curriculum_changes').update({ title: draft.title, start_date: draft.start_date, implementation_year: draft.implementation_year, description: draft.description, stages: draft.stages, version: version! + 1 }).eq('id', id).eq('version', version!) : supabase.from('curriculum_changes').insert(draft)).select('id').single();
    if (result.error) throw new Error(result.error.code === 'PGRST116' ? 'This change was updated elsewhere or access changed. Reload it before saving.' : result.error.message);
    return String(result.data.id);
  }, onSuccess: refresh });
  const saveCalendar = useMutation({ mutationFn: async ({ year, meetings, version }: { year: number; meetings: CommitteeMeeting[]; version?: number }) => {
    if (demoMode) {
      const existing = demo.calendars.find(calendar => calendar.academic_year === year);
      if (existing?.version !== version) throw new Error('The calendar was updated elsewhere. Reload before saving.');
      demo = { ...demo, calendars: [...demo.calendars.filter(item => item.academic_year !== year), { academic_year: year, meetings, version: (version ?? 0) + 1 }] };
      return;
    }
    const result = await (version === undefined ? supabase.from('curriculum_calendars').insert({ academic_year: year, meetings }) : supabase.from('curriculum_calendars').update({ meetings, version: version + 1 }).eq('academic_year', year).eq('version', version)).select('academic_year').single();
    if (result.error) throw new Error(result.error.code === 'PGRST116' || result.error.code === '23505' ? 'The calendar was updated elsewhere. Reload before saving.' : result.error.message);
  }, onSuccess: refresh });
  const deleteChange = useMutation({ mutationFn: async (id: string) => {
    if (demoMode) { demo = { ...demo, changes: demo.changes.filter(change => change.id !== id) }; return; }
    const result = await supabase.from('curriculum_changes').delete().eq('id', id).select('id').single();
    if (result.error) throw result.error;
  }, onSuccess: refresh });
  const calendars = query.data?.calendars ?? [];
  const meetingsForYear = (year: number) => calendars.find(calendar => calendar.academic_year === year)?.meetings ?? defaultMeetings(year);
  const meetingsForChange = (change: Pick<CurriculumChange, 'start_date' | 'implementation_year'>) => {
    const start = academicYear(change.start_date);
    return Array.from({ length: Math.max(3, change.implementation_year - start + 1) }, (_, index) => meetingsForYear(start + index)).flat();
  };
  return { ...query, changes: query.data?.changes ?? [], calendars, units: units.data ?? [], meetingsForYear, meetingsForChange, saveChange, saveCalendar, deleteChange };
}
