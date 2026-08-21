import type {
  CalendarDomDiagnostics,
  CalendarDomItem,
  CalendarIdentifier,
} from '../shared/calendarMessaging';

const CALENDAR_TOGGLE_SELECTOR = [
  'input[type="checkbox"][jsname="YPqjbf"][data-tab-target]',
  '[data-id] [role="checkbox"][aria-checked]',
  '[role="checkbox"][aria-checked][data-id]',
].join(',');

const MAX_ANCESTOR_DEPTH = 8;
const DOM_STABILITY_POLL_INTERVAL_MS = 150;
const DOM_STABILITY_MAX_ATTEMPTS = 15;
const REQUIRED_STABLE_SNAPSHOTS = 3;
const REQUIRED_SAFE_READ_SNAPSHOTS = 6;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

type CalendarIdentityElement = {
  element: HTMLElement;
  identifier: CalendarIdentifier;
};

type CurrentCalendarDomEntry = {
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
    const value = normalizeText(current.getAttribute('data-id'));

    if (value) {
      return {
        element: current,
        identifier: { attribute: 'data-id', value },
      };
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

/** Low-level fresh DOM query shared by the reader and writer. */
function queryCurrentCalendarEntries(): {
  entries: CurrentCalendarDomEntry[];
  diagnostics: CalendarDomDiagnostics;
} {
  const toggles = Array.from(
    document.querySelectorAll<HTMLElement>(CALENDAR_TOGGLE_SELECTOR),
  );
  const accountEmail = findSignedInAccountEmail();
  const seenIdentifiers = new Set<string>();
  const seenToggles = new Set<HTMLElement>();
  const entries: CurrentCalendarDomEntry[] = [];

  for (const toggle of toggles) {
    if (seenToggles.has(toggle)) continue;
    seenToggles.add(toggle);

    const identity = findIdentityElement(toggle);
    if (identity) {
      const identityKey = identity.identifier.value;
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
      isStable: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Read-only operations (no click, focus, scrolling, or event dispatch)
// ---------------------------------------------------------------------------

export function getCalendarsFromDom(): CalendarDomResult {
  const { entries, diagnostics } = queryCurrentCalendarEntries();

  return {
    calendars: entries.map(({ calendar }) => calendar),
    diagnostics,
  };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function getCalendarSnapshotSignature(result: CalendarDomResult): string {
  return result.calendars
    .map((calendar) => {
      const identifier = calendar.identifier
        ? `${calendar.identifier.attribute}:${calendar.identifier.value}`
        : `name:${calendar.name}`;
      return `${identifier}:${calendar.isVisible}`;
    })
    .sort()
    .join('|');
}

function containsExpectedCalendarIds(
  result: CalendarDomResult,
  expectedCalendarIds: string[],
): boolean {
  const availableCalendarIds = new Set(
    result.calendars.flatMap((calendar) =>
      calendar.identifier ? [calendar.identifier.value] : [],
    ),
  );

  return expectedCalendarIds.every((calendarId) =>
    availableCalendarIds.has(calendarId),
  );
}

/** Waits until consecutive reads return the same sidebar state. */
export async function getStableCalendarsFromDom(
  expectedCalendarIds: string[] = [],
  requiredStableSnapshots = REQUIRED_STABLE_SNAPSHOTS,
): Promise<CalendarDomResult> {
  let latestResult = getCalendarsFromDom();
  let latestSignature = getCalendarSnapshotSignature(latestResult);
  let stableSnapshotCount = 1;

  for (let attempt = 1; attempt < DOM_STABILITY_MAX_ATTEMPTS; attempt += 1) {
    await wait(DOM_STABILITY_POLL_INTERVAL_MS);

    const nextResult = getCalendarsFromDom();
    const nextSignature = getCalendarSnapshotSignature(nextResult);
    stableSnapshotCount =
      nextSignature === latestSignature ? stableSnapshotCount + 1 : 1;
    latestResult = nextResult;
    latestSignature = nextSignature;

    if (
      stableSnapshotCount >= requiredStableSnapshots &&
      containsExpectedCalendarIds(latestResult, expectedCalendarIds)
    ) {
      return {
        ...latestResult,
        diagnostics: {
          ...latestResult.diagnostics,
          isStable: true,
        },
      };
    }
  }

  return latestResult;
}

/** Uses a longer observation window for snapshots that may be persisted. */
export function getSafeCalendarSnapshotFromDom(): Promise<CalendarDomResult> {
  return getStableCalendarsFromDom([], REQUIRED_SAFE_READ_SNAPSHOTS);
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/** Finds the current node by data-id. Returned DOM references are not cached. */
function findCurrentCalendarByDataId(
  calendarId: string,
): CurrentCalendarDomEntry | null {
  return (
    queryCurrentCalendarEntries().entries.find(
      ({ calendar }) => calendar.identifier?.value === calendarId,
    ) ?? null
  );
}

/** Takes only immutable IDs from the current DOM; element references do not escape. */
function readAvailableCalendarIds(): string[] {
  return queryCurrentCalendarEntries().entries.flatMap(({ calendar }) =>
    calendar.identifier ? [calendar.identifier.value] : [],
  );
}

async function waitForCalendarState(
  calendarId: string,
  isVisible: boolean,
): Promise<void> {
  for (let attempt = 0; attempt < DOM_STABILITY_MAX_ATTEMPTS; attempt += 1) {
    await wait(DOM_STABILITY_POLL_INTERVAL_MS);
    const currentEntry = findCurrentCalendarByDataId(calendarId);
    if (currentEntry?.calendar.isVisible === isVisible) return;
  }
}

/**
 * Applies a preset. Every write is preceded by a fresh data-id lookup because
 * Google Calendar can replace or reorder sidebar nodes after each click.
 */
export async function applyCalendarPresetToDom(
  calendarIds: string[],
): Promise<ApplyCalendarPresetResult> {
  const targetCalendarIds = new Set(calendarIds);
  await getStableCalendarsFromDom();
  const availableCalendarIds = new Set(readAvailableCalendarIds());
  const calendarIdsToProcess = [...availableCalendarIds];
  const availableTargetCalendarIds = calendarIds.filter((calendarId) =>
    availableCalendarIds.has(calendarId),
  );
  let changedCalendarCount = 0;

  for (const calendarId of calendarIdsToProcess) {
    const currentEntry = findCurrentCalendarByDataId(calendarId);
    if (!currentEntry) continue;

    const shouldBeVisible =
      currentEntry.calendar.isSelf === true || targetCalendarIds.has(calendarId);

    if (currentEntry.calendar.isVisible === shouldBeVisible) continue;

    currentEntry.toggle.click();
    changedCalendarCount += 1;
    await waitForCalendarState(calendarId, shouldBeVisible);
  }

  await getStableCalendarsFromDom(availableTargetCalendarIds);

  return {
    changedCalendarCount,
    missingCalendarIds: [...targetCalendarIds].filter(
      (calendarId) => !availableCalendarIds.has(calendarId),
    ),
  };
}
