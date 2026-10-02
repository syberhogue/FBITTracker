import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { demoMode, supabase } from '../lib/supabase';
import { canCreateGraduate } from '../lib/graduate';

export interface GraduateResource { id: string; title: string; url: string; description: string; audience: 'Students' | 'Supervisors' | 'Both'; created_by: string }
export type GraduateResourceDraft = Omit<GraduateResource, 'id' | 'created_by'> & { id?: string };
let demo: GraduateResource[] = [];
export function useGraduateResources() {
  const { profile } = useAuth();
  const client = useQueryClient();
  const key = ['graduate-resources', profile?.id];
  const query = useQuery({ queryKey: key, enabled: Boolean(profile), queryFn: async (): Promise<GraduateResource[]> => {
    if (demoMode) return demo;
    const { data, error } = await supabase.from('graduate_resources').select('*').order('title');
    if (error) throw error;
    return data as GraduateResource[];
  } });
  const refresh = () => client.invalidateQueries({ queryKey: ['graduate-resources'] });
  const save = useMutation({ mutationFn: async (draft: GraduateResourceDraft) => {
    const { id, ...fields } = draft;
    if (demoMode) {
      const existing = demo.find(resource => resource.id === id);
      demo = [...demo.filter(resource => resource.id !== id), { ...fields, id: id ?? crypto.randomUUID(), created_by: existing?.created_by ?? profile!.id }].sort((a, b) => a.title.localeCompare(b.title));
      return;
    }
    const { error } = id ? await supabase.from('graduate_resources').update(fields).eq('id', id).select('id').single() : await supabase.from('graduate_resources').insert(fields).select('id').single();
    if (error) throw error;
  }, onSuccess: refresh });
  const remove = useMutation({ mutationFn: async (id: string) => {
    if (demoMode) { demo = demo.filter(resource => resource.id !== id); return; }
    const { error } = await supabase.from('graduate_resources').delete().eq('id', id).select('id').single();
    if (error) throw error;
  }, onSuccess: refresh });
  return { ...query, resources: query.data ?? [], save, remove, canAdd: canCreateGraduate(profile), canEdit: (resource: GraduateResource) => Boolean(profile?.isActive && (resource.created_by === profile.id || ['dean', 'academic_director'].includes(profile.role))) };
}
