import { useState } from 'react';
import { addMonths, parseISO } from 'date-fns';
import { Modal } from './ui';
import { completionDates, defenceTasks, graduateError, graduateItemType, graduateItemTypes, isoDate, semesterEnd, timelineSemesters, todayDate, type GraduateItemType, type GraduateCategory, type GraduateDeadline, type GraduateStudent, type GraduateTask, type GraduateTaskRecord } from '../lib/graduate';

export function CategoryEditor({ studentId, order, onClose, onSave }: { studentId: string; order: number; onClose(): void; onSave(category: GraduateCategory): Promise<void> }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#9333ea');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Modal title="Add category" onClose={() => { if (!busy) onClose(); }}><form className="space-y-4 p-6" onSubmit={async event => { event.preventDefault(); if (!name.trim()) return; setBusy(true); setError(''); try { await onSave({ student_id: studentId, key: crypto.randomUUID(), name: name.trim(), color, sort_order: order }); onClose(); } catch (reason) { setError(graduateError(reason)); setBusy(false); } }}>
    <label className="block"><span className="label">Category name</span><input className="field" required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Thesis progress"/></label>
    <label className="flex items-center gap-3"><span className="label">Category color</span><input type="color" value={color} onChange={e => setColor(e.target.value)}/></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save category</button></div>
  </form></Modal>;
}

export function DeadlineEditor({ student, category, deadline, onClose, onSave }: { student: GraduateStudent; category: GraduateCategory; deadline?: GraduateDeadline; onClose(): void; onSave(deadline: GraduateDeadline): Promise<void> }) {
  const [title, setTitle] = useState(deadline?.title ?? '');
  const [itemType, setItemType] = useState<GraduateItemType>(deadline?.item_type ?? 'Milestone');
  const [date, setDate] = useState(deadline?.due_date ?? completionDates(student.start_date).target);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Modal title={deadline ? 'Edit deadline' : 'Add deadline'} onClose={() => { if (!busy) onClose(); }}><form className="space-y-4 p-6" onSubmit={async event => { event.preventDefault(); if (!title.trim()) return; setBusy(true); setError(''); try { await onSave({ id: deadline?.id ?? crypto.randomUUID(), student_id: student.id, category_key: category.key, title: title.trim(), due_date: date, item_type: itemType }); onClose(); } catch (reason) { setError(graduateError(reason)); setBusy(false); } }}>
    <p className="text-sm font-bold text-slate-600">{category.name}</p><label className="block"><span className="label">Deadline name</span><input className="field" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)}/></label>
    <label className="block"><span className="label">Expected date</span><input className="field" type="date" required value={date} onChange={e => setDate(e.target.value)}/></label>
    <ItemTypeField value={itemType} onChange={setItemType}/>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save deadline</button></div>
  </form></Modal>;
}

export function GraduateTaskEditor({ student, task, record, onClose, onSave, onRevisions }: { student: GraduateStudent; task: GraduateTask; record?: GraduateTaskRecord; onClose(): void; onSave(record: GraduateTaskRecord): Promise<void>; onRevisions(revision: 'minor' | 'major'): Promise<void> }) {
  const editable = Boolean(task.editableDate);
  const isCourse = task.key.startsWith('course:');
  const [courseStart, setCourseStart] = useState(record?.course_semester_start ?? '');
  const courseTerms = timelineSemesters(student.start_date, [completionDates(student.start_date).maximum, todayDate(), courseStart ? semesterEnd(courseStart) : ''].sort().at(-1)!);
  const [expected, setExpected] = useState(task.dueDate ?? '');
  const [customDate, setCustomDate] = useState(Boolean(record?.expected_on));
  const [customStart, setCustomStart] = useState(record?.planned_start_on ?? '');
  const [itemType, setItemType] = useState(graduateItemType(task));
  const defaultStart = expected ? isoDate(addMonths(parseISO(expected), -1)) : '';
  const [complete, setComplete] = useState(Boolean(record?.completed_on));
  const [draft, setDraft] = useState(Boolean(record?.is_draft));
  const [revision, setRevision] = useState(student.revision_type);
  const [date, setDate] = useState(record?.completed_on ?? task.dueDate ?? todayDate());
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return <Modal title="Update task record" onClose={() => { if (!saving) onClose(); }}><form className="space-y-4 p-6" onSubmit={async event => { event.preventDefault(); setSaving(true); setError(''); try { if (revision !== student.revision_type) await onRevisions(revision); await onSave({ student_id: student.id, task_key: task.key, completed_on: complete ? date : null, notes: notes.trim(), expected_on: isCourse && courseStart ? semesterEnd(courseStart) : editable && (customDate || customStart) ? expected || null : null, course_semester_start: isCourse ? courseStart || null : null, planned_start_on: task.isChapter && customStart ? customStart : null, item_type: itemType, is_draft: Boolean(task.isChapter && draft && !complete) }); onClose(); } catch (reason) { setError(graduateError(reason)); setSaving(false); } }}>
    <p className="font-bold text-[#003C71]">{task.title}</p>
    {isCourse && <label className="block"><span className="label">Course semester</span><select aria-label="Course semester" className="field" value={courseStart} onChange={event => { const start = event.target.value; setCourseStart(start); setExpected(start ? semesterEnd(start) : ''); setCustomDate(true); if (!complete) setDate(start ? semesterEnd(start) : todayDate()); }}><option value="">Not assigned to a semester</option>{courseTerms.map(term => <option key={term.start} value={term.start}>{term.name}</option>)}</select></label>}
    <ItemTypeField value={itemType} onChange={setItemType}/>
    {task.isChapter && <div><label className="block"><span className="label">Chapter start date</span><input className="field" type="date" required min={student.start_date} max={expected} value={customStart || defaultStart} onChange={e => setCustomStart(e.target.value)}/></label>{customStart && <button type="button" className="btn-ghost mt-1" onClick={() => setCustomStart('')}>Use one-month writing window</button>}</div>}
    {task.key === 'final-thesis' && <label className="block"><span className="label">Thesis revisions</span><select className="field" value={revision} onChange={e => { const value = e.target.value as 'minor' | 'major'; setRevision(value); const due = defenceTasks({ ...student, revision_type: value }).find(item => item.key === 'final-thesis')?.dueDate ?? ''; setExpected(due); if (!complete) setDate(due || todayDate()); }}><option value="minor">Minor — within 4 weeks</option><option value="major">Major — within 6 months</option></select></label>}
    <label className="block"><span className="label">Expected date</span><input className="field" type="date" readOnly={!editable || isCourse} required={Boolean(task.isChapter)} value={expected} min={editable ? student.start_date : undefined} onChange={e => { setExpected(e.target.value); setCustomDate(true); if (!complete) setDate(e.target.value || todayDate()); }}/></label>
    {task.suggestedDate && <button type="button" className="btn-ghost" onClick={() => { setExpected(task.suggestedDate!); setCustomDate(false); setCustomStart(''); if (!complete) setDate(task.suggestedDate!); }}>Use suggested date</button>}
    <p className="text-xs text-slate-500">{task.isChapter ? 'Each chapter has a suggested one-month writing window. Methodology and Results may use the same date. Manually chosen dates are retained when the defence is rescheduled.' : editable ? 'Select the full semester for this course requirement. Its deadline is the last day of the semester.' : task.key.startsWith('custom:') ? 'Use Edit deadline in the section to reschedule this date.' : 'This deadline follows the semester or defence schedule.'}</p>
    {task.isChapter ? <label className="block"><span className="label">Chapter status</span><select className="field" value={complete ? 'completed' : draft ? 'draft' : 'planned'} onChange={e => { setComplete(e.target.value === 'completed'); setDraft(e.target.value === 'draft'); }}><option value="planned">Not started</option><option value="draft">Draft</option><option value="completed">Completed</option></select></label> : <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={complete} onChange={e => setComplete(e.target.checked)}/>Mark completed</label>}
    <label className="block"><span className="label">Completion / submission date</span><input className="field disabled:bg-slate-100" type="date" required={complete} disabled={!complete} min={task.key.startsWith('funding-form:') ? undefined : task.isChapter ? student.start_date : task.startsOn ?? student.start_date} max={todayDate()} value={date} onChange={e => setDate(e.target.value)}/></label>
    <p className="text-xs text-slate-500">Defaults to the expected date. Confirm the actual date before marking completed; future dates can be planned but cannot be recorded as completed. Uncheck to reopen.</p>
    <label className="block"><span className="label">Task notes / reference</span><textarea className="field" rows={3} maxLength={5000} value={notes} onChange={e => setNotes(e.target.value)}/></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" disabled={saving} onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save task'}</button></div>
  </form></Modal>;
}

export function ItemTypeField({ value, onChange }: { value: GraduateItemType; onChange(value: GraduateItemType): void }) {
  return <label className="block"><span className="label">Item type / symbol</span><select className="field" value={value} onChange={event => onChange(event.target.value as GraduateItemType)}>{graduateItemTypes.map(type => <option key={type}>{type}</option>)}</select></label>;
}
