import { useState } from 'react';
import { Modal } from './ui';
import { useAuth } from '../features/auth';
import { useData } from '../features/data';
import { graduateError, semesterForDate, semesterStart, suggestedDefenceDate, todayDate, type GraduateDraft, type GraduateStudent, type Semester } from '../lib/graduate';

export function GraduateStudentEditor({ student, units, onClose, onSave }: { student?: GraduateStudent; units: Array<{ id: string; name: string }>; onClose(): void; onSave(draft: GraduateDraft): Promise<void> }) {
  const { profile } = useAuth();
  const { profiles } = useData();
  const initialStart = student?.start_date ?? semesterStart(semesterForDate(todayDate()), new Date().getFullYear());
  const [draft, setDraft] = useState<GraduateDraft>(() => ({ student_number: '', student_name: '', email: '', supervisor_id: null, co_supervisor_id: null, organization_unit_id: profile?.organizationUnitId ?? units[0]?.id ?? null, start_date: initialStart, revision_type: 'minor', completed_on: null, notes: '', ...student, supervisor_name: profiles.find(item => item.id === student?.supervisor_id)?.fullName ?? student?.supervisor_name ?? '', co_supervisor_name: profiles.find(item => item.id === student?.co_supervisor_id)?.fullName ?? student?.co_supervisor_name ?? '', defence_date: student?.defence_date ?? suggestedDefenceDate(initialStart) }));
  const [startYear, setStartYear] = useState(initialStart.slice(0, 4));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const change = <K extends keyof GraduateDraft>(key: K, value: GraduateDraft[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const changeStart = (semester: Semester, year: string) => {
    if (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100) return;
    const start = semesterStart(semester, Number(year));
    setDraft(previous => ({ ...previous, start_date: start, defence_date: suggestedDefenceDate(start) }));
  };
  const chooseSupervisor = (id: string, co = false) => {
    const account = profiles.find(item => item.id === id);
    setDraft(previous => co ? { ...previous, co_supervisor_id: id || null, co_supervisor_name: account?.fullName ?? '' } : { ...previous, supervisor_id: id || null, supervisor_name: account?.fullName ?? '' });
  };
  return <Modal title={student ? 'Edit MSc student' : 'Add MSc student'} onClose={() => { if (!saving) onClose(); }}><form className="space-y-4 p-6" onSubmit={async event => {
    event.preventDefault(); setError('');
    if (!draft.student_name.trim() || !draft.student_number.trim() || !draft.supervisor_name.trim()) { setError('Enter a student name and ID, and select a supervisor account.'); return; }
    if (draft.supervisor_id && draft.supervisor_id === draft.co_supervisor_id) { setError('Choose a different account for the co-supervisor.'); return; }
    if (draft.defence_date && draft.defence_date < draft.start_date || draft.completed_on && (draft.completed_on < draft.start_date || draft.completed_on > todayDate())) { setError('Defence and completion cannot precede the start date; completion cannot be in the future.'); return; }
    setSaving(true);
    try { await onSave({ student_number: draft.student_number.trim(), student_name: draft.student_name.trim(), email: draft.email.trim(), supervisor_name: draft.supervisor_name, supervisor_id: draft.supervisor_id, co_supervisor_id: draft.co_supervisor_id ?? null, co_supervisor_name: draft.co_supervisor_name ?? '', committee_chair: draft.committee_chair && [draft.supervisor_name, draft.co_supervisor_name, ...(draft.committee_members ?? [])].includes(draft.committee_chair) ? draft.committee_chair : '', organization_unit_id: draft.organization_unit_id, start_date: draft.start_date, defence_date: draft.defence_date, revision_type: draft.revision_type, completed_on: draft.completed_on, notes: draft.notes.trim() }); } catch (reason) { setError(graduateError(reason)); setSaving(false); }
  }}>
    <label className="block"><span className="label">Student name</span><input className="field" required maxLength={200} value={draft.student_name} onChange={e => change('student_name', e.target.value)}/></label>
    <label className="block"><span className="label">Student ID</span><input className="field" required maxLength={50} value={draft.student_number} onChange={e => change('student_number', e.target.value)}/></label>
    <label className="block"><span className="label">Student email</span><input className="field" type="email" maxLength={254} value={draft.email} onChange={e => change('email', e.target.value)}/></label>
    <label className="block"><span className="label">Supervisor account</span><select className="field" aria-label="Supervisor account" value={draft.supervisor_id ?? ''} onChange={e => chooseSupervisor(e.target.value)}><option value="">Choose supervisor account</option>{profiles.filter(p => p.isActive && p.id !== draft.co_supervisor_id).map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}{draft.supervisor_id && !profiles.some(p => p.id === draft.supervisor_id) && <option value={draft.supervisor_id}>Current assigned supervisor</option>}</select></label>
    <label className="block"><span className="label">Supervisor name</span><input className="field bg-slate-50" readOnly value={draft.supervisor_name}/></label>
    <label className="block"><span className="label">Co-supervisor account (optional)</span><select className="field" aria-label="Co-supervisor account" value={draft.co_supervisor_id ?? ''} onChange={e => chooseSupervisor(e.target.value, true)}><option value="">No co-supervisor</option>{profiles.filter(p => p.isActive && p.id !== draft.supervisor_id).map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}{draft.co_supervisor_id && !profiles.some(p => p.id === draft.co_supervisor_id) && <option value={draft.co_supervisor_id}>Current assigned co-supervisor</option>}</select></label>
    {draft.co_supervisor_id && <label className="block"><span className="label">Co-supervisor name</span><input className="field bg-slate-50" readOnly value={draft.co_supervisor_name ?? ''}/></label>}
    <p className="text-xs text-slate-500">Names are filled from the selected accounts. Both supervisors can access this student's progress.</p>
    <label className="block"><span className="label">Organizational unit</span><select className="field" required value={draft.organization_unit_id ?? ''} onChange={e => change('organization_unit_id', e.target.value || null)}><option value="">Select unit</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-3"><label><span className="label">Start semester</span><select className="field" value={semesterForDate(draft.start_date)} onChange={e => changeStart(e.target.value as Semester, startYear)}>{['Fall', 'Winter', 'Summer'].map(term => <option key={term}>{term}</option>)}</select></label><label><span className="label">Start year</span><input className="field" type="number" required min={2000} max={2100} value={startYear} onChange={e => { setStartYear(e.target.value); changeStart(semesterForDate(draft.start_date), e.target.value); }}/></label></div>
    <p className="text-xs text-slate-500">Starts use September 1, January 1 or May 1. Changing the start semester/year recalculates the suggested defence date.</p>
    <label className="block"><span className="label">Suggested Defence Date</span><input className="field" type="date" required min={draft.start_date} value={draft.defence_date ?? ''} onChange={e => change('defence_date', e.target.value || null)}/></label>
    <p className="text-xs text-slate-500">Defaults to one calendar month before the two-year anniversary. Adjust it to update the defence and thesis-writing schedule.</p>
    {student && <p className="text-xs text-amber-800">Rescheduling retains completion records and manually planned chapter dates. Semester reports and committee meetings follow the start semester.</p>}
    <label className="block"><span className="label">Notes</span><textarea className="field" rows={3} maxLength={5000} value={draft.notes} onChange={e => change('notes', e.target.value)}/></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" disabled={saving} onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save student'}</button></div>
  </form></Modal>;
}
