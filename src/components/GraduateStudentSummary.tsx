import { useState } from 'react';
import { CalendarDays, CheckCircle2, Download, GraduationCap, Pencil, Plus, Users, X } from 'lucide-react';
import { useData } from '../features/data';
import { committeeNames, committeeReadiness, completionDates, displayDate, graduateError, thesisSubmissionDate, todayDate, type GraduateDraft, type GraduateStudent } from '../lib/graduate';
import { Modal } from './ui';

type SummaryEditor = 'defence' | 'submission' | 'completion' | 'committee';
type SaveChanges = (changes: Partial<GraduateDraft>) => Promise<void>;

export function GraduateStudentSummary({ student, completedTasks, taskCount, completedCourses, onEdit, onCategory, onExport, onSave }: { student: GraduateStudent; completedTasks: number; taskCount: number; completedCourses: number; onEdit(): void; onCategory(): void; onExport(): void; onSave: SaveChanges }) {
  const [editor, setEditor] = useState<SummaryEditor>();
  const dates = completionDates(student.start_date);
  const readiness = committeeReadiness(student);
  const submission = thesisSubmissionDate(student);
  return <section className="card p-5" aria-label="Student information">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="mb-1 flex items-center gap-2 text-[#003C71]"><GraduationCap size={22}/><h2 className="break-words text-xl font-black">{student.student_name}</h2></div><p className="break-words text-sm text-slate-500">MSc · {student.student_number}{student.email && ` · ${student.email}`}</p></div><div className="flex flex-wrap gap-1"><button className="btn-ghost" onClick={onEdit}>Edit student & schedule</button><button className="btn-primary gap-1" onClick={onCategory}><Plus size={14}/>Category</button><button className="btn-ghost gap-1" onClick={onExport}><Download size={14}/>Export</button></div></div>
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4" role="group" aria-label="Supervisory Committee members">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-extrabold text-[#003C71]"><Users size={17}/>Supervisory Committee</h3><button className="btn-ghost gap-1" onClick={() => setEditor('committee')}><Pencil size={13}/>Edit members</button></div>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">{[['Supervisor', student.supervisor_name], ...(student.co_supervisor_name ? [['Co-supervisor', student.co_supervisor_name]] : []), ...(student.committee_members ?? []).map(name => ['Member', name]), ['Committee chair', student.committee_chair || 'Not assigned'], ['University Examiner', student.university_examiner || 'Needed for defense']].map(([role, name], index) => <div key={`${role}-${index}`}><dt className="text-xs text-slate-500">{role}</dt><dd className="break-words font-semibold text-slate-800">{name}</dd></div>)}</dl>
      {!readiness.hasAdditionalMember && <p className="mt-3 text-xs font-semibold text-amber-800">Add at least one member in addition to the supervisor/co-supervisor.</p>}
      {!readiness.hasChair && <p className="mt-1 text-xs text-amber-800">Select a committee chair.</p>}
      {!readiness.hasExaminer && <p className="mt-1 text-xs text-amber-800">A University Examiner is required for defense.</p>}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <button className="rounded-xl border-l-4 border-teal-600 bg-teal-50 p-4 text-left transition hover:bg-teal-100 focus-visible:ring-2 focus-visible:ring-teal-600" aria-label="Edit Defense Date" onClick={() => setEditor('defence')}><span className="flex items-center justify-between gap-2 text-sm font-bold text-teal-900">Defense Date<Pencil size={15}/></span><span className="mt-1 block text-2xl font-black text-teal-950">{student.defence_date ? displayDate(student.defence_date) : 'Not scheduled'}</span><span className="mt-1 block text-xs text-teal-800">Suggested / scheduled oral examination</span></button>
      <button className="rounded-xl border-l-4 border-blue-600 bg-blue-50 p-4 text-left transition hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-600" aria-label="Edit Thesis Submission Date" onClick={() => setEditor('submission')}><span className="flex items-center justify-between gap-2 text-sm font-bold text-blue-900">Thesis Submission Date<Pencil size={15}/></span><span className="mt-1 block text-2xl font-black text-blue-950">{submission ? displayDate(submission) : 'Set a date'}</span><span className="mt-1 block text-xs text-blue-800">{student.thesis_submission_date ? 'Manually scheduled · click to edit' : 'Due to program office · 5 weeks before defence'}</span></button>
    </div>
    <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">{[['Semester start', student.start_date], ['Completion target · 2 years', dates.target], ['Maximum deadline · 3 years', dates.maximum]].map(([label, date]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-extrabold text-[#003C71]">{displayDate(date)}</dd></div>)}</dl>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-600">{completedTasks} / {taskCount} tasks completed · {completedCourses} / 5 courses completed</p><button className="btn-primary gap-2" onClick={() => setEditor('completion')}><CheckCircle2 size={16}/>{student.completed_on ? 'Edit MSc completion' : 'Completed All MSc Requirements'}</button></div>
    {student.completed_on && <p className="mt-2 text-sm font-semibold text-emerald-700">Program completed {displayDate(student.completed_on)}{student.completed_on > dates.maximum ? ' · after maximum' : student.completed_on > dates.target ? ' · after target' : ''}</p>}
    {student.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-600">{student.notes}</p>}
    {editor === 'committee' ? <CommitteeEditor student={student} onSave={onSave} onClose={() => setEditor(undefined)}/> : editor && <StudentDateEditor student={student} kind={editor} onSave={onSave} onClose={() => setEditor(undefined)}/>}
  </section>;
}

function StudentDateEditor({ student, kind, onSave, onClose }: { student: GraduateStudent; kind: Exclude<SummaryEditor, 'committee'>; onSave: SaveChanges; onClose(): void }) {
  const automaticDate = thesisSubmissionDate({ ...student, thesis_submission_date: null });
  const [automatic, setAutomatic] = useState(false);
  const [date, setDate] = useState(kind === 'defence' ? student.defence_date ?? '' : kind === 'submission' ? thesisSubmissionDate(student) ?? '' : student.completed_on ?? todayDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const title = kind === 'completion' ? 'Completed All MSc Requirements' : kind === 'defence' ? 'Update Defense Date' : 'Update Thesis Submission Date';
  async function save(clear = false) {
    setBusy(true); setError('');
    try { await onSave(kind === 'completion' ? { completed_on: clear ? null : date } : kind === 'defence' ? { defence_date: date } : { thesis_submission_date: automatic ? null : date }); onClose(); } catch (reason) { setError(graduateError(reason)); setBusy(false); }
  }
  return <Modal title={title} onClose={() => { if (!busy) onClose(); }}><form className="space-y-4 p-6" onSubmit={event => { event.preventDefault(); void save(); }}>
    <label className="block"><span className="label">{kind === 'completion' ? 'Date of completion' : kind === 'defence' ? 'Defense Date' : 'Thesis Submission Date'}</span><input className="field" type="date" required readOnly={automatic} min={kind === 'defence' ? student.thesis_submission_date ?? student.start_date : student.start_date} max={kind === 'completion' ? todayDate() : kind === 'submission' ? student.defence_date ?? undefined : undefined} value={automatic ? automaticDate ?? '' : date} onChange={event => setDate(event.target.value)}/></label>
    {kind === 'submission' && automaticDate && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)}/>Use automatic date (5 weeks before defence)</label>}
    <p className="text-xs text-slate-500">{kind === 'completion' ? 'Record the actual date all MSc requirements were completed. Reports and committee meetings stop after that semester.' : kind === 'submission' ? 'Updating this date also updates the suggested chapter-writing schedule. Manually planned chapter dates stay as entered.' : student.thesis_submission_date ? 'Your manually scheduled thesis submission date will be retained. The defense must be on or after submission.' : 'The submission deadline and suggested chapter-writing dates will follow this defense date.'}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {kind === 'completion' && student.completed_on && <button type="button" className="btn-ghost" disabled={busy} onClick={() => void save(true)}>Clear completion / keep active</button>}
    <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="btn-primary gap-1" disabled={busy}><CalendarDays size={14}/>Save date</button></div>
  </form></Modal>;
}

function CommitteeEditor({ student, onSave, onClose }: { student: GraduateStudent; onSave: SaveChanges; onClose(): void }) {
  const { profiles } = useData();
  const [draft, setDraft] = useState(student);
  const [members, setMembers] = useState(student.committee_members?.length ? student.committee_members : ['']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const names = committeeNames({ ...draft, committee_members: members.map(name => name.trim()).filter(Boolean) });
  const chair = names.includes(draft.committee_chair ?? '') ? draft.committee_chair ?? '' : '';
  const choose = (id: string, co: boolean) => { const account = profiles.find(profile => profile.id === id); setDraft(previous => co ? { ...previous, co_supervisor_id: id || null, co_supervisor_name: account?.fullName ?? '' } : { ...previous, supervisor_id: id || null, supervisor_name: account?.fullName ?? '' }); };
  return <Modal title="Edit Supervisory Committee" onClose={() => { if (!busy) onClose(); }}><form className="space-y-4 p-6" onSubmit={async event => {
    event.preventDefault(); setError('');
    const clean = members.map(name => name.trim()).filter(Boolean);
    const allNames = [draft.supervisor_name, draft.co_supervisor_name, ...clean].filter(Boolean).map(name => name!.toLowerCase());
    if (new Set(allNames).size !== allNames.length) { setError('Each committee member must be a different person.'); return; }
    setBusy(true);
    try { await onSave({ supervisor_id: draft.supervisor_id, supervisor_name: draft.supervisor_name, co_supervisor_id: draft.co_supervisor_id ?? null, co_supervisor_name: draft.co_supervisor_name ?? '', committee_members: clean, committee_chair: chair, university_examiner: draft.university_examiner?.trim() ?? '' }); onClose(); } catch (reason) { setError(graduateError(reason)); setBusy(false); }
  }}>
    <p className="text-xs text-slate-600">Include the supervisor/co-supervisor and at least one additional member. Select a chair from these members and add a University Examiner before defense. You can save an incomplete committee while planning.</p>
    {[false, true].map(co => { const id = co ? draft.co_supervisor_id : draft.supervisor_id; return <label key={String(co)} className="block"><span className="label">{co ? 'Co-supervisor account (optional)' : 'Supervisor account'}</span><select className="field" required={!co} value={id ?? ''} onChange={event => choose(event.target.value, co)}><option value="">{co ? 'No co-supervisor' : 'Choose supervisor'}</option>{profiles.filter(profile => profile.isActive && profile.id !== (co ? draft.supervisor_id : draft.co_supervisor_id)).map(profile => <option key={profile.id} value={profile.id}>{profile.fullName}</option>)}{id && !profiles.some(profile => profile.id === id) && <option value={id}>{co ? draft.co_supervisor_name : draft.supervisor_name}</option>}</select></label>; })}
    <div className="space-y-2">{members.map((name, index) => <div key={index} className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="label">Additional member {index + 1}</span><input className="field" maxLength={200} value={name} onChange={event => setMembers(previous => previous.map((member, i) => i === index ? event.target.value : member))}/></label><button className="btn-ghost mb-1" type="button" aria-label={`Remove member ${index + 1}`} onClick={() => setMembers(previous => previous.filter((_, i) => i !== index))}><X size={14}/></button></div>)}<button type="button" className="btn-ghost gap-1" disabled={members.length >= 12} onClick={() => setMembers(previous => [...previous, ''])}><Plus size={14}/>Add member</button></div>
    <label className="block"><span className="label">Committee chair</span><select aria-label="Committee chair" className="field" value={chair} onChange={event => setDraft(previous => ({ ...previous, committee_chair: event.target.value }))}><option value="">Not yet assigned</option>{[...new Set(names)].map(name => <option key={name}>{name}</option>)}</select></label>
    <label className="block"><span className="label">University Examiner</span><input className="field" maxLength={200} value={draft.university_examiner ?? ''} onChange={event => setDraft(previous => ({ ...previous, university_examiner: event.target.value }))}/></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save committee</button></div>
  </form></Modal>;
}
