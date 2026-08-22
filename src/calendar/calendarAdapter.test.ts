// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyCalendarPresetToDom,
  getCalendarsFromDom,
  getCompleteCalendarSnapshotFromDom,
  getSafeCalendarSnapshotFromDom,
} from './calendarAdapter';

type CalendarState = {
  id: string;
  isVisible: boolean;
};

function renderCalendars(
  calendars: CalendarState[],
  onChange?: () => void,
): void {
  const sidebar = document.createElement('div');

  for (const calendar of calendars) {
    const row = document.createElement('div');
    row.dataset.id = calendar.id;

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('jsname', 'YPqjbf');
    toggle.setAttribute('data-tab-target', calendar.id);
    toggle.setAttribute('aria-label', `Calendar ${calendar.id}`);
    toggle.checked = calendar.isVisible;
    toggle.addEventListener('click', () => {
      calendar.isVisible = toggle.checked;
      onChange?.();
    });

    row.append(toggle);
    sidebar.append(row);
  }

  document.body.replaceChildren(sidebar);
}

function renderVirtualizedCalendars(
  calendars: CalendarState[],
  renderDelayMs = 0,
  scrollOnClick = false,
): HTMLElement {
  const viewport = document.createElement('div');
  const rowHeight = 32;
  const visibleRowCount = 5;
  let currentScrollTop = rowHeight * 2;

  Object.defineProperties(viewport, {
    clientHeight: { configurable: true, value: rowHeight * visibleRowCount },
    scrollHeight: { configurable: true, value: rowHeight * calendars.length },
    scrollTop: {
      configurable: true,
      get: () => currentScrollTop,
      set: (value: number) => {
        currentScrollTop = value;
        if (renderDelayMs > 0) {
          window.setTimeout(renderVisibleRows, renderDelayMs);
        } else {
          renderVisibleRows();
        }
      },
    },
  });

  const renderVisibleRows = (): void => {
    const firstIndex = Math.min(
      calendars.length - visibleRowCount,
      Math.max(0, Math.floor(currentScrollTop / rowHeight)),
    );
    const fragment = document.createDocumentFragment();

    for (
      let index = firstIndex;
      index < Math.min(calendars.length, firstIndex + visibleRowCount);
      index += 1
    ) {
      const calendar = calendars[index];
      const positioner = document.createElement('div');
      positioner.style.transform = `translateY(${index * rowHeight}px)`;

      const listItem = document.createElement('li');
      listItem.setAttribute('aria-posinset', String(index + 1));
      listItem.setAttribute('aria-setsize', String(calendars.length));

      const row = document.createElement('div');
      row.dataset.id = calendar.id;

      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.setAttribute('jsname', 'YPqjbf');
      toggle.setAttribute('data-tab-target', '');
      toggle.setAttribute('aria-label', `Calendar ${calendar.id}`);
      toggle.checked = calendar.isVisible;
      toggle.addEventListener('click', () => {
        calendar.isVisible = toggle.checked;
        if (scrollOnClick) {
          viewport.scrollTop = 0;
        } else {
          renderVisibleRows();
        }
      });

      row.append(toggle);
      listItem.append(row);
      positioner.append(listItem);
      fragment.append(positioner);
    }

    viewport.replaceChildren(fragment);
  };

  renderVisibleRows();
  document.body.replaceChildren(viewport);
  return viewport;
}

describe('calendarAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reads only data-id identifiers without writing to Google Calendar DOM', async () => {
    document.body.innerHTML = `
      <div data-id="calendar-by-data-id">
        <input type="checkbox" jsname="YPqjbf" data-tab-target="one"
          aria-label="Calendar one" checked>
      </div>
      <div data-calendar-id="legacy-id">
        <input type="checkbox" jsname="YPqjbf" data-tab-target="two"
          aria-label="Calendar two">
      </div>
    `;

    const clickSpy = vi.spyOn(HTMLElement.prototype, 'click');
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    const dispatchEventSpy = vi.spyOn(EventTarget.prototype, 'dispatchEvent');
    const scrollIntoViewSpy = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewSpy,
    });

    const snapshotPromise = getSafeCalendarSnapshotFromDom();
    await vi.runAllTimersAsync();
    const result = await snapshotPromise;

    expect(result.diagnostics.isStable).toBe(true);
    expect(result.calendars).toHaveLength(2);
    expect(result.calendars[0].identifier).toEqual({
      attribute: 'data-id',
      value: 'calendar-by-data-id',
    });
    expect(result.calendars[1].identifier).toBeNull();
    expect(clickSpy).not.toHaveBeenCalled();
    expect(focusSpy).not.toHaveBeenCalled();
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });

  it('collects all checked states from a virtualized list and restores its scroll position', async () => {
    const calendars = Array.from({ length: 25 }, (_, index) => ({
      id: `calendar-${index}`,
      isVisible: index % 3 === 0,
    }));
    const viewport = renderVirtualizedCalendars(calendars);
    const originalScrollTop = viewport.scrollTop;

    const snapshotPromise = getCompleteCalendarSnapshotFromDom();
    await vi.runAllTimersAsync();
    const result = await snapshotPromise;
    const stateById = new Map(
      result.calendars.map((calendar) => [
        calendar.identifier?.value,
        calendar.isVisible,
      ]),
    );

    expect(result.calendars).toHaveLength(25);
    expect(result.diagnostics.calendarsWithIdentifier).toBe(25);
    expect(viewport.scrollTop).toBe(originalScrollTop);
    for (let index = 0; index < calendars.length; index += 1) {
      expect(stateById.get(`calendar-${index}`)).toBe(index % 3 === 0);
    }
  });

  it('does not scroll the virtualized list for a passive popup snapshot', async () => {
    const calendars = Array.from({ length: 25 }, (_, index) => ({
      id: `calendar-${index}`,
      isVisible: index % 2 === 0,
    }));
    const viewport = renderVirtualizedCalendars(calendars);
    const originalScrollTop = viewport.scrollTop;

    const snapshotPromise = getSafeCalendarSnapshotFromDom();
    await vi.runAllTimersAsync();
    const result = await snapshotPromise;

    expect(result.calendars).toHaveLength(5);
    expect(viewport.scrollTop).toBe(originalScrollTop);
  });

  it('repeatedly applies 10+ targets spread across a delayed virtualized list', async () => {
    const calendars = Array.from({ length: 30 }, (_, index) => ({
      id: `calendar-${index}`,
      isVisible: index % 3 === 0,
    }));
    const targetIds = calendars
      .filter((_, index) => index % 2 === 1)
      .map(({ id }) => id);
    const viewport = renderVirtualizedCalendars(calendars, 250);
    const originalScrollTop = viewport.scrollTop;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const applyPromise = applyCalendarPresetToDom(targetIds);
      await vi.runAllTimersAsync();
      const result = await applyPromise;

      expect(result.missingCalendarIds).toEqual([]);
      expect(viewport.scrollTop).toBe(originalScrollTop);
      if (attempt > 0) expect(result.changedCalendarCount).toBe(0);
      for (const calendar of calendars) {
        expect(calendar.isVisible).toBe(targetIds.includes(calendar.id));
      }
    }
  });

  it('applies a preset whose calendars are near each other', async () => {
    const calendars = Array.from({ length: 25 }, (_, index) => ({
      id: `calendar-${index}`,
      isVisible: false,
    }));
    const targetIds = calendars.slice(10, 15).map(({ id }) => id);
    renderVirtualizedCalendars(calendars, 100, true);

    const applyPromise = applyCalendarPresetToDom(targetIds);
    await vi.runAllTimersAsync();
    const result = await applyPromise;

    expect(result.missingCalendarIds).toEqual([]);
    for (const calendar of calendars) {
      expect(calendar.isVisible).toBe(targetIds.includes(calendar.id));
    }
  });

  it('reports a calendar as missing only after searching the virtual list', async () => {
    const calendars = Array.from({ length: 25 }, (_, index) => ({
      id: `calendar-${index}`,
      isVisible: index % 2 === 0,
    }));
    const viewport = renderVirtualizedCalendars(calendars, 200);
    const originalScrollTop = viewport.scrollTop;

    const applyPromise = applyCalendarPresetToDom(['missing-calendar']);
    await vi.runAllTimersAsync();
    const result = await applyPromise;

    expect(result.missingCalendarIds).toEqual(['missing-calendar']);
    expect(viewport.scrollTop).toBe(originalScrollTop);
    expect(calendars.every((calendar) => !calendar.isVisible)).toBe(true);
  });

  it('applies a preset to 25 calendars by data-id after every DOM reorder', async () => {
    const calendars = Array.from({ length: 25 }, (_, index) => ({
      id: index === 0 ? 'account@example.com' : `calendar-${index}`,
      isVisible: index % 2 !== 0,
    }));
    const targetIds = calendars
      .slice(1)
      .filter((_, index) => index % 2 !== 0)
      .map(({ id }) => id);
    let renderedOrder = [...calendars];

    const rerenderInReverseOrder = (): void => {
      renderedOrder = [...renderedOrder].reverse();
      renderCalendars(renderedOrder, rerenderInReverseOrder);
      const accountLink = document.createElement('a');
      accountLink.href = 'https://accounts.google.com/SignOutOptions';
      accountLink.setAttribute('aria-label', 'Account account@example.com');
      document.body.append(accountLink);
    };
    rerenderInReverseOrder();

    const applyPromise = applyCalendarPresetToDom(targetIds);
    await vi.runAllTimersAsync();
    const result = await applyPromise;
    const finalSnapshot = getCalendarsFromDom();
    const finalStateById = new Map(
      finalSnapshot.calendars.map((calendar) => [
        calendar.identifier?.value,
        calendar.isVisible,
      ]),
    );

    expect(result.missingCalendarIds).toEqual([]);
    expect(result.changedCalendarCount).toBe(25);
    expect(finalSnapshot.calendars).toHaveLength(25);
    expect(finalStateById.get('account@example.com')).toBe(true);
    for (let index = 1; index < 25; index += 1) {
      expect(finalStateById.get(`calendar-${index}`)).toBe(
        targetIds.includes(`calendar-${index}`),
      );
    }
  });
});
