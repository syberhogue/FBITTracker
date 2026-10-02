import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Badge, EmptyState, PageTitle } from '../components/ui';
import { GraduateStudentEditor } from '../components/GraduateStudentEditor';
import { GraduateDetail } from '../components/GraduateDetail';
import { useAuth } from '../features/auth';
import { useGraduates } from '../features/graduates';
import { canCreateGraduate, graduateSections, programmeStatus, semesterForDate, taskStatus, todayDate, type GraduateStudent } from '../lib/graduate';

const errorMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'The change could not be saved.';
const statusTone = (status: string) => status === 'Past maximum' ? 'red' : status === 'Completed' ? 'green' : ['Past target', 'Maximum due today', 'Target due today'].includes(status) ? 'orange' : 'gray';

export function GraduatesPage() {
  const data = useGraduates();
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState<GraduateStudent | 'new' | null>(null);
  const [notice, setNotice] = useState('');
  const today = todayDate();
  const overdueCount = (student: GraduateStudent) => graduateSections(student, data.categories, data.deadlines, data.records, today).flatMap(section => section.tasks).filter(task => taskStatus(task, data.records.find(record => record.student_id === student.id && record.task_key === task.key), today).toLowerCase().includes('overdue')).length;
  const visible = data.students.filter(student => `${student.student_name} ${student.student_number} ${student.supervisor_name} ${student.co_supervisor_name ?? ''}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || (filter === 'completed' ? Boolean(student.completed_on) : filter === 'attention' ? !student.completed_on && (overdueCount(student) > 0 || !['Within target', 'Not started'].includes(programmeStatus(student, today))) : !student.completed_on)));
  const selected = visible.find(student => student.id === params.get('student')) ?? visible[0];

  return <div className="mx-auto max-w-[1600px] p-4 md:p-8">
    <PageTitle eyebrow="Graduate studies" title="MSc student tracker" body="Follow each student from their first semester to final thesis submission." actions={canCreateGraduate(profile) && <button className="btn-orange gap-2" onClick={() => setEditor('new')}><Plus size={16}/>Add MSc student</button>}/>
    {notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="mb-6 grid gap-3 sm:grid-cols-3">{[
      ['Active students', data.students.filter(s => !s.completed_on).length],
      ['Students with overdue tasks', data.students.filter(s => !s.completed_on && overdueCount(s) > 0).length],
      ['Past three-year maximum', data.students.filter(s => programmeStatus(s, today) === 'Past maximum').length],
    ].map(([label, value]) => <div className="card p-4" key={label}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-[#003C71]">{value}</p></div>)}</div>
    {data.isLoading ? <p role="status">Loading MSc students…</p> : data.error ? <div role="alert" className="card p-6 text-red-700">Could not load MSc students: {errorMessage(data.error)} <button className="btn-ghost" onClick={() => void data.refetch()}>Retry</button></div> : <div className="grid items-start gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
      <section className="card overflow-hidden" aria-label="Student register"><div className="space-y-3 border-b border-slate-200 p-4"><label className="relative block"><Search className="absolute left-3 top-3 text-slate-400" size={17}/><input aria-label="Search students" className="field" style={{ paddingLeft: 36 }} placeholder="Student, ID or supervisor" value={search} onChange={e => setSearch(e.target.value)}/></label><select aria-label="Filter students" className="field" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All students</option><option value="active">Active students</option><option value="attention">Needs attention</option><option value="completed">Completed students</option></select></div>
        {visible.length ? <ul className="divide-y divide-slate-100">{visible.map(student => <li key={student.id}><button className={`w-full border-l-4 p-4 text-left ${student.id === selected?.id ? 'border-[#EA7600] bg-blue-50' : 'border-transparent hover:bg-slate-50'}`} onClick={() => setParams({ student: student.id }, { replace: true })} aria-pressed={student.id === selected?.id}><p className="font-bold text-[#003C71]">{student.student_name}</p><p className="mb-2 mt-1 text-xs text-slate-500">{student.student_number} · {semesterForDate(student.start_date)} {student.start_date.slice(0, 4)}</p><Badge tone={statusTone(programmeStatus(student, today))}>{programmeStatus(student, today)}</Badge></button></li>)}</ul> : <EmptyState title="No students found" body={data.students.length ? 'Try another search or filter.' : 'Add a student to create their semester and defence schedule.'}/>}
      </section>
      {selected ? <GraduateDetail key={selected.id} student={selected} data={data} onEdit={() => setEditor(selected)}/> : <div className="card p-8"><EmptyState title="Track the full MSc journey" body="Two years to the completion target, three years to the maximum, and a research progress report every semester."/></div>}
    </div>}
    {editor && <GraduateStudentEditor key={editor === 'new' ? 'new' : editor.id} student={editor === 'new' ? undefined : editor} units={data.units} onClose={() => setEditor(null)} onSave={async draft => { const id = await data.saveStudent.mutateAsync({ id: editor === 'new' ? undefined : editor.id, draft }); setParams({ student: id }, { replace: true }); setEditor(null); setNotice('MSc student and schedule saved.'); }}/ >}
  </div>;
}
