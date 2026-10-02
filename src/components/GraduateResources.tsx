import { useState } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useGraduateResources, type GraduateResource, type GraduateResourceDraft } from '../features/graduateResources';
import { graduateError } from '../lib/graduate';
import { Modal } from './ui';

export function GraduateResources({ manage = false }: { manage?: boolean }) {
  const data = useGraduateResources();
  const [editing, setEditing] = useState<GraduateResource | null>();
  const [error, setError] = useState('');
  return <section className={`card p-5 ${manage ? 'my-8' : ''}`} aria-label="MSc resources">
    <div className="flex items-center justify-between gap-3"><h3 className="font-extrabold text-[#003C71]">{manage ? 'MSc resources' : 'Resources'}</h3>{manage && data.canAdd && <button className="btn-ghost gap-1" onClick={() => setEditing(null)}><Plus size={14}/>Add resource</button>}</div>
    <p className="mt-1 text-xs text-slate-500">Shared links for MSc students and supervisors. {manage ? 'Saved resources appear at the bottom of every student’s tracker.' : 'Manage these links in Templates / Settings.'}</p>
    {data.isPending ? <p className="mt-3 text-sm text-slate-500">Loading resources…</p> : data.isError ? <p role="alert" className="mt-3 text-sm text-red-700">{graduateError(data.error)}</p> : !data.resources.length ? <p className="mt-3 text-sm text-slate-500">No resources added yet.</p> : <ul className="mt-3 divide-y divide-slate-200">{data.resources.map(resource => <li key={resource.id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-words text-sm font-bold text-[#003C71] hover:underline">{resource.title}<ExternalLink size={13} className="shrink-0"/></a><p className="mt-1 text-xs font-semibold text-slate-500">For {resource.audience === 'Both' ? 'students and supervisors' : resource.audience.toLowerCase()}</p>{resource.description && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{resource.description}</p>}</div>{manage && data.canEdit(resource) && <div className="flex shrink-0"><button className="btn-ghost" onClick={() => setEditing(resource)}>Edit</button><button className="btn-ghost text-red-700" disabled={data.remove.isPending} aria-label={`Delete resource ${resource.title}`} onClick={() => { setError(''); void data.remove.mutateAsync(resource.id).catch(reason => setError(graduateError(reason))); }}><Trash2 size={14}/></button></div>}</li>)}</ul>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {editing !== undefined && <ResourceEditor resource={editing ?? undefined} onClose={() => setEditing(undefined)} onSave={draft => data.save.mutateAsync(draft)}/>}
  </section>;
}

function ResourceEditor({ resource, onClose, onSave }: { resource?: GraduateResource; onClose(): void; onSave(draft: GraduateResourceDraft): Promise<void> }) {
  const [title, setTitle] = useState(resource?.title ?? '');
  const [url, setUrl] = useState(resource?.url ?? '');
  const [description, setDescription] = useState(resource?.description ?? '');
  const [audience, setAudience] = useState<GraduateResource['audience']>(resource?.audience ?? 'Both');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Modal title={resource ? 'Edit resource' : 'Add resource'} onClose={() => { if (!busy) onClose(); }}><form className="space-y-4 p-6" onSubmit={async event => {
    event.preventDefault(); setError('');
    let link: URL;
    try { link = new URL(url.trim()); if (!['https:', 'http:'].includes(link.protocol) || !link.hostname) throw new Error(); }
    catch { setError('Enter a complete http:// or https:// URL.'); return; }
    if (!title.trim()) return;
    setBusy(true);
    try { await onSave({ id: resource?.id, title: title.trim(), url: link.href, description: description.trim(), audience }); onClose(); }
    catch (reason) { setError(graduateError(reason)); setBusy(false); }
  }}>
    <label className="block"><span className="label">Resource title</span><input className="field" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)}/></label>
    <label className="block"><span className="label">Resource URL</span><input className="field" type="url" required maxLength={2048} placeholder="https://" value={url} onChange={event => setUrl(event.target.value)}/></label>
    <label className="block"><span className="label">Audience</span><select className="field" value={audience} onChange={event => setAudience(event.target.value as GraduateResource['audience'])}><option value="Both">Students and supervisors</option><option>Students</option><option>Supervisors</option></select></label>
    <label className="block"><span className="label">Resource description</span><textarea className="field" rows={3} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)}/></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save resource</button></div>
  </form></Modal>;
}
