// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyCalendarPresetToDom,
  getCalendarsFromDom,
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
