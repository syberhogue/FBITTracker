import { useState } from 'react';
import { CalendarDays, FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { graduateError, todayDate } from '../lib/graduate';
import { graduateCalendarExport, graduateCsvExport, graduateExportRows, graduatePrintHtml, graduateTextExport, type GraduateExportData } from '../lib/graduateExport';
import { Modal } from './ui';

export function GraduateExportDialog({ data, onClose }: { data: GraduateExportData; onClose(): void }) {
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const today = todayDate();
  const unscheduled = graduateExportRows(data, today).filter(row => !row.due).length;
  const name = `MSc-${data.student.student_number.replace(/[^a-zA-Z0-9_-]/g, '_')}-${today}`;
  function download(format: 'txt' | 'csv' | 'ics') {
    setError('');
    try {
      const content = format === 'txt' ? graduateTextExport(data, today) : format === 'csv' ? graduateCsvExport(data, today) : graduateCalendarExport(data);
      const url = URL.createObjectURL(new Blob([content], { type: `${{ txt: 'text/plain', csv: 'text/csv', ics: 'text/calendar' }[format]};charset=utf-8` }));
      const link = document.createElement('a'); link.href = url; link.download = `${name}.${format}`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`${format.toUpperCase()} export downloaded.`);
    } catch (reason) { setError(graduateError(reason)); }
  }
  function pdf() {
    setError('');
    const report = window.open('', '_blank');
    if (!report) { setError('Allow the report window to open, then try PDF export again.'); return; }
    report.opener = null;
    report.document.open(); report.document.write(graduatePrintHtml(data, today)); report.document.close();
    report.document.getElementById('print-report')?.addEventListener('click', () => report.print());
    report.focus();
    void report.document.fonts.ready.then(() => { if (!report.closed) report.print(); });
    setStatus('Report opened. Choose Save as PDF in the print dialog.');
  }
  return <Modal title="Export MSc student information" onClose={onClose}><div className="space-y-4 p-6"><p className="text-sm text-slate-600">Export {data.student.student_name}’s details, committee, program dates, progress, notes and linked trackers.</p><div className="grid gap-2 sm:grid-cols-2">
    <button className="btn-ghost justify-start gap-2 rounded-lg border border-slate-200 p-4" onClick={pdf}><FileDown size={20}/>PDF (Print / Save as PDF)</button>
    <button className="btn-ghost justify-start gap-2 rounded-lg border border-slate-200 p-4" onClick={() => download('txt')}><FileText size={20}/>Text (.txt)</button>
    <button className="btn-ghost justify-start gap-2 rounded-lg border border-slate-200 p-4" onClick={() => download('csv')}><FileSpreadsheet size={20}/>Spreadsheet (.csv)</button>
    <button className="btn-ghost justify-start gap-2 rounded-lg border border-slate-200 p-4" onClick={() => download('ics')}><CalendarDays size={20}/>Calendar (.ics)</button>
  </div><p className="text-xs text-slate-500">Calendar exports can be imported into Google Calendar and other calendar apps. Courses and chapters include their planned duration; other deadlines appear as all-day events. {unscheduled > 0 && `${unscheduled} unscheduled item${unscheduled === 1 ? '' : 's'} will be omitted from the calendar only.`}</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{status && <p role="status" className="text-sm text-emerald-700">{status}</p>}<div className="flex justify-end"><button className="btn-primary" onClick={onClose}>Done</button></div></div></Modal>;
}
