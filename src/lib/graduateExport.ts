import Papa from 'papaparse';
import { graduatePrintTimeline } from './graduatePrintTimeline';
import { completionDates, graduateItemType, taskStatus, thesisSubmissionDate, type GraduateSection, type GraduateStudent, type GraduateTaskRecord } from './graduate';
import { DAY, dateStamp, stampDate } from './graduateTimeline';

export interface GraduateExportData { student: GraduateStudent; sections: GraduateSection[]; records: GraduateTaskRecord[]; links: Array<{ title: string; url: string }> }
export interface GraduateExportRow { key: string; category: string; title: string; type: string; start: string; due: string; status: string; completed: string; notes: string }
export function graduateExportMetadata({ student: s }: GraduateExportData) {
  const dates = completionDates(s.start_date);
  return [
    ['Student', s.student_name], ['Student ID', s.student_number], ['Email', s.email], ['Program', 'MSc'],
    ['Supervisor', s.supervisor_name], ['Co-supervisor', s.co_supervisor_name ?? ''], ['Additional committee members', (s.committee_members ?? []).join('; ')],
    ['Committee chair', s.committee_chair ?? ''], ['University Examiner', s.university_examiner ?? ''],
    ['Program start', s.start_date], ['Two-year target', dates.target], ['Three-year maximum', dates.maximum],
    ['Defense Date', s.defence_date ?? ''], ['Thesis Submission Date', thesisSubmissionDate(s) ?? ''], ['All MSc requirements completed', s.completed_on ?? ''], ['Student notes', s.notes],
  ];
}
export function graduateExportRows(data: GraduateExportData, today: string): GraduateExportRow[] {
  const { student, sections, records } = data;
  const dates = completionDates(student.start_date);
  const program = [['start', 'Program start', student.start_date], ['target', 'Two-year target', dates.target], ['maximum', 'Three-year maximum', dates.maximum], ...(student.completed_on ? [['completed', 'All MSc requirements completed', student.completed_on]] : [])];
  return [
    ...program.map(([key, title, due]) => ({ key: `program:${key}`, category: 'Program', title, type: 'Milestone', start: '', due, status: key === 'completed' ? 'Completed' : 'Scheduled', completed: key === 'completed' ? due : '', notes: '' })),
    ...sections.flatMap(section => section.tasks.map(task => {
      const record = records.find(record => record.student_id === student.id && record.task_key === task.key);
      return { key: task.key, category: section.name, title: task.title, type: graduateItemType(task), start: task.isChapter || task.fundingSemesters || task.key.startsWith('course:') ? task.startsOn ?? '' : '', due: task.dueDate ?? '', status: taskStatus(task, record, today), completed: record?.completed_on ?? '', notes: [task.timing, record?.notes].filter(Boolean).join('\n') };
    })),
  ];
}
export function graduateTextExport(data: GraduateExportData, today: string) {
  const rows = graduateExportRows(data, today);
  return ['MSc STUDENT PROGRESS', `Exported: ${today}`, '', ...graduateExportMetadata(data).map(([label, value]) => `${label}: ${value || 'Not recorded'}`), '', ...[...new Set(rows.map(row => row.category))].flatMap(category => [category.toUpperCase(), ...rows.filter(row => row.category === category).map(row => `- ${row.title} (${row.type})\n  ${row.start ? `${row.start} to ` : ''}${row.due || 'Unscheduled'} | ${row.status}${row.completed ? ` | Completed: ${row.completed}` : ''}${row.notes ? `\n  ${row.notes.replace(/\n/g, '\n  ')}` : ''}`), '']), 'LINKED TRACKERS', ...data.links.map(link => `${link.title}: ${link.url}`)].join('\r\n');
}
export function graduateCsvExport(data: GraduateExportData, today: string) {
  const prefix = [data.student.student_number, data.student.student_name];
  const rows = [
    ['Record type', 'Student ID', 'Student', 'Category', 'Item', 'Type', 'Start date', 'Deadline', 'Status', 'Completed on', 'Details', 'URL'],
    ...graduateExportMetadata(data).map(([label, value]) => ['Student info', ...prefix, '', label, '', '', '', '', '', value, '']),
    ...graduateExportRows(data, today).map(row => ['Task', ...prefix, row.category, row.title, row.type, row.start, row.due, row.status, row.completed, row.notes, '']),
    ...data.links.map(link => ['Linked tracker', ...prefix, '', link.title, '', '', '', '', '', '', link.url]),
  ];
  return '\uFEFF' + Papa.unparse(rows, { newline: '\r\n', escapeFormulae: /^[=+\-@\t\r]/ });
}
const calendarEscape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
export function foldCalendarLine(line: string) {
  let result = ''; let bytes = 0;
  const encoder = new TextEncoder();
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += character; bytes += size;
  }
  return result;
}
export function graduateCalendarExport(data: GraduateExportData, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const compact = (date: string) => date.replace(/-/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FBIT Tracker//MSc Progress//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${calendarEscape(`${data.student.student_name} - MSc`)}`, `X-WR-CALDESC:${calendarEscape(graduateExportMetadata(data).map(([label, value]) => `${label}: ${value}`).join('\n'))}`];
  for (const row of graduateExportRows(data, today).filter(row => row.due)) {
    lines.push('BEGIN:VEVENT', `UID:${encodeURIComponent(data.student.id)}.${encodeURIComponent(row.key)}@fbittracker`, `DTSTAMP:${timestamp}`, `DTSTART;VALUE=DATE:${compact(row.start || row.due)}`, `DTEND;VALUE=DATE:${compact(stampDate(dateStamp(row.due) + DAY))}`, `SUMMARY:${calendarEscape(`${data.student.student_name}: ${row.title}`)}`, `CATEGORIES:${calendarEscape(row.category)}`, `DESCRIPTION:${calendarEscape([row.category, `Type: ${row.type}`, `Deadline: ${row.due}`, `Status: ${row.status}`, row.completed ? `Completed: ${row.completed}` : '', row.notes, ...data.links.map(link => `${link.title}: ${link.url}`)].filter(Boolean).join('\n'))}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  return [...lines, 'END:VCALENDAR'].map(foldCalendarLine).join('\r\n') + '\r\n';
}
const htmlEscape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export function graduatePrintHtml(data: GraduateExportData, today: string) {
  const rows = graduateExportRows(data, today);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${htmlEscape(data.student.student_name)} - MSc progress</title><style>
    @page { size: A4; margin: 16mm; } * { box-sizing: border-box; } body { font: 11px/1.45 Arial,sans-serif; color:#172b40; margin:24px auto; max-width:1000px; } h1 { color:#003c71; font-size:26px; margin-bottom:4px; } h2 { font-size:15px; color:#003c71; break-after:avoid; margin-top:24px; } .meta { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; } .meta div { break-inside:avoid; overflow-wrap:anywhere; white-space:pre-wrap; } dt { font-weight:bold; color:#4b5563; } dd { margin:0; } table { width:100%; border-collapse:collapse; table-layout:fixed; } th,td { padding:7px; border-bottom:1px solid #d6e0eb; text-align:left; vertical-align:top; overflow-wrap:anywhere; white-space:pre-wrap; } th { background:#eaf0f6; } tr:nth-child(even) { background:#f5f8fa; } thead { display:table-header-group; } tr { break-inside:avoid; } th:first-child { width:30%; } .muted { color:#64748b; } button { padding:10px 16px; cursor:pointer; } a { overflow-wrap:anywhere; } @media print { body { margin:0; max-width:none; } .print-controls { display:none; } .print-timeline { break-before:page; break-after:page; break-inside:avoid; } }
    </style></head><body><div class="print-controls"><button id="print-report">Print / Save as PDF</button><p>Choose “Save as PDF” in the print destination to export this report.</p></div><h1>MSc student progress</h1><p>${htmlEscape(data.student.student_name)} · Exported ${today}</p><dl class="meta">${graduateExportMetadata(data).map(([label, value]) => `<div><dt>${htmlEscape(label)}</dt><dd>${htmlEscape(value || 'Not recorded')}</dd></div>`).join('')}</dl>${graduatePrintTimeline(data, rows, today)}${[...new Set(rows.map(row => row.category))].map(category => `<h2>${htmlEscape(category)}</h2><table><thead><tr><th>Item / type</th><th>Planned dates</th><th>Progress</th><th>Notes</th></tr></thead><tbody>${rows.filter(row => row.category === category).map(row => `<tr><td>${htmlEscape(row.title)}<br><span class="muted">${htmlEscape(row.type)}</span></td><td>${htmlEscape(row.start ? `${row.start} to\n` : '')}${htmlEscape(row.due || 'Unscheduled')}</td><td>${htmlEscape(row.status)}${row.completed ? `<br>Completed: ${htmlEscape(row.completed)}` : ''}</td><td>${htmlEscape(row.notes)}</td></tr>`).join('')}</tbody></table>`).join('')}<h2>Linked trackers</h2>${data.links.length ? data.links.map(link => `<p>${htmlEscape(link.title)}<br>${htmlEscape(link.url)}</p>`).join('') : '<p>No linked trackers.</p>'}</body></html>`;
}
