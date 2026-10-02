import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from 'react';
import { graduateError, type GraduateTask } from './graduate';
import { canDragGraduateTask, dateStamp, snapGraduateDeadline, type TimelineRange } from './graduateTimeline';

interface Gesture extends TimelineRange { pointer: number; x: number; left: number; width: number; task?: GraduateTask; moved: boolean; target: HTMLElement; date?: string }
export interface TimelineMovePreview { date: string; dates?: Record<string, string> }
export type ResolveTimelineMove = (task: GraduateTask, date: string) => TimelineMovePreview;
export function useGraduateTimelineDrag({ low, high, zoomed, setWindow, tasks, onMove, resolveMove }: TimelineRange & { zoomed: boolean; setWindow(range: TimelineRange): void; tasks: GraduateTask[]; onMove?(task: GraduateTask, date: string): Promise<void>; resolveMove?: ResolveTimelineMove }) {
  const gesture = useRef<Gesture | undefined>(undefined);
  const suppressUntil = useRef(0);
  const [preview, setPreview] = useState<TimelineMovePreview & { key: string }>();
  const [panning, setPanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  function cancel() {
    const active = gesture.current;
    if (!active) return;
    gesture.current = undefined;
    if (!active.task) setWindow({ low: active.low, high: active.high });
    if (active.target.hasPointerCapture(active.pointer)) active.target.releasePointerCapture(active.pointer);
    setPreview(undefined); setError(''); setPanning(false); suppressUntil.current = Date.now() + 250;
  }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') {
      const active = gesture.current;
      if (!active) return;
      gesture.current = undefined;
      if (!active.task) setWindow({ low: active.low, high: active.high });
      if (active.target.hasPointerCapture(active.pointer)) active.target.releasePointerCapture(active.pointer);
      setPreview(undefined); setError(''); setPanning(false); suppressUntil.current = Date.now() + 250;
    } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [setWindow]);
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || saving || gesture.current) return;
    suppressUntil.current = 0;
    const element = (event.target as Element).closest<HTMLElement>('[data-task-key]');
    const task = element ? tasks.find(task => task.key === element.dataset.taskKey) : undefined;
    if (element && (!task || !canDragGraduateTask(task) || !onMove) || !element && !zoomed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const target = element ?? (event.target as Element).closest<HTMLElement>('[data-semester]') ?? event.currentTarget;
    target.setPointerCapture(event.pointerId);
    gesture.current = { pointer: event.pointerId, x: event.clientX, left: rect.left, width: rect.width, low, high, task, moved: false, target };
    setError(''); setMessage('');
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    const delta = event.clientX - active.x;
    if (!active.moved && Math.abs(delta) < 5) return;
    active.moved = true;
    const span = active.high - active.low;
    if (active.task) {
      const course = active.task.key.startsWith('course:');
      const stamp = course ? active.low + Math.max(0, Math.min(1, ((event.clientX - active.left) / active.width - 0.1) / 0.8)) * span : dateStamp(active.task.dueDate!) + delta / (active.width * 0.8) * span;
      try {
        const date = snapGraduateDeadline(stamp, resolveMove ? 0 : span, !resolveMove && (course || Boolean(active.task.fundingSemesters)));
        const resolved = resolveMove ? resolveMove(active.task, date) : { date };
        active.date = resolved.date;
        setPreview({ key: active.task.key, ...resolved });
        setError('');
      } catch (reason) {
        active.date = undefined;
        setPreview(undefined);
        setError(graduateError(reason));
      }
    } else {
      setPanning(true);
      const shift = -delta / (active.width * 0.8) * span;
      setWindow({ low: active.low + shift, high: active.high + shift });
    }
  }
  async function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    gesture.current = undefined;
    if (active.target.hasPointerCapture(active.pointer)) active.target.releasePointerCapture(active.pointer);
    setPanning(false);
    if (active.moved) suppressUntil.current = Date.now() + 250;
    if (active.task && active.date && active.date !== active.task.dueDate && onMove) {
      setSaving(true);
      try { await onMove(active.task, active.date); setMessage(`${active.task.title} rescheduled to ${active.date}.`); }
      catch (reason) { setError(graduateError(reason)); }
      finally { setSaving(false); }
    }
    setPreview(undefined);
  }
  const suppressClick = (event: MouseEvent) => { if (event.detail && Date.now() < suppressUntil.current) { event.preventDefault(); event.stopPropagation(); } };
  return { preview, panning, saving, error, message, handlers: { onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp, onPointerCancel: cancel, onLostPointerCapture: cancel, onClickCapture: suppressClick, onDoubleClickCapture: suppressClick } };
}
