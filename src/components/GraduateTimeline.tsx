import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, RotateCcw, Scan, ZoomIn, ZoomOut } from 'lucide-react';
import { displayDate, graduateError, graduateItemType, graduateItemTypes, timelineSemesters, type GraduateTask } from '../lib/graduate';
import { GraduateTaskSymbol } from './GraduateTaskSymbol';
import { jumpToGraduateSection } from '../lib/graduateNavigation';
import { useGraduateTimelineViewport } from '../lib/useGraduateTimelineViewport';
import { canDragGraduateTask, fitTimelineRange, shiftedGraduateTask, timelineDivisions } from '../lib/graduateTimeline';
import { useGraduateTimelineDrag, type ResolveTimelineMove } from '../lib/useGraduateTimelineDrag';

export interface TimelineItem {
  task: GraduateTask;
  type: string;
  color: string;
  completed?: boolean;
  draft?: boolean;
}
export interface TimelineGroup { name: string; shortName: string; target: string; color: string }

export function GraduateTimeline({ label, items, start, end, today, groups, programTarget, onSelect, onSemester, onMove, resolveMove, onDelete, variant = 'graduate' }: { label: string; items: TimelineItem[]; start: string; end: string; today: string; groups?: TimelineGroup[]; programTarget?: string; variant?: 'graduate' | 'curriculum'; onSelect?(task: GraduateTask): void; onSemester?(start: string): void; onMove?(task: GraduateTask, date: string): Promise<void>; resolveMove?: ResolveTimelineMove; onDelete?(task: GraduateTask): Promise<void> }) {
  const [hovered, setHovered] = useState<TimelineItem>();
  const [menu, setMenu] = useState<{ task: GraduateTask; x: number; y: number }>();
  const [deleteError, setDeleteError] = useState('');
  const menuFocus = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(undefined);
    menuFocus.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    window.addEventListener('wheel', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('wheel', close, true); window.removeEventListener('resize', close); };
  }, [menu]);
  const dated = items.filter(item => item.task.dueDate);
  const unscheduled = items.filter(item => !item.task.dueDate);
  const stamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
  const fitted = fitTimelineRange(today, dated.map(item => item.task.dueDate!));
  const fullLow = Math.min(fitted.low, stamp(start), stamp(today), ...dated.flatMap(item => [stamp(item.task.dueDate!), ...(item.task.startsOn ? [stamp(item.task.startsOn)] : [])]));
  const fullHigh = Math.max(fitted.high, fullLow + 86400000, stamp(end), stamp(today), ...dated.map(item => stamp(item.task.dueDate!)));
  const viewport = useGraduateTimelineViewport(fullLow, fullHigh);
  const [plotWidth, setPlotWidth] = useState(600);
  useEffect(() => {
    const element = viewport.plot.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setPlotWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewport.plot]);
  const { low, high } = viewport;
  const interaction = useGraduateTimelineDrag({ low, high, zoomed: viewport.isZoomed, setWindow: viewport.setWindow, tasks: items.map(item => item.task), onMove, resolveMove });
  const previewDate = (task: GraduateTask) => interaction.preview?.dates?.[task.key] ?? (interaction.preview?.key === task.key ? interaction.preview.date : task.dueDate);
  const divisions = timelineDivisions(low, high);
  const divisionLabelStep = Math.max(1, Math.ceil(divisions.ticks.length / Math.max(1, Math.floor(plotWidth * 0.8 / 58))));
  const isDuration = (task: GraduateTask) => Boolean(task.startsOn && (task.isChapter || task.fundingSemesters || task.key.startsWith('course:')));
  const isVisibleDate = (date: string) => stamp(date) >= low && stamp(date) <= high;
  const position = (date: string) => 10 + (stamp(date) - low) / (high - low) * 80;
  const semesters = timelineSemesters(new Date(low).toISOString().slice(0, 10), new Date(high).toISOString().slice(0, 10));
  const types = groups?.map(group => group.name) ?? [...new Set(items.map(item => item.type))];
  const rows = types.map(type => {
    const lanes: number[] = [];
    return dated.filter(item => item.type === type && (isVisibleDate(item.task.dueDate!) || isDuration(item.task) && stamp(item.task.startsOn!) <= high && stamp(item.task.dueDate!) >= low)).sort((a, b) => a.task.dueDate!.localeCompare(b.task.dueDate!)).map(item => {
      const x = position(item.task.dueDate!);
      const left = isDuration(item.task) ? Math.max(10, position(item.task.startsOn!)) : x;
      let lane = lanes.findIndex(last => left - last >= 6);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = x;
      return { ...item, x, lane };
    });
  });
  const offsets: number[] = [];
  let height = 28;
  rows.forEach(row => { offsets.push(height); height += (Math.max(0, ...row.map(item => item.lane)) + 1) * 26 + 14; });
  const tooltip = (item: TimelineItem) => `${item.type}: ${item.task.title} — ${graduateItemType(item.task)} · ${previewDate(item.task) ? displayDate(previewDate(item.task)!) : 'Not scheduled'}${item.completed ? ' · Completed' : item.draft ? ' · Draft' : ''}`;

  return <div role="region" aria-label={label} className="min-w-0" onContextMenu={event => { const key = (event.target as Element).closest<HTMLElement>('[data-task-key]')?.dataset.taskKey; const item = items.find(item => item.task.key === key); if (onDelete && item && !item.task.key.startsWith('program:')) { event.preventDefault(); setMenu({ task: item.task, x: Math.min(event.clientX, window.innerWidth - 230), y: Math.min(event.clientY, window.innerHeight - 100) }); } }}>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-slate-500">Scroll over the graph to zoom{onSemester ? ' · Double-click a semester to add a course' : ''}</p><div className="flex items-center gap-1"><button type="button" className="btn-ghost p-1.5" aria-label="Earlier dates" disabled={viewport.atStart} onClick={() => viewport.pan(-1)}><ChevronLeft size={14}/></button><button type="button" className="btn-ghost p-1.5" aria-label="Zoom out" disabled={!viewport.isZoomed} onClick={() => viewport.zoom(1.5)}><ZoomOut size={14}/></button><button type="button" className="btn-ghost p-1.5" aria-label="Zoom in" onClick={() => viewport.zoom(0.67)}><ZoomIn size={14}/></button><button type="button" className="btn-ghost p-1.5" aria-label="Later dates" disabled={viewport.atEnd} onClick={() => viewport.pan(1)}><ChevronRight size={14}/></button><button type="button" className="btn-ghost gap-1" title="Fit from Today to the last scheduled stage, with padding" onClick={() => viewport.setWindow(fitted)}><Scan size={12}/>Fit to stages</button><button type="button" className="btn-ghost gap-1" disabled={!viewport.isZoomed} onClick={viewport.reset}><RotateCcw size={12}/>Reset zoom</button></div></div>
    <p className="mb-2 text-[11px] text-slate-500">{variant === 'graduate' ? <>Drag editable markers or bars to reschedule ({['semester', 'month'].includes(divisions.detail) ? 'weekly' : 'daily'} steps; courses and funding snap to semesters). {viewport.isZoomed && 'Drag empty space to pan. '}Press Escape to cancel a drag.</> : <>Drag pending stages to reschedule dependent stages and agenda deadlines. Committee stages snap to the next eligible meeting; approvals require voting. Completed stages stay fixed. Press Escape to cancel. Select a marker to edit details.</>}</p>
    <div ref={viewport.frame} data-zoomed={viewport.isZoomed} data-visible-start={Math.round(low)} data-visible-end={Math.round(high)} className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/40 pb-1"><div className={groups ? 'grid min-w-[560px] grid-cols-[148px_minmax(0,1fr)]' : ''}>
      {groups && <div className="sticky left-0 z-30 border-r border-slate-300 bg-slate-50">
        {groups.map((group, index) => <div key={group.name} className="absolute left-0 right-0 border-b border-slate-200" style={{ top: offsets[index] - 6, height: (offsets[index + 1] ?? height) - offsets[index], backgroundColor: `${group.color}08` }}><div className="absolute left-3 right-0 top-[16px] h-0.5" style={{ backgroundColor: group.color }}/><button type="button" title={`Jump to ${group.name}`} aria-label={`Jump to ${group.name}`} onClick={() => jumpToGraduateSection(group.target)} className="absolute left-2 right-3 top-0 flex h-8 items-center justify-between gap-1 rounded border border-l-4 px-2 text-left text-[11px] font-bold shadow-sm hover:brightness-95 focus-visible:ring-2 focus-visible:ring-slate-600" style={{ borderColor: group.color, color: group.color, backgroundColor: 'white' }}><span className="truncate">{group.shortName}</span><ArrowRight size={12} className="shrink-0"/></button></div>)}
      </div>}
      <div ref={viewport.plot} {...interaction.handlers} data-timeline-plot data-detail={divisions.detail} className={`relative min-w-[280px] select-none overflow-hidden ${interaction.panning ? 'cursor-grabbing' : viewport.isZoomed ? 'cursor-grab' : ''}`} style={{ height: height + 66, touchAction: 'pan-y' }}>
        {semesters.map(semester => { const left = Math.max(10, position(semester.start)); const right = Math.min(90, position(semester.end)); return <div key={semester.start} data-semester={semester.start} role={onSemester ? 'button' : undefined} tabIndex={onSemester ? 0 : undefined} onDoubleClick={() => { if (semester.start >= start) onSemester?.(semester.start); }} onKeyDown={event => { if (onSemester && semester.start >= start && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSemester(semester.start); } }} aria-label={`Semester: ${semester.name}`} title={`${semester.name}: ${displayDate(semester.start)} to ${displayDate(new Date(stamp(semester.end) - 86400000).toISOString().slice(0, 10))}`} className={`absolute bottom-12 top-4 overflow-hidden border-l border-white/80 ${onSemester ? 'cursor-crosshair focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-600' : ''}`} style={{ left: `${left}%`, width: `${right - left}%`, backgroundColor: { Fall: '#fef3c7', Winter: '#dbeafe', Summer: '#dcfce7' }[semester.semester] }}><span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-semibold text-slate-600">{semester.semester[0]}{semester.start.slice(2, 4)}</span></div>; })}
        {divisions.ticks.map((tick, index) => <div key={tick.date} aria-label={`${divisions.detail} division: ${tick.date}`} className="pointer-events-none absolute bottom-12 top-4 border-l border-slate-400/70" style={{ left: `${position(tick.date)}%` }}>{index % divisionLabelStep === 0 && <span className="absolute -bottom-6 translate-x-1 whitespace-nowrap text-[9px] font-semibold text-slate-700">{tick.label}</span>}</div>)}
        {isVisibleDate(today) && <div className="pointer-events-none absolute bottom-11 top-4 z-10 border-l-2 border-dashed border-slate-900" style={{ left: `${position(today)}%` }}><span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-white">Today</span></div>}
        {rows.map((row, rowIndex) => <div key={types[rowIndex]}>
          {groups && <div className="pointer-events-none absolute left-0 right-0 border-b border-slate-200" style={{ top: offsets[rowIndex] - 6, height: (offsets[rowIndex + 1] ?? height) - offsets[rowIndex], backgroundColor: `${groups[rowIndex].color}08` }}/>}
          <div className="pointer-events-none absolute right-[10%] h-0.5 bg-slate-600" style={{ left: groups ? 0 : '10%', top: offsets[rowIndex] + 10 }}/>
          {types[rowIndex] === 'Program' && programTarget && [
            { from: start, to: programTarget, color: '#16a34a', name: 'Program start to two-year target' },
            { from: programTarget, to: end, color: '#dc2626', name: 'Two-year target to three-year maximum' },
          ].filter(duration => stamp(duration.from) <= high && stamp(duration.to) >= low).map(duration => <div key={duration.name} role="img" aria-label={`${duration.name}: ${displayDate(duration.from)} to ${displayDate(duration.to)}`} title={`${duration.name}: ${displayDate(duration.from)} to ${displayDate(duration.to)}`} className="pointer-events-none absolute h-2.5 rounded" style={{ left: `${Math.max(10, position(duration.from))}%`, width: `${Math.min(90, position(duration.to)) - Math.max(10, position(duration.from))}%`, top: offsets[rowIndex] + 6, backgroundColor: duration.color }}/ >)}
          {row.filter(item => isDuration(item.task)).map(item => {
            const task = interaction.preview?.key === item.task.key ? shiftedGraduateTask(item.task, interaction.preview.date) : item.task;
            return <div key={`window:${task.key}`} data-task-key={task.key} role="button" tabIndex={0} aria-label={`Edit duration: ${task.title}`} title={`${task.title}: ${displayDate(task.startsOn!)} to ${displayDate(task.dueDate!)}`} onClick={() => onSelect?.(item.task)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(item.task); } }} className="absolute z-10 h-2 cursor-ew-resize rounded focus-visible:ring-2 focus-visible:ring-slate-800" style={{ touchAction: 'none', left: `${Math.max(10, position(task.startsOn!))}%`, width: `${Math.max(0, Math.min(90, position(task.dueDate!)) - Math.max(10, position(task.startsOn!)))}%`, top: offsets[rowIndex] + item.lane * 26 + 8, background: `${item.color}a0` }}/ >;
          })}
          {row.filter(item => item.lane > 0 && isVisibleDate(item.task.dueDate!)).map(item => <div key={`connector:${item.task.key}`} aria-hidden="true" className="pointer-events-none absolute border-l-2 border-dotted border-slate-600" style={{ left: `${item.x}%`, top: offsets[rowIndex] + 10, height: item.lane * 26 }}/ >)}
          {row.filter(item => isVisibleDate(item.task.dueDate!)).map(item => <button key={item.task.key} type="button" data-task-key={item.task.key} data-date={previewDate(item.task)} data-draggable={Boolean(onMove && canDragGraduateTask(item.task))} data-item-type={graduateItemType(item.task)} aria-label={tooltip(item)} title={tooltip(item)} onMouseEnter={() => setHovered(item)} onMouseLeave={() => setHovered(undefined)} onFocus={() => setHovered(item)} onBlur={() => setHovered(undefined)} onClick={() => onSelect?.(item.task)} className={`absolute z-20 ${onMove && canDragGraduateTask(item.task) ? 'cursor-ew-resize' : ''} flex h-[22px] w-[22px] -translate-x-1/2 items-center justify-center rounded border-2 hover:scale-110 focus-visible:ring-2 focus-visible:ring-slate-900 ${!item.completed && item.task.dueDate! < today ? 'ring-2 ring-red-200' : ''}`} style={{ touchAction: 'none', left: `${position(previewDate(item.task)!)}%`, top: offsets[rowIndex] + item.lane * 26, borderColor: item.color, color: item.completed ? 'white' : item.color, background: item.completed ? item.color : item.draft ? `linear-gradient(90deg, ${item.color}40 50%, white 50%)` : 'white' }}><GraduateTaskSymbol type={graduateItemType(item.task)}/></button>)}
        </div>)}
        {[0, 0.25, 0.5, 0.75, 1].map(fraction => <span key={fraction} className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-500" style={{ left: `${10 + 80 * fraction}%` }}>{displayDate(new Date(low + (high - low) * fraction).toISOString().slice(0, 10))}</span>)}
      </div>
    </div></div>
    <div className="mt-2 min-h-20">
    <div className="mb-1 min-h-8 text-xs text-slate-600">{hovered ? <span role="tooltip" className="font-semibold text-slate-800">{tooltip(hovered)}</span> : 'Hover or focus a symbol for details; select it to update the item.'}</div>
    {interaction.preview && <p role="status" className="mb-2 text-xs font-bold text-blue-800">{interaction.saving ? 'Saving' : 'Move to'}: {displayDate(interaction.preview.date)}</p>}
    {interaction.error && <p role="alert" className="mb-2 text-sm text-red-700">{interaction.error}</p>}
    {interaction.message && <p role="status" className="mb-2 text-xs text-emerald-700">{interaction.message}</p>}
    {deleteError && <p role="alert" className="text-sm text-red-700">{deleteError}</p>}</div>
    <p className="mt-1 text-[10px] text-slate-500">White: planned · {variant === 'graduate' && 'Half-shaded: draft · '}Filled: completed · Red outline: overdue · Today: {displayDate(today)}</p>
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-600">{(variant === 'graduate' ? graduateItemTypes : (['Form', 'Report', 'Meeting', 'Milestone'] as const)).map(type => <span key={type} className="flex items-center gap-1"><GraduateTaskSymbol type={type} size={12}/>{variant === 'curriculum' ? { Form: 'Agenda', Report: 'Information', Meeting: 'Approval', Milestone: 'Development' }[type as 'Form' | 'Report' | 'Meeting' | 'Milestone'] : type}</span>)}</div>
    {programTarget && <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold"><span className="text-green-700">━ Start → 2-year target</span><span className="text-red-700">━ 2-year target → 3-year maximum</span></div>}
    <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-slate-600"><span><i className="mr-1 inline-block h-2 w-2 bg-amber-100"/>Fall (Sep–Dec)</span><span><i className="mr-1 inline-block h-2 w-2 bg-blue-100"/>Winter (Jan–Apr)</span><span><i className="mr-1 inline-block h-2 w-2 bg-green-100"/>Summer (May–Aug)</span></div>
    {unscheduled.length > 0 && <details className="mt-3 rounded border border-dashed border-slate-200 p-2"><summary className="cursor-pointer text-xs font-bold text-slate-600">Unscheduled ({unscheduled.length})</summary><div className="mt-2 flex flex-wrap gap-1.5">{unscheduled.map(item => <button key={item.task.key} data-task-key={item.task.key} type="button" title={`${item.type}: ${item.task.title}`} aria-label={`Schedule ${item.type}: ${item.task.title}`} className="flex max-w-full items-center gap-1.5 rounded border border-dashed border-slate-300 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-100" onClick={() => onSelect?.(item.task)}><span style={{ color: item.color }}><GraduateTaskSymbol type={graduateItemType(item.task)} size={12}/></span><span className="truncate">{item.task.title}</span></button>)}</div></details>}
    {menu && <div className="fixed inset-0 z-50" onPointerDown={() => setMenu(undefined)} onContextMenu={event => { event.preventDefault(); setMenu(undefined); }}><div role="menu" aria-label={`Actions for ${menu.task.title}`} className="absolute w-56 rounded-lg border border-slate-300 bg-white p-1 shadow-xl" style={{ left: menu.x, top: menu.y }} onPointerDown={event => event.stopPropagation()}><button ref={menuFocus} role="menuitem" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => { onSelect?.(menu.task); setMenu(undefined); }}>Edit item</button><button role="menuitem" className="block w-full rounded px-3 py-2 text-left text-sm font-bold text-red-700 hover:bg-red-50" onClick={() => { const task = menu.task; setMenu(undefined); setDeleteError(''); void onDelete?.(task).catch(reason => setDeleteError(graduateError(reason))); }}>Delete deadline</button></div></div>}
  </div>;
}
