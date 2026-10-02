import { completionDates, graduateShortName, timelineSemesters } from './graduate';
import type { GraduateExportData, GraduateExportRow } from './graduateExport';
import { dateStamp } from './graduateTimeline';

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const color = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : '#475569';
const symbol = (type: string) => ({
  Form: '<path d="M3 1h7l3 3v11H3z M6 6h4 M6 9h4 M6 12h4"/>',
  Report: '<rect x="3" y="2" width="10" height="13" rx="1"/><path d="M6 1h4v3H6z M6 7h4 M6 10h4"/>',
  'Research Paper': '<rect x="1" y="2" width="14" height="12" rx="1"/><path d="M4 5h8 M4 8h3v3H4z M9 8h3 M9 11h3"/>',
  Thesis: '<path d="M8 3C5 1 2 2 1 3v11c2-1 5-1 7 0 2-1 5-1 7 0V3c-2-1-5-1-7 0v11"/>',
  Meeting: '<circle cx="6" cy="5" r="3"/><path d="M1 15v-2a5 5 0 0 1 10 0v2 M11 2a3 3 0 0 1 0 6 M13 10c2 0 2 3 2 5"/>',
  Course: '<path d="m1 5 7-3 7 3-7 3z M4 7v4q4 4 8 0V7 M15 5v7"/>',
  Milestone: '<path d="M3 15V1 M3 2h10l-2 3 2 3H3"/>',
}[type] ?? '<circle cx="8" cy="8" r="5"/>');

export function graduatePrintTimeline(data: GraduateExportData, rows: GraduateExportRow[], today: string) {
  const dates = completionDates(data.student.start_date);
  const dated = rows.filter(row => row.due);
  const low = Math.min(dateStamp(data.student.start_date), dateStamp(today), ...dated.map(row => dateStamp(row.start || row.due)));
  const high = Math.max(dateStamp(dates.maximum), dateStamp(today), ...dated.map(row => dateStamp(row.due)));
  const from = new Date(low).toISOString().slice(0, 10);
  const to = new Date(high + 86400000).toISOString().slice(0, 10);
  const x = (date: string) => 160 + (dateStamp(date) - low) / (high - low || 1) * 815;
  const groups = [{ name: 'Program', short: 'Program', color: '#475569' }, ...data.sections.map(section => ({ name: section.name, short: graduateShortName(section), color: color(section.color) }))];
  let bottom = 52;
  const layout = groups.map(group => {
    const y = bottom;
    const lanes: number[] = [];
    const entries = dated.filter(row => row.category === group.name).sort((a, b) => a.due.localeCompare(b.due)).map(row => {
      const left = x(row.start || row.due);
      let lane = lanes.findIndex(end => left - end > 22);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = x(row.due);
      return { row, lane };
    });
    bottom += Math.max(1, lanes.length) * 24 + 28;
    return { ...group, y, entries };
  });
  const height = bottom + 55;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Overall student timeline showing today ${escape(today)}" viewBox="0 0 1000 ${height}" style="width:100%;max-height:235mm;font-family:Arial,sans-serif;print-color-adjust:exact;-webkit-print-color-adjust:exact">
    <rect width="1000" height="${height}" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
    ${timelineSemesters(from, to).map(term => { const left = Math.max(160, x(term.start)); const right = Math.min(975, x(term.end)); return `<rect x="${left}" y="35" width="${Math.max(0, right - left)}" height="${bottom - 25}" fill="${{ Fall: '#fef3c7', Winter: '#dbeafe', Summer: '#dcfce7' }[term.semester]}"/><text x="${(left + right) / 2}" y="${bottom + 28}" text-anchor="middle" font-size="10" fill="#334155">${term.semester[0]}${term.start.slice(2, 4)}</text>`; }).join('')}
    ${layout.map(group => `<line x1="16" x2="975" y1="${group.y}" y2="${group.y}" stroke="#475569" stroke-width="2"/>
      <rect x="8" y="${group.y - 14}" width="142" height="28" rx="4" fill="white" stroke="${group.color}" stroke-width="2"/><text x="16" y="${group.y + 4}" font-size="12" font-weight="bold" fill="${group.color}">${escape(group.short.length > 19 ? group.short.slice(0, 18) + '…' : group.short)}</text>
      ${group.name === 'Program' ? `<path d="M${x(data.student.start_date)} ${group.y}H${x(dates.target)}" stroke="#16a34a" stroke-width="8"/><path d="M${x(dates.target)} ${group.y}H${x(dates.maximum)}" stroke="#dc2626" stroke-width="8"/>` : ''}
      ${group.entries.map(({ row, lane }) => {
        const px = x(row.due); const py = group.y + lane * 24;
        const done = row.status.startsWith('Completed');
        return `<g><title>${escape(`${row.category}: ${row.title} · ${row.start ? row.start + ' to ' : ''}${row.due} · ${row.status}`)}</title>
          ${row.start ? `<line x1="${x(row.start)}" x2="${px}" y1="${py}" y2="${py}" stroke="${group.color}" stroke-opacity=".55" stroke-width="7"/>` : ''}
          ${lane ? `<line x1="${px}" x2="${px}" y1="${group.y}" y2="${py}" stroke="#475569" stroke-dasharray="2 3"/>` : ''}
          <rect x="${px - 10}" y="${py - 10}" width="20" height="20" rx="3" fill="${done ? group.color : row.status.startsWith('Draft') ? '#e2e8f0' : 'white'}" stroke="${row.status.toLowerCase().includes('overdue') ? '#dc2626' : group.color}" stroke-width="2"/>
          <g transform="translate(${px - 7},${py - 7}) scale(.875)" stroke="${done ? 'white' : group.color}" fill="none" stroke-width="1.5">${symbol(row.type)}</g></g>`;
      }).join('')}`).join('')}
    <line x1="${x(today)}" x2="${x(today)}" y1="30" y2="${bottom + 10}" stroke="#0f172a" stroke-width="2" stroke-dasharray="5 4"/>
    <rect x="${Math.max(160, Math.min(841, x(today) - 67))}" y="8" width="134" height="22" rx="4" fill="#0f172a"/><text x="${Math.max(227, Math.min(908, x(today)))}" y="23" text-anchor="middle" font-size="12" fill="white" font-weight="bold">Today · ${escape(today)}</text>
    <text x="160" y="${bottom + 46}" font-size="10" fill="#475569">Fall: Sep–Dec · Winter: Jan–Apr · Summer: May–Aug</text></svg>`;
  return `<section class="print-timeline"><h2>Overall timeline</h2><p>Green: program start to two-year target · Red: two-year target to three-year maximum.<br>Bars: writing, coursework and funding periods. Filled symbols: completed. Red outlines: overdue.</p>${svg}<p class="muted">${rows.filter(row => !row.due).length} unscheduled items. Full task names, dates and progress appear in the following sections.</p></section>`;
}
