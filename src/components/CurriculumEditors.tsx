import { cloneElement, useId, useState, type ReactElement } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './ui';
import { CommitteeCalendarForm, type CommitteeCalendarFormProps } from './CommitteeCalendarForm';
import { academicYear, classification, committees, committeeInfo, curriculumError, curriculumTypes, scheduleStages, templateStages, validateStage, type ApprovalProcess, type CommitteeMeeting, type CurriculumChange, type CurriculumDraft, type CurriculumStage, type CurriculumType } from '../lib/curriculum';
import { todayDate } from '../lib/graduate';

function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return <div className="text-xs font-bold text-slate-600"><label htmlFor={id}>{label}</label><div className="mt-1">{cloneElement(children, { id })}</div></div>;
}
function FormFooter({ pending, error, onClose, label }: { pending: boolean; error: string; onClose(): void; label: string }) { return <>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button disabled={pending} className="btn-orange">{pending ? 'Saving…' : label}</button></div></>; }

export function CurriculumChangeEditor({ change, units, meetings, onClose, onSave }: { change?: CurriculumChange; units: Array<{ id: string; name: string }>; meetings(year: number): CommitteeMeeting[]; onClose(): void; onSave(draft: CurriculumDraft): Promise<void> }) {
  const [title, setTitle] = useState(change?.title ?? '');
  const [type, setType] = useState<CurriculumType>(change?.change_type ?? 'Minor Curriculum Changes');
  const [process, setProcess] = useState<ApprovalProcess>(change?.approval_process ?? 'Standard');
  const [start, setStart] = useState(change?.start_date ?? todayDate());
  const [year, setYear] = useState(change?.implementation_year ?? academicYear(todayDate()) + 1);
  const [unit, setUnit] = useState(change?.organization_unit_id ?? units[0]?.id ?? '');
  const [description, setDescription] = useState(change?.description ?? '');
  const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  return <Modal title={change ? 'Edit curriculum change' : 'Add curriculum change'} onClose={onClose}><form className="space-y-4 p-6" onSubmit={async event => {
    event.preventDefault(); setError(''); setPending(true);
    try {
      if (year < academicYear(start) || year > 2100) throw new Error('The implementation year must be at or after the start academic year.');
      const planned = Array.from({ length: Math.max(3, year - academicYear(start) + 1) }, (_, index) => meetings(academicYear(start) + index)).flat();
      await onSave({ title: title.trim(), change_type: type, approval_process: process, start_date: start, implementation_year: year, organization_unit_id: unit || null, description: description.trim(), stages: change?.stages ?? scheduleStages(templateStages(type, process), start, planned, type === 'New Programs') });
    } catch (reason) { setError(curriculumError(reason)); } finally { setPending(false); }
  }}>
    <Field label="Change title"><input className="field" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)}/></Field>
    <Field label="Change template"><select className="field" disabled={Boolean(change)} value={type} onChange={e => setType(e.target.value as CurriculumType)}>{curriculumTypes.map(value => <option key={value}>{value}</option>)}</select></Field>
    <p className="text-xs font-semibold text-[#003C71]">{classification(type)}</p>
    <Field label="Approval process"><select className="field" disabled={Boolean(change)} value={process} onChange={e => setProcess(e.target.value as ApprovalProcess)}><option value="Standard">Standard governance for this change type</option><option value="V1">V1 — UEC, FC, USC, AC approval</option><option value="V2">V2 — UEC/FC information, then UEC, FC, USC, AC approval</option></select></Field>
    <p className="rounded bg-blue-50 p-3 text-xs text-blue-800">{templateStages(type, process).map(stage => stage.title).join(' → ')}{change && <span className="mt-2 block">Template and process are fixed after creation to preserve stage history. Edit individual stages below.</span>}</p>
    <Field label="Organization unit"><select disabled={Boolean(change)} className="field" value={unit} onChange={e => setUnit(e.target.value)}><option value="">No unit / faculty-wide</option>{units.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></Field>
    <div className="grid grid-cols-2 gap-3"><Field label="Planning start date"><input className="field" type="date" required min="2000-01-01" max="2100-12-31" value={start} onChange={e => setStart(e.target.value)}/></Field><Field label="Implementation academic year"><input className="field" type="number" min="2000" max="2100" required value={year} onChange={e => setYear(Number(e.target.value))}/></Field></div>
    <Field label="Description / consultation notes"><textarea className="field" rows={3} maxLength={5000} value={description} onChange={e => setDescription(e.target.value)}/></Field>
    <p className="text-xs text-slate-500">{change ? 'Existing deadlines and history are preserved. Use Reschedule pending stages to recalculate meetings.' : 'Committee meetings and agenda lead times set initial deadlines. Missing meetings stay unscheduled.'}</p>
    <FormFooter pending={pending} error={error} onClose={onClose} label="Save curriculum change"/>
  </form></Modal>;
}

export function CurriculumStageEditor({ stage, change, meetings, onClose, onSave }: { stage: CurriculumStage; change: CurriculumChange; meetings: CommitteeMeeting[]; onClose(): void; onSave(stage: CurriculumStage): Promise<void> }) {
  const [draft, setDraft] = useState(stage); const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  const patch = (changes: Partial<CurriculumStage>) => setDraft(previous => ({ ...previous, ...changes }));
  const options = meetings.filter(meeting => meeting.committee === draft.committee && (draft.purpose !== 'Approval' || meeting.voting)).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  const success = draft.purpose === 'Approval' ? 'approved' : draft.purpose === 'Information' ? 'reported' : 'completed';
  return <Modal title={`Update ${stage.title}`} onClose={onClose}><form className="space-y-4 p-6" onSubmit={async event => { event.preventDefault(); setError(''); setPending(true); try { validateStage(draft, change, meetings, todayDate()); await onSave(draft); } catch (reason) { setError(curriculumError(reason)); } finally { setPending(false); } }}>
    <Field label="Stage title"><input className="field" required maxLength={200} value={draft.title} onChange={e => patch({ title: e.target.value })}/></Field>
    <div className="grid grid-cols-2 gap-3"><Field label="Committee"><select className="field" value={draft.committee ?? ''} onChange={e => patch({ committee: e.target.value as CurriculumStage['committee'] || null })}><option value="">Planning / publication</option>{committees.map(value => <option key={value}>{value}</option>)}</select></Field><Field label="Stage purpose"><select className="field" value={draft.purpose} onChange={e => patch({ purpose: e.target.value as CurriculumStage['purpose'], outcome: 'pending', completed_on: null })}>{['Approval', 'Information', 'Development'].map(value => <option key={value}>{value}</option>)}</select></Field></div>
    {draft.committee && <><p className="text-xs text-slate-500">{committeeInfo[draft.committee].level} level · {committeeInfo[draft.committee].cadence}</p><Field label="Choose confirmed meeting"><select className="field" value="" onChange={e => { const meeting = options.find(value => value.id === e.target.value); if (meeting) patch({ due_date: meeting.meeting_date, agenda_date: formatAgenda(meeting) }); }}><option value="">Select a date to fill meeting and agenda deadlines</option>{options.map(value => <option key={value.id} value={value.id}>{value.meeting_date}{value.voting ? '' : ' (information only)'}</option>)}</select></Field></>}
    <div className="grid grid-cols-2 gap-3"><Field label="Meeting / stage deadline"><input className="field" type="date" min={change.start_date} value={draft.due_date ?? ''} onChange={e => patch({ due_date: e.target.value || null })}/></Field><Field label="Agenda deadline"><input className="field" type="date" value={draft.agenda_date ?? ''} onChange={e => patch({ agenda_date: e.target.value || null })}/></Field></div>
    <Field label="Outcome"><select className="field" value={draft.outcome} onChange={e => patch({ outcome: e.target.value as CurriculumStage['outcome'], completed_on: e.target.value === success ? draft.completed_on ?? todayDate() : null })}><option value="pending">Pending</option><option value="in-progress">In progress</option><option value={success}>{success === 'approved' ? 'Approved' : success === 'reported' ? 'Reported for information' : 'Completed'}</option>{draft.purpose === 'Approval' && <option value="rejected">Rejected</option>}</select></Field>
    {draft.outcome === success && <Field label={draft.id === 'noi-publication' ? 'Actual NOI publication date' : 'Actual completion date'}><input required className="field" type="date" min={change.start_date} max={todayDate()} value={draft.completed_on ?? ''} onChange={e => patch({ completed_on: e.target.value || null })}/></Field>}
    <Field label="Stage notes"><textarea className="field" rows={3} maxLength={5000} value={draft.notes} onChange={e => patch({ notes: e.target.value })}/></Field>
    <div><p className="mb-2 text-xs font-bold text-slate-600">Resources and proposal links</p>{draft.links.map((link, index) => <div className="mb-2 flex items-end gap-2" key={index}><div className="min-w-0 flex-1 space-y-1"><input aria-label={`Link ${index + 1} title`} required className="field" value={link.title} onChange={e => patch({ links: draft.links.map((item, i) => i === index ? { ...item, title: e.target.value } : item) })}/><input aria-label={`Link ${index + 1} URL`} type="url" required className="field" value={link.url} onChange={e => patch({ links: draft.links.map((item, i) => i === index ? { ...item, url: e.target.value } : item) })}/></div><button type="button" className="btn-ghost" aria-label={`Remove link ${index + 1}`} onClick={() => patch({ links: draft.links.filter((_, i) => i !== index) })}><Trash2 size={15}/></button></div>)}<button type="button" className="btn-ghost gap-1" onClick={() => patch({ links: [...draft.links, { title: '', url: '' }] })}><Plus size={14}/>Add link</button></div>
    <FormFooter pending={pending} error={error} onClose={onClose} label="Save stage"/>
  </form></Modal>;
}

function formatAgenda(meeting: CommitteeMeeting) { const date = new Date(`${meeting.meeting_date}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - meeting.agenda_lead_days); return date.toISOString().slice(0, 10); }

export function CurriculumCalendarEditor({ onClose, ...props }: CommitteeCalendarFormProps & { onClose(): void }) {
  return <Modal title="Committee calendar" onClose={onClose}><div className="p-6"><CommitteeCalendarForm {...props} onClose={onClose}/></div></Modal>;
}
