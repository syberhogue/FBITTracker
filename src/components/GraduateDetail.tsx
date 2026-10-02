import { useState } from 'react';
import { ArrowUp, ChevronDown, ChevronRight, Link2, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGraduates } from '../features/graduates';
import { useData } from '../features/data';
import { completionDates, coursesCompleted, defenceTasks, displayDate, graduateError, graduateSectionId, graduateShortName, graduateSections, taskStatus, todayDate, type GraduateCategory, type GraduateDeadline, type GraduateSection, type GraduateStudent, type GraduateTask, type GraduateTaskRecord } from '../lib/graduate';
import { Badge } from './ui';
import { GraduateTimeline, type TimelineItem } from './GraduateTimeline';
import { jumpToGraduateSection } from '../lib/graduateNavigation';
import { CategoryEditor, DeadlineEditor, GraduateTaskEditor } from './GraduatePlanningEditors';
import { GraduateStudentSummary } from './GraduateStudentSummary';
import { GraduateCourseEditor } from './GraduateCourseEditor';
import { canDragGraduateTask, shiftedGraduateTask } from '../lib/graduateTimeline';
import { GraduateFundingEditor } from './GraduateFundingEditor';
import { GraduateResources } from './GraduateResources';
import { GraduateExportDialog } from './GraduateExportDialog';

const tone = (status: string) => status.toLowerCase().includes('overdue') ? 'red' : status.startsWith('Completed') ? 'green' : ['Due soon', 'Due today'].includes(status) ? 'orange' : status === 'Draft' ? 'blue' : 'gray';

function BackToTop({ studentId }: { studentId: string }) {
  return <button type="button" className="btn-ghost gap-1" onClick={() => jumpToGraduateSection(graduateSectionId(studentId, 'top'))}><ArrowUp size={14}/>Back to top</button>;
}

export function GraduateDetail({ student, data, onEdit }: { student: GraduateStudent; data: ReturnType<typeof useGraduates>; onEdit(): void }) {
  const { trackers } = useData();
  const [taskEditor, setTaskEditor] = useState<GraduateTask>();
  const [categoryEditor, setCategoryEditor] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [fundingEditor, setFundingEditor] = useState<GraduateDeadline | null>();
  const [courseSemester, setCourseSemester] = useState<string>();
  const [deadlineEditor, setDeadlineEditor] = useState<{ category: GraduateCategory; deadline?: GraduateDeadline }>();
  const [trackerId, setTrackerId] = useState('');
  const [error, setError] = useState('');
  const today = todayDate();
  const dates = completionDates(student.start_date);
  const sections = graduateSections(student, data.categories, data.deadlines, data.records, today);
  const recordFor = (key: string) => data.records.find(record => record.student_id === student.id && record.task_key === key);
  const items: TimelineItem[] = sections.flatMap(section => section.tasks.map(task => ({ task, type: section.name, color: section.color, completed: Boolean(recordFor(task.key)?.completed_on), draft: Boolean(recordFor(task.key)?.is_draft) })));
  const programmeItems: TimelineItem[] = [
    { key: 'program:start', title: 'Semester start', dueDate: student.start_date },
    { key: 'program:target', title: 'Two-year completion target', dueDate: dates.target },
    { key: 'program:maximum', title: 'Three-year maximum', dueDate: dates.maximum },
    ...(student.completed_on ? [{ key: 'program:completed', title: 'Program completed', dueDate: student.completed_on }] : []),
  ].map(task => ({ task: { ...task, owner: 'Student / Supervisor', timing: '' }, type: 'Program', color: '#475569', completed: task.key === 'program:completed' || task.key === 'program:start' && student.start_date <= today }));
  const linked = trackers.filter(tracker => data.links.some(link => link.student_id === student.id && link.tracker_id === tracker.id));
  const available = trackers.filter(tracker => !linked.some(item => item.id === tracker.id));
  const finalDeadline = defenceTasks(student).find(task => task.key === 'final-thesis')?.dueDate;
  const completedCourses = coursesCompleted(data.records, student.id);
  const completedTasks = items.filter(item => item.completed).length;
  const topId = graduateSectionId(student.id, 'top');
  function selectTask(task: GraduateTask) {
    const deadline = data.deadlines.find(item => `custom:${item.id}` === task.key);
    if (deadline?.funding_kind) setFundingEditor({ ...deadline, item_type: recordFor(task.key)?.item_type ?? deadline.item_type });
    else setTaskEditor(task);
  }
  async function saveDeadline(deadline: GraduateDeadline) {
    await data.saveDeadline.mutateAsync(deadline);
    const record = recordFor(`custom:${deadline.id}`);
    if (record?.item_type) await data.saveRecord.mutateAsync({ ...record, item_type: null });
  }
  async function deleteTask(task: GraduateTask) {
    const deadline = data.deadlines.find(item => `custom:${item.id}` === task.key);
    if (deadline) await data.saveDeadline.mutateAsync({ ...deadline, is_deleted: true });
    else await data.saveRecord.mutateAsync({ student_id: student.id, task_key: task.key, completed_on: null, notes: '', ...recordFor(task.key), is_deleted: true });
  }
  async function deleteCategory(section: GraduateSection) {
    await data.saveCategory.mutateAsync({ student_id: student.id, key: section.key, name: section.name, color: section.color, sort_order: section.sort_order, is_deleted: true });
  }
  async function moveTask(task: GraduateTask, date: string) {
    if (!canDragGraduateTask(task)) throw new Error('This deadline follows the program schedule.');
    const shifted = shiftedGraduateTask(task, date);
    if (date < student.start_date || shifted.startsOn && (task.isChapter || task.fundingSemesters || task.key.startsWith('course:')) && shifted.startsOn < student.start_date) throw new Error('The planned date or writing window cannot precede the program start.');
    if (task.key === 'oral-exam') {
      if (student.thesis_submission_date && date < student.thesis_submission_date) throw new Error('Defense must be on or after the scheduled thesis submission.');
      await data.updateStudent.mutateAsync({ id: student.id, changes: { defence_date: date } });
    } else if (['thesis-office', 'planning:submission'].includes(task.key)) {
      if (student.defence_date && date > student.defence_date) throw new Error('Thesis submission must be on or before defense.');
      await data.updateStudent.mutateAsync({ id: student.id, changes: { thesis_submission_date: date } });
    } else if (task.key.startsWith('custom:')) {
      const deadline = data.deadlines.find(deadline => `custom:${deadline.id}` === task.key);
      if (!deadline) throw new Error('The deadline no longer exists.');
      await data.saveDeadline.mutateAsync({ ...deadline, due_date: date, ...(task.fundingSemesters ? { starts_on: shifted.startsOn } : {}) });
    } else {
      await data.saveRecord.mutateAsync({ student_id: student.id, task_key: task.key, completed_on: null, notes: '', ...recordFor(task.key), expected_on: date, ...(task.key.startsWith('course:') ? { course_semester_start: shifted.startsOn } : { planned_start_on: shifted.startsOn }) });
    }
  }
  async function changeLink(id: string, remove = false) {
    setError('');
    try { await data.linkTracker.mutateAsync({ link: { student_id: student.id, tracker_id: id }, remove }); setTrackerId(''); } catch (reason) { setError(graduateError(reason)); }
  }

  return <div id={topId} tabIndex={-1} className="min-w-0 scroll-mt-4 space-y-4 outline-none">
    <GraduateStudentSummary student={student} completedTasks={completedTasks} taskCount={items.length} completedCourses={completedCourses} onEdit={onEdit} onCategory={() => setCategoryEditor(true)} onExport={() => setExportOpen(true)} onSave={changes => data.updateStudent.mutateAsync({ id: student.id, changes })}/>
    <section className="card p-5" aria-label="Overall student timeline"><h3 className="mb-2 font-extrabold text-[#003C71]">Overall timeline</h3><p className="mb-3 text-xs text-slate-500">Select a section label to jump to its planning area.</p><GraduateTimeline onDelete={deleteTask} onMove={moveTask} label="All deadlines timeline" items={[...programmeItems, ...items]} start={student.start_date} end={dates.maximum} today={today} programTarget={dates.target} groups={[{ name: 'Program', shortName: 'Program', color: '#475569', target: topId }, ...sections.map(section => ({ name: section.name, shortName: graduateShortName(section), color: section.color, target: graduateSectionId(student.id, section.key) }))]} onSelect={task => { if (task.key.startsWith('program:')) onEdit(); else selectTask(task); }}/></section>
    {finalDeadline && finalDeadline > dates.target && <p className={`rounded-lg p-3 text-xs font-semibold ${finalDeadline > dates.maximum ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`} role="status">The final thesis deadline falls after the {finalDeadline > dates.maximum ? 'three-year maximum' : 'two-year target'}. Revision time does not extend the program deadline.</p>}
    {sections.map(section => <GraduateArea key={section.key} section={section} student={student} records={data.records} onMove={moveTask} onCourseSemester={setCourseSemester} onEditStudent={onEdit} onTask={selectTask} onRecord={setTaskEditor} onDeleteTask={deleteTask} onDeleteCategory={() => deleteCategory(section)} onFunding={() => setFundingEditor(null)} onAdd={() => setDeadlineEditor({ category: section })} onEditDeadline={task => { const deadline = data.deadlines.find(deadline => `custom:${deadline.id}` === task.key); if (deadline?.funding_kind) setFundingEditor({ ...deadline, item_type: recordFor(task.key)?.item_type ?? deadline.item_type }); else setDeadlineEditor({ category: section, deadline: deadline ? { ...deadline, item_type: recordFor(task.key)?.item_type ?? deadline.item_type } : undefined }); }} onColor={color => data.saveCategory.mutateAsync({ student_id: section.student_id, key: section.key, name: section.name, sort_order: section.sort_order, color })}/ >)}
    <section className="card p-5" aria-label="Linked trackers"><div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-extrabold text-[#003C71]"><Link2 size={17}/>Linked trackers</h3><BackToTop studentId={student.id}/></div><p className="mt-1 text-xs text-slate-500">Connect thesis, paper, or other process trackers. Linking keeps their existing access permissions.</p>
      {linked.length > 0 ? <ul className="my-3 divide-y divide-slate-200">{linked.map(tracker => <li key={tracker.id} className="flex items-center justify-between gap-2 py-2"><Link className="min-w-0 break-words text-sm font-bold text-[#003C71] hover:underline" to={`/trackers/${tracker.id}/timeline`}>{tracker.title}</Link><button className="btn-ghost shrink-0" aria-label={`Unlink ${tracker.title}`} disabled={data.linkTracker.isPending} onClick={() => void changeLink(tracker.id, true)}><X size={14}/></button></li>)}</ul> : <p className="my-3 text-sm text-slate-500">No trackers linked yet.</p>}
      <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); if (trackerId) void changeLink(trackerId); }}><select className="field min-w-0 flex-1" aria-label="Tracker to link" required value={trackerId} onChange={e => setTrackerId(e.target.value)}><option value="">Choose an existing tracker</option>{available.map(tracker => <option key={tracker.id} value={tracker.id}>{tracker.title}</option>)}</select><button className="btn-primary gap-1" disabled={!trackerId || data.linkTracker.isPending}><Plus size={14}/>Link tracker</button></form>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
    <GraduateResources/>
    {fundingEditor !== undefined && <GraduateFundingEditor student={student} deadline={fundingEditor ?? undefined} onClose={() => setFundingEditor(undefined)} onSave={saveDeadline}/>}
    {categoryEditor && <CategoryEditor studentId={student.id} order={Math.max(0, ...sections.map(section => section.sort_order)) + 1} onClose={() => setCategoryEditor(false)} onSave={category => data.saveCategory.mutateAsync(category)}/>}
    {exportOpen && <GraduateExportDialog data={{ student, sections, records: data.records, links: linked.map(tracker => ({ title: tracker.title, url: `${window.location.origin}/trackers/${encodeURIComponent(tracker.id)}/timeline` })) }} onClose={() => setExportOpen(false)}/>}
    {courseSemester && <GraduateCourseEditor student={student} start={courseSemester} records={data.records} onClose={() => setCourseSemester(undefined)} onSave={record => data.saveRecord.mutateAsync(record)}/>}
    {deadlineEditor && <DeadlineEditor student={student} {...deadlineEditor} onClose={() => setDeadlineEditor(undefined)} onSave={saveDeadline}/>}
    {taskEditor && <GraduateTaskEditor task={taskEditor} student={student} record={recordFor(taskEditor.key)} onClose={() => setTaskEditor(undefined)} onSave={record => data.saveRecord.mutateAsync(record)} onRevisions={revisionType => data.saveRevisions.mutateAsync({ studentId: student.id, revisionType })}/>}
  </div>;
}

function GraduateArea({ section, student, records, onTask, onAdd, onEditDeadline, onColor, onEditStudent, onCourseSemester, onMove, onDeleteTask, onDeleteCategory, onFunding, onRecord }: { section: GraduateSection; student: GraduateStudent; records: GraduateTaskRecord[]; onTask(task: GraduateTask): void; onAdd(): void; onEditDeadline(task: GraduateTask): void; onColor(color: string): Promise<void>; onEditStudent(): void; onCourseSemester(start: string): void; onMove(task: GraduateTask, date: string): Promise<void>; onDeleteTask(task: GraduateTask): Promise<void>; onDeleteCategory(): Promise<void>; onFunding(): void; onRecord(task: GraduateTask): void }) {
  const [expanded, setExpanded] = useState(false);
  const [color, setColor] = useState(section.color);
  const [colorBusy, setColorBusy] = useState(false);
  const [error, setError] = useState('');
  const today = todayDate();
  const recordFor = (key: string) => records.find(record => record.student_id === student.id && record.task_key === key);
  const completed = section.tasks.filter(task => recordFor(task.key)?.completed_on).length;
  const contentId = `area-${student.id}-${section.key}`;
  const saveColor = async () => { if (color === section.color) return; setColorBusy(true); setError(''); try { await onColor(color); } catch (reason) { setError(graduateError(reason)); setColor(section.color); } finally { setColorBusy(false); } };
  return <section id={graduateSectionId(student.id, section.key)} tabIndex={-1} className="card scroll-mt-4 overflow-hidden focus-visible:ring-2 focus-visible:ring-slate-600" aria-label={section.name} style={{ borderTop: `3px solid ${section.color}` }}>
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" style={{ backgroundColor: `${section.color}12` }}><button className="flex min-w-0 items-center gap-2 text-left text-sm font-extrabold text-slate-800" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown size={17}/> : <ChevronRight size={17}/>}<span>{section.name}</span><span className="whitespace-nowrap text-xs font-normal text-slate-500">{completed}/{section.tasks.length}</span></button><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-1 text-[10px] font-bold text-slate-500">Color<input type="color" className="h-6 w-7 cursor-pointer rounded border border-slate-300 bg-transparent" aria-label={`${section.name} color`} value={color} disabled={colorBusy} onChange={e => setColor(e.target.value)}/></label>{color !== section.color && <button className="btn-ghost" disabled={colorBusy} onClick={() => void saveColor()}>Save color</button>}<button className="btn-ghost gap-1" onClick={onAdd}><Plus size={14}/>Deadline</button>{section.key === 'funding' && <button className="btn-ghost gap-1" onClick={onFunding}><Plus size={14}/>Funding</button>}<button className="btn-ghost text-red-700" aria-label={`Delete category ${section.name}`} onClick={() => { setError(''); void onDeleteCategory().catch(reason => setError(graduateError(reason))); }}><Trash2 size={14}/></button><BackToTop studentId={student.id}/></div></div>
    {error && <p role="alert" className="px-4 py-2 text-xs text-red-700">{error}</p>}
    {section.key === 'thesis-planning' && <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 text-xs text-slate-600"><span>Suggested Defence Date: <b>{student.defence_date ? displayDate(student.defence_date) : 'Not set'}</b></span><button className="btn-ghost" onClick={onEditStudent}>Update suggested defence date</button></div>}
    <div className="px-4 py-3"><GraduateTimeline onDelete={onDeleteTask} onMove={onMove} label={`${section.name} timeline`} items={section.tasks.map(task => ({ task, type: section.name, color: section.color, completed: Boolean(recordFor(task.key)?.completed_on), draft: Boolean(recordFor(task.key)?.is_draft) }))} start={student.start_date} end={completionDates(student.start_date).maximum} today={today} onSelect={onTask} onSemester={section.key === 'courses' ? onCourseSemester : undefined}/></div>
    <div id={contentId} hidden={!expanded}>
      {section.key === 'reports' && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">Required every semester, due April 30 (Winter), August 31 (Summer) and December 31 (Fall).</p>}
      {section.key === 'thesis-planning' && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">Suggested one-month chapter windows. Literature Review comes first; Introduction is drafted by year two. Methodology and Results may overlap. Use Update to adjust dates or record Draft/Completed status.</p>}
      {section.key === 'committee' && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">Form the supervisory committee within eight months. Committee meetings are required every semester; the suggested meeting deadline is semester end. Actual meetings can be recorded earlier.</p>}
      {section.key === 'courses' && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">Five course requirements must be completed. Double-click a semester to assign an available requirement, or use Update to reschedule an existing course. {coursesCompleted(records, student.id)} / 5 courses completed.</p>}
      {['student', 'office', 'sgps'].includes(section.key) && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">{student.defence_date ? `Defence: ${displayDate(student.defence_date)}` : 'Set a defence date in Edit student & schedule to schedule examination tasks.'}</p>}
      {section.tasks.length === 0 && <p className="px-4 pb-4 text-sm text-slate-500">Add a deadline to start planning this category.</p>}
      <ul>{section.tasks.map((task, index) => { const record = recordFor(task.key); const status = taskStatus(task, record, today); return <li key={task.key} className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ backgroundColor: index % 2 === 0 ? `${section.color}0d` : '#ffffff' }}><div className="min-w-0"><p className="break-words text-sm font-bold text-slate-800">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.dueDate ? displayDate(task.dueDate) : 'Not scheduled'} · {task.timing}</p>{(task.isChapter || task.fundingSemesters) && task.startsOn && <p className="mt-1 text-xs text-slate-500">{task.fundingSemesters ? 'Funding period' : 'Writing window'}: {displayDate(task.startsOn)} to {displayDate(task.dueDate!)}</p>}{record?.completed_on && <p className="mt-1 text-xs text-emerald-700">Recorded completion: {displayDate(record.completed_on)}</p>}{record?.notes && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{record.notes}</p>}</div><div className="flex shrink-0 flex-wrap items-center gap-1"><Badge tone={tone(status)}>{status}</Badge>{task.key.startsWith('custom:') && <button className="btn-ghost" aria-label={`Edit deadline ${task.title}`} onClick={() => onEditDeadline(task)}>Edit deadline</button>}<button className="btn-ghost" aria-label={`Update ${task.title}`} onClick={() => onRecord(task)}>Update</button><button className="btn-ghost text-red-700" aria-label={`Delete deadline ${task.title}`} onClick={() => { setError(''); void onDeleteTask(task).catch(reason => setError(graduateError(reason))); }}><Trash2 size={14}/></button></div></li>; })}</ul>
    </div>
  </section>;
}
