import type { CalendarDomItem } from '../shared/calendarMessaging';
import type { CalendarPreset } from '../types/calendarPreset';

export type ComparableCalendarIdsResult =
  | { ok: true; calendarIds: string[] }
  | { ok: false; error: string };

export function getComparableCalendarIds(
  calendars: CalendarDomItem[],
): ComparableCalendarIdsResult {
  const visibleCalendars = calendars.filter(
    (calendar) => calendar.isVisible && calendar.isSelf !== true,
  );
  const calendarWithoutIdentifier = visibleCalendars.find(
    (calendar) => calendar.identifier === null,
  );

  if (calendarWithoutIdentifier) {
    return {
      ok: false,
      error: `「${calendarWithoutIdentifier.name}」の識別情報を取得できません。`,
    };
  }

  return {
    ok: true,
    calendarIds: [
      ...new Set(
        visibleCalendars.map((calendar) => calendar.identifier!.value),
      ),
    ],
  };
}

export function haveSameCalendarIds(
  firstCalendarIds: string[],
  secondCalendarIds: string[],
): boolean {
  const firstSet = new Set(firstCalendarIds);
  const secondSet = new Set(secondCalendarIds);

  return (
    firstSet.size === secondSet.size &&
    [...firstSet].every((calendarId) => secondSet.has(calendarId))
  );
}

export function findMatchingPreset(
  presets: CalendarPreset[],
  currentCalendarIds: string[],
): CalendarPreset | null {
  return (
    presets.find((preset) =>
      haveSameCalendarIds(preset.calendarIds, currentCalendarIds),
    ) ?? null
  );
}
