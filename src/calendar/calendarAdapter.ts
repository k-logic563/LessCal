import type {
  CalendarDomDiagnostics,
  CalendarDomItem,
  CalendarIdentifier,
} from '../shared/calendarMessaging';

const CALENDAR_TOGGLE_SELECTOR = [
  'input[type="checkbox"][jsname="YPqjbf"][data-tab-target]',
  '[data-calendar-id] [role="checkbox"][aria-checked]',
  '[data-id] [role="checkbox"][aria-checked]',
  '[role="checkbox"][aria-checked][data-calendar-id]',
  '[role="checkbox"][aria-checked][data-id]',
].join(',');

const IDENTIFIER_ATTRIBUTES = ['data-id', 'data-calendar-id'] as const;
const MAX_ANCESTOR_DEPTH = 8;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

type CalendarIdentityElement = {
  element: HTMLElement;
  identifier: CalendarIdentifier;
};

type CalendarDomEntry = {
  calendar: CalendarDomItem;
  toggle: HTMLElement;
};

export type CalendarDomResult = {
  calendars: CalendarDomItem[];
  diagnostics: CalendarDomDiagnostics;
};

export type ApplyCalendarPresetResult = {
  changedCalendarCount: number;
  missingCalendarIds: string[];
};

function normalizeText(value: string | null): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function findIdentityElement(toggle: HTMLElement): CalendarIdentityElement | null {
  let current: HTMLElement | null = toggle;
  let depth = 0;

  while (current && current !== document.body && depth <= MAX_ANCESTOR_DEPTH) {
    for (const attribute of IDENTIFIER_ATTRIBUTES) {
      const value = normalizeText(current.getAttribute(attribute));

      if (value) {
        return {
          element: current,
          identifier: { attribute, value },
        };
      }
    }

    current = current.parentElement;
    depth += 1;
  }

  return null;
}

function findCalendarName(
  toggle: HTMLElement,
  rowElement: HTMLElement,
): string | null {
  const directLabel = normalizeText(toggle.getAttribute('aria-label'));
  if (directLabel) return directLabel;

  const tooltip = normalizeText(toggle.getAttribute('data-tooltip'));
  if (tooltip) return tooltip;

  return normalizeText(rowElement.textContent);
}

function isCalendarVisible(toggle: HTMLElement): boolean {
  if (toggle instanceof HTMLInputElement) return toggle.checked;

  return toggle.getAttribute('aria-checked') === 'true';
}

function findSignedInAccountEmail(): string | null {
  const accountLinks = document.querySelectorAll<HTMLAnchorElement>(
    'a[href*="accounts.google.com"][aria-label], a[href*="SignOutOptions"][aria-label]',
  );

  for (const link of accountLinks) {
    const email = link.getAttribute('aria-label')?.match(EMAIL_PATTERN)?.[0];
    if (email) return email.toLowerCase();
  }

  return null;
}

function isMatchingAccount(
  identifier: CalendarIdentifier,
  accountEmail: string | null,
): true | null {
  if (!accountEmail) return null;

  return identifier.value.toLowerCase() === accountEmail ? true : null;
}

/**
 * Reads Google Calendar's sidebar without changing its DOM.
 *
 * Google Calendar does not publish a stable DOM contract. All selectors that
 * depend on its current markup are intentionally kept in this adapter.
 */
function readCalendarEntries(): {
  entries: CalendarDomEntry[];
  diagnostics: CalendarDomDiagnostics;
} {
  const toggles = Array.from(
    document.querySelectorAll<HTMLElement>(CALENDAR_TOGGLE_SELECTOR),
  );
  const accountEmail = findSignedInAccountEmail();
  const seenIdentifiers = new Set<string>();
  const seenToggles = new Set<HTMLElement>();
  const entries: CalendarDomEntry[] = [];

  for (const toggle of toggles) {
    if (seenToggles.has(toggle)) continue;
    seenToggles.add(toggle);

    const identity = findIdentityElement(toggle);
    if (identity) {
      const identityKey = `${identity.identifier.attribute}:${identity.identifier.value}`;
      if (seenIdentifiers.has(identityKey)) continue;
      seenIdentifiers.add(identityKey);
    }

    const rowElement = identity?.element ?? toggle.parentElement ?? toggle;
    const name = findCalendarName(toggle, rowElement);
    if (!name) continue;

    entries.push({
      toggle,
      calendar: {
        name,
        isVisible: isCalendarVisible(toggle),
        identifier: identity?.identifier ?? null,
        isSelf: identity
          ? isMatchingAccount(identity.identifier, accountEmail)
          : null,
      },
    });
  }

  return {
    entries,
    diagnostics: {
      matchedToggleCount: toggles.length,
      calendarsWithIdentifier: entries.filter(
        ({ calendar }) => calendar.identifier !== null,
      ).length,
      signedInAccountVisible: accountEmail !== null,
    },
  };
}

export function getCalendarsFromDom(): CalendarDomResult {
  const { entries, diagnostics } = readCalendarEntries();

  return {
    calendars: entries.map(({ calendar }) => calendar),
    diagnostics,
  };
}

/** Applies a preset by clicking only calendars whose current state differs. */
export function applyCalendarPresetToDom(
  calendarIds: string[],
): ApplyCalendarPresetResult {
  const targetCalendarIds = new Set(calendarIds);
  const { entries } = readCalendarEntries();
  const availableCalendarIds = new Set<string>();
  let changedCalendarCount = 0;

  for (const { calendar, toggle } of entries) {
    if (calendar.identifier?.attribute !== 'data-id') continue;

    const calendarId = calendar.identifier.value;
    availableCalendarIds.add(calendarId);

    const shouldBeVisible =
      calendar.isSelf === true || targetCalendarIds.has(calendarId);

    if (calendar.isVisible === shouldBeVisible) continue;

    toggle.click();
    changedCalendarCount += 1;
  }

  return {
    changedCalendarCount,
    missingCalendarIds: [...targetCalendarIds].filter(
      (calendarId) => !availableCalendarIds.has(calendarId),
    ),
  };
}
