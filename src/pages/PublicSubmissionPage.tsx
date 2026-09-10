import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UploadCloud,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { submitPublicGradeUpload, type PublicGradeSubmissionReceipt } from '../features/public-grade-submission';
import { courseCodesMatch, gradeMetrics, parseGradeFile } from '../lib/domain';
import { demoMode } from '../lib/supabase';
import type { GradeCsvResult } from '../lib/types';

const emptyFileResult: GradeCsvResult = { grades: [], preview: [], errors: [], warnings: [], ignoredRows: 0 };

export function PublicSubmissionPage() {
  const { profile } = useAuth();
  const [courseCode, setCourseCode] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [facultyEmail, setFacultyEmail] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileResult, setFileResult] = useState<GradeCsvResult>(emptyFileResult);
  const [parsing, setParsing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<PublicGradeSubmissionReceipt>();
  const [fileInputKey, setFileInputKey] = useState(0);

  const metrics = useMemo(() => gradeMetrics(fileResult.grades), [fileResult.grades]);
  const courseMismatch = Boolean(courseCode && fileResult.courseCode && !courseCodesMatch(courseCode, fileResult.courseCode));
  const fileReady = Boolean(fileName && fileResult.courseCode && fileResult.semesterId && fileResult.grades.length && !fileResult.errors.length);
  const canSubmit = fileReady && !courseMismatch && confirmed && !parsing && !submitting;

  async function chooseFile(file?: File) {
    setReceipt(undefined);
    setError('');
    setConfirmed(false);
    if (!file) {
      setFileName('');
      setFileResult(emptyFileResult);
      return;
    }
    setFileName(file.name);
    setParsing(true);
    const result = await parseGradeFile(file);
    setFileResult(result);
    setParsing(false);
  }

  function resetForm() {
    setCourseCode('');
    setFacultyName('');
    setFacultyEmail('');
    setFileName('');
    setFileResult(emptyFileResult);
    setConfirmed(false);
    setError('');
    setReceipt(undefined);
    setFileInputKey((value) => value + 1);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setReceipt(undefined);
    if (!fileReady) return setError('Choose a valid grade file before submitting.');
    if (courseMismatch) return setError('The course code entered above does not match the uploaded file.');
    if (!confirmed) return setError('Confirm that the grades are final and ready to submit.');
    setSubmitting(true);
    try {
      setReceipt(await submitPublicGradeUpload({
        courseCode,
        fileCourseCode: fileResult.courseCode!,
        fileCourseTitle: fileResult.courseTitle,
        fileTermCode: fileResult.semesterId!,
        facultyName,
        facultyEmail,
        grades: fileResult.grades,
      }));
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'The grades could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="min-h-screen bg-[#f4f7fa] text-slate-900">
    <header className="border-b border-white/10 bg-[#003C71] text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Ontario Tech FBIT grade submission home">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#EA7600] text-lg font-black shadow-sm">OT</span>
          <span><span className="block text-lg font-black leading-none">OntarioTech</span><span className="mt-1 block text-[9px] font-extrabold uppercase tracking-[.2em] text-orange-300">FBIT grade submission</span></span>
        </Link>
        <Link to={profile ? '/dashboard' : '/login'} className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-3 py-2 text-xs font-bold transition hover:bg-white/10">
          <LockKeyhole size={14}/>{profile ? 'Open staff dashboard' : 'Staff sign in'}
        </Link>
      </div>
    </header>

    <main className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[#003C71]"/>
      <div className="pointer-events-none absolute left-[8%] top-24 -z-10 h-56 w-56 rounded-full bg-[#EA7600]/15 blur-3xl"/>
      <div className="pointer-events-none absolute right-[5%] top-14 -z-10 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl"/>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:px-8 lg:grid-cols-[.82fr_1.18fr] lg:gap-16 lg:py-16">
        <section className="text-white lg:pt-8">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-100"><ShieldCheck size={14}/>Secure faculty submission</p>
          <h1 className="max-w-xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl">Submit final grades in a few minutes.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-blue-100">No account is required. Enter your assigned course and faculty details, validate the official grade template, and receive a submission confirmation.</p>
          <div className="mt-9 grid max-w-lg gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {([
              [FileSpreadsheet, 'CSV or XLSX', 'First worksheet'],
              [FileCheck2, 'Validated first', 'Before submission'],
              [ShieldCheck, 'Student privacy', 'Names and IDs stay local'],
            ] as Array<[LucideIcon, string, string]>).map(([Icon, title, body]) => <div key={title} className="rounded-xl border border-white/15 bg-white/[.07] p-4 backdrop-blur-sm"><Icon className="mb-3 text-orange-300" size={21}/><p className="text-xs font-extrabold">{title}</p><p className="mt-1 text-[11px] text-blue-200">{body}</p></div>)}
          </div>
          <div className="mt-9 flex gap-3 border-t border-white/15 pt-6 text-xs leading-5 text-blue-200"><LockKeyhole className="mt-0.5 shrink-0 text-orange-300" size={16}/><p>The file itself is not uploaded. Student names and IDs are used only for browser-side validation; the service receives numeric grades and the course/faculty details below.</p></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-blue-950/20" aria-labelledby="submission-form-title">
          <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#EA7600]">Final grade intake</p>
            <h2 id="submission-form-title" className="mt-1 text-xl font-black text-[#003C71]">Course submission</h2>
            <p className="mt-1 text-xs text-slate-500">All fields are required. Your details must match the assigned instructor.</p>
          </div>

          {receipt ? <SubmissionConfirmation receipt={receipt} onReset={resetForm}/> : <form className="space-y-6 p-6 sm:p-8" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field icon={BookOpen} label="Course code / number" htmlFor="course-code"><input id="course-code" className="field pl-10" required autoComplete="off" placeholder="e.g. INFT 1020U" value={courseCode} onChange={(event) => { setCourseCode(event.target.value); setError(''); }}/></Field>
              <Field icon={UserRound} label="Faculty full name" htmlFor="faculty-name"><input id="faculty-name" className="field pl-10" required autoComplete="name" placeholder="e.g. Dr. Alex Mercer" value={facultyName} onChange={(event) => { setFacultyName(event.target.value); setError(''); }}/></Field>
              <div className="sm:col-span-2"><Field icon={Mail} label="Faculty email" htmlFor="faculty-email"><input id="faculty-email" className="field pl-10" type="email" required autoComplete="email" placeholder="name@ontariotechu.ca" value={facultyEmail} onChange={(event) => { setFacultyEmail(event.target.value); setError(''); }}/></Field></div>
            </div>

            <div>
              <label className="label" htmlFor="grade-file">Grade file</label>
              <label htmlFor="grade-file" className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-6 text-center transition ${fileReady ? 'border-emerald-300 bg-emerald-50/50' : fileResult.errors.length ? 'border-red-300 bg-red-50/50' : 'border-slate-300 bg-slate-50 hover:border-[#EA7600] hover:bg-orange-50/40'}`}>
                {parsing ? <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-[#EA7600]"/> : fileReady ? <CheckCircle2 className="text-emerald-600" size={30}/> : <UploadCloud className="text-[#003C71]" size={30}/>} 
                <span className="mt-2 text-sm font-extrabold text-slate-800">{parsing ? 'Checking your file…' : fileName || 'Choose a .csv or .xlsx file'}</span>
                <span className="mt-1 text-[11px] text-slate-500">Official template · first worksheet · maximum 5 MB</span>
              </label>
              <input key={fileInputKey} id="grade-file" className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void chooseFile(event.target.files?.[0])}/>
            </div>

            {fileReady && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4" aria-live="polite">
              <div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-extrabold text-emerald-900"><FileCheck2 size={16}/>File validated</p><p className="mt-1 text-[11px] text-emerald-800">{fileResult.courseCode} · Semester {fileResult.semesterId}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">{metrics.enrolled} grades</span></div>
              <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-white/80 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Class average</p><p className="mt-1 text-lg font-black text-[#003C71]">{metrics.average}%</p></div><div className="rounded-lg bg-white/80 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Pass rate</p><p className="mt-1 text-lg font-black text-[#003C71]">{metrics.passRate}%</p></div></div>
            </div>}

            {(fileResult.errors.length > 0 || courseMismatch) && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800" role="alert"><p className="font-extrabold">Please fix the following:</p><ul className="mt-2 list-disc space-y-1 pl-4">{courseMismatch && <li>The entered course code does not match {fileResult.courseCode} in the file.</li>}{fileResult.errors.slice(0, 6).map((message) => <li key={message}>{message}</li>)}{fileResult.errors.length > 6 && <li>{fileResult.errors.length - 6} more file errors</li>}</ul></div>}
            {fileResult.warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900" role="status"><p className="font-extrabold">File adjustments</p><ul className="mt-2 list-disc space-y-1 pl-4">{fileResult.warnings.slice(0, 6).map((message) => <li key={message}>{message}</li>)}{fileResult.warnings.length > 6 && <li>{fileResult.warnings.length - 6} more adjustment(s)</li>}</ul></div>}

            {demoMode && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900"><b>Demo details:</b> INFT 1020U · Dr. Alex Mercer · alex.mercer@ontariotechu.ca</div>}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50"><input className="mt-0.5 h-4 w-4 accent-[#003C71]" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/><span className="text-xs leading-5 text-slate-600">I confirm that these grades are final, accurate, and ready to replace any previous submission for this course and term.</span></label>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800" role="alert">{error}</p>}
            <button className="btn-orange w-full gap-2 py-3 text-sm" disabled={!canSubmit}>{submitting ? 'Submitting grades…' : 'Submit final grades'}{!submitting && <ArrowRight size={17}/>}</button>
          </form>}
        </section>
      </div>
    </main>

    <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-8"><p>Faculty of Business and Information Technology · Ontario Tech University</p><p>Need help? Contact your faculty administrator.</p></div></footer>
  </div>;
}

function Field({ icon: Icon, label, htmlFor, children }: { icon: LucideIcon; label: string; htmlFor: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor}><span className="label">{label}</span><span className="relative block"><Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>{children}</span></label>;
}

function SubmissionConfirmation({ receipt, onReset }: { receipt: PublicGradeSubmissionReceipt; onReset(): void }) {
  return <div className="p-7 text-center sm:p-10" role="status">
    <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={34}/></div>
    <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">{receipt.duplicate ? 'Already received' : 'Submission complete'}</p>
    <h2 className="mt-2 text-2xl font-black text-[#003C71]">{receipt.duplicate ? 'No duplicate was created.' : receipt.createdCourse ? 'Your course and grades were received.' : 'Your grades were received.'}</h2>
    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">{receipt.courseCode} · {receipt.courseTitle}<br/>{receipt.termCode} · {receipt.enrolledCount} grades</p>
    {receipt.receiptId && <div className="mx-auto mt-6 max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Confirmation number</p><p className="mt-1 break-all font-mono text-sm font-bold text-slate-800">{receipt.receiptId}</p></div>}
    <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-500"><BarChart3 size={15}/>Faculty administration can now review this submission.</div>
    <button type="button" className="btn-primary mt-7" onClick={onReset}>Submit another course</button>
  </div>;
}
