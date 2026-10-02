import { useCallback, useEffect, useRef, useState } from 'react';
import { zoomTimelineRange, type TimelineRange } from './graduateTimeline';

export function useGraduateTimelineViewport(low: number, high: number) {
  const frame = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<TimelineRange>();
  const bounds = { low, high };
  const visible = zoomTimelineRange(bounds, range ?? bounds, 1);
  useEffect(() => {
    const element = frame.current;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || !event.deltaY) return;
      event.preventDefault();
      const rect = plot.current?.getBoundingClientRect();
      const anchor = rect ? ((event.clientX - rect.left) / rect.width - 0.1) / 0.8 : 0.5;
      setRange(previous => zoomTimelineRange({ low, high }, zoomTimelineRange({ low, high }, previous ?? { low, high }, 1), event.deltaY < 0 ? 0.8 : 1.25, anchor));
    };
    element?.addEventListener('wheel', wheel, { passive: false });
    return () => element?.removeEventListener('wheel', wheel);
  }, [low, high]);
  const zoom = (factor: number) => setRange(zoomTimelineRange(bounds, visible, factor));
  const setWindow = useCallback((window: TimelineRange) => setRange(zoomTimelineRange({ low, high }, window, 1)), [low, high]);
  const pan = (direction: number) => {
    const span = visible.high - visible.low;
    const left = Math.max(low, Math.min(high - span, visible.low + direction * span / 2));
    setRange({ low: left, high: left + span });
  };
  return { frame, plot, ...visible, zoom, pan, setWindow, reset: () => setRange(undefined), isZoomed: visible.high - visible.low < high - low - 1, atStart: visible.low <= low, atEnd: visible.high >= high };
}
