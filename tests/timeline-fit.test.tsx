import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraduateTimeline, type TimelineItem } from '../src/components/GraduateTimeline';
import { DAY, dateStamp } from '../src/lib/graduateTimeline';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const items: TimelineItem[] = ['2026-09-08', '2026-10-13', '2026-11-03'].map((dueDate, index) => ({ type: 'UEC', color: '#003C71', task: { key: `stage-${index}`, title: `Meeting ${index + 1}`, owner: 'Student / Supervisor', timing: '', dueDate, itemType: 'Meeting' } }));

describe('fit to stages timeline control', () => {
  it('fits each timeline independently from Today to its last stage and supports reset', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    render(<><GraduateTimeline label="Overall" items={items} start="2026-09-01" end="2028-08-31" today="2026-10-02" variant="curriculum"/><GraduateTimeline label="Committee" items={items.slice(0, 2)} start="2026-09-01" end="2028-08-31" today="2026-10-02" variant="curriculum"/></>);
    const overall = screen.getByRole('region', { name: 'Overall' });
    const committee = screen.getByRole('region', { name: 'Committee' });
    const range = (element: HTMLElement) => element.querySelector('[data-visible-start]')!;
    const originalLow = range(overall).getAttribute('data-visible-start');
    const originalHigh = range(overall).getAttribute('data-visible-end');
    fireEvent.click(within(overall).getByRole('button', { name: 'Fit to stages' }));
    expect(Number(range(overall).getAttribute('data-visible-start'))).toBe(dateStamp('2026-10-02') - 4 * DAY);
    expect(Number(range(overall).getAttribute('data-visible-end'))).toBe(dateStamp('2026-11-03') + 4 * DAY);
    expect(range(committee).getAttribute('data-visible-end')).toBe(originalHigh);
    expect(within(overall).queryByRole('button', { name: /Meeting 1 —/ })).not.toBeInTheDocument();
    expect(within(overall).getByRole('button', { name: /Meeting 3 —/ })).toBeInTheDocument();
    fireEvent.click(within(committee).getByRole('button', { name: 'Fit to stages' }));
    expect(Number(range(committee).getAttribute('data-visible-end'))).toBe(dateStamp('2026-10-13') + 4 * DAY);
    fireEvent.click(within(overall).getByRole('button', { name: 'Reset zoom' }));
    expect(range(overall).getAttribute('data-visible-start')).toBe(originalLow);
    expect(range(overall).getAttribute('data-visible-end')).toBe(originalHigh);
  });

  it.each([{ past: [] }, { past: items.slice(0, 1) }])('keeps Today visible when no future stages exist', ({ past }) => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    render(<GraduateTimeline label="Past plan" items={past} start="2026-09-01" end="2026-09-30" today="2026-10-02"/>);
    fireEvent.click(screen.getByRole('button', { name: 'Fit to stages' }));
    const range = screen.getByRole('region', { name: 'Past plan' }).querySelector('[data-visible-start]')!;
    expect(Number(range.getAttribute('data-visible-start'))).toBe(dateStamp('2026-10-02') - 4 * DAY);
    expect(Number(range.getAttribute('data-visible-end'))).toBe(dateStamp('2026-10-02') + 4 * DAY);
  });
});
