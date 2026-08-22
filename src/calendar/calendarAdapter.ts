import type {
  CalendarDomDiagnostics,
  CalendarDomItem,
  CalendarIdentifier,
} from '../shared/calendarMessaging';

export const CALENDAR_TOGGLE_SELECTOR =
  'input[type="checkbox"][jsname="YPqjbf"][data-tab-target]';

const MAX_ANCESTOR_DEPTH = 8;
const DOM_STABILITY_POLL_INTERVAL_MS = 150;
const DOM_STABILITY_MAX_ATTEMPTS = 15;
const REQUIRED_STABLE_SNAPSHOTS = 3;
const REQUIRED_SAFE_READ_SNAPSHOTS = 6;
const VIRTUAL_LIST_SCAN_ATTEMPTS = 3;
const DOM_MUTATION_TIMEOUT_MS = 750;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

type CalendarIdentityElement = {
  element: HTMLElement;
  identifier: CalendarIdentifier;
};

type CurrentCalendarDomEntry = {
  calendar: CalendarDomItem;
  toggle: HTMLInputElement;
  scrollContainer: HTMLElement | null;
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

function isCalendarVisible(toggle: HTMLInputElement): boolean {
  return toggle.checked;
}

function findScrollContainer(toggle: HTMLElement): HTMLElement | null {
  const virtualRow = toggle.closest<HTMLElement>(
    'li[aria-posinset][aria-setsize]',
  );
  let current = virtualRow?.parentElement ?? null;

  while (current && current !== document.body) {
    if (current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }

  return null;
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
    document.querySelectorAll<HTMLInputElement>(CALENDAR_TOGGLE_SELECTOR),
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
      scrollContainer: findScrollContainer(toggle),
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
// Read operations
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

function waitForDomCondition(
  root: Node,
  condition: () => boolean,
  timeoutMs = DOM_MUTATION_TIMEOUT_MS,
): Promise<boolean> {
  if (condition()) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      resolve(result);
    };
    const observer = new MutationObserver(() => {
      if (condition()) finish(true);
    });
    const timeoutId = window.setTimeout(
      () => finish(condition()),
      timeoutMs,
    );

    observer.observe(root, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    // Close the gap between the first check and observer registration.
    if (condition()) finish(true);
  });
}

function waitForChangedDomToSettle(
  root: Node,
  previousSignature: string,
  getSignature: () => string,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let quietTimerId: number | undefined;
    const finish = (domUpdated: boolean): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      if (quietTimerId !== undefined) window.clearTimeout(quietTimerId);
      resolve(domUpdated);
    };
    const detectUpdate = (): void => {
      const signature = getSignature();
      if (!signature || signature === previousSignature) return;

      if (quietTimerId !== undefined) window.clearTimeout(quietTimerId);
      quietTimerId = window.setTimeout(() => finish(true), 50);
    };
    const observer = new MutationObserver(detectUpdate);
    const timeoutId = window.setTimeout(
      () => finish(false),
      DOM_MUTATION_TIMEOUT_MS,
    );

    observer.observe(root, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    detectUpdate();
  });
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

/** Explicit user actions may traverse the virtual list for a complete snapshot. */
export function getCompleteCalendarSnapshotFromDom(): Promise<CalendarDomResult> {
  return scanAllCalendarsFromDom();
}

function getCalendarCollectionKey(calendar: CalendarDomItem): string {
  return calendar.identifier
    ? `id:${calendar.identifier.value}`
    : `name:${calendar.name}`;
}

function addEntriesToScan(
  entries: CurrentCalendarDomEntry[],
  calendarsByKey: Map<string, CalendarDomItem>,
  scrollContainers: Set<HTMLElement>,
): void {
  for (const entry of entries) {
    calendarsByKey.set(getCalendarCollectionKey(entry.calendar), entry.calendar);

    if (entry.scrollContainer) scrollContainers.add(entry.scrollContainer);
  }
}

function getScrollContainerSignature(scrollContainer: HTMLElement): string {
  return queryCurrentCalendarEntries()
    .entries.filter((entry) => entry.scrollContainer === scrollContainer)
    .map((entry) => {
      const calendarId = entry.calendar.identifier?.value ?? entry.calendar.name;
      return `${calendarId}:${entry.calendar.isVisible}`;
    })
    .sort()
    .join('|');
}

async function scrollAndWaitForDomUpdate(
  scrollContainer: HTMLElement,
  scrollTop: number,
): Promise<boolean> {
  if (scrollContainer.scrollTop === scrollTop) return true;

  const previousSignature = getScrollContainerSignature(scrollContainer);
  const domUpdated = waitForChangedDomToSettle(
    scrollContainer,
    previousSignature,
    () => getScrollContainerSignature(scrollContainer),
  );

  scrollContainer.scrollTop = scrollTop;
  return domUpdated;
}

/**
 * Walks each virtualized calendar list and restores the user's scroll position.
 * Google Calendar only mounts the rows around the current scroll position.
 */
async function scanAllCalendarsFromDom(): Promise<CalendarDomResult> {
  const initialResult = await getStableCalendarsFromDom(
    [],
    REQUIRED_SAFE_READ_SNAPSHOTS,
  );

  const calendarsByKey = new Map<string, CalendarDomItem>();
  const scrollContainers = new Set<HTMLElement>();
  const originalScrollTops = new Map<HTMLElement, number>();
  let matchedToggleCount = 0;
  let signedInAccountVisible = false;

  const collectCurrentEntries = (): void => {
    const current = queryCurrentCalendarEntries();
    matchedToggleCount = Math.max(
      matchedToggleCount,
      current.diagnostics.matchedToggleCount,
    );
    signedInAccountVisible ||= current.diagnostics.signedInAccountVisible;
    addEntriesToScan(
      current.entries,
      calendarsByKey,
      scrollContainers,
    );
  };

  collectCurrentEntries();

  try {
    for (let attempt = 0; attempt < VIRTUAL_LIST_SCAN_ATTEMPTS; attempt += 1) {
      let scanNeedsRetry = false;

      for (const scrollContainer of scrollContainers) {
        if (!scrollContainer.isConnected) continue;

        if (!originalScrollTops.has(scrollContainer)) {
          originalScrollTops.set(scrollContainer, scrollContainer.scrollTop);
        }

        const maximumScrollTop = Math.max(
          0,
          scrollContainer.scrollHeight - scrollContainer.clientHeight,
        );
        const scrollStep = Math.max(
          32,
          Math.floor(scrollContainer.clientHeight * 0.75),
        );
        const scrollOffsets: number[] = [];

        for (
          let scrollTop = 0;
          scrollTop < maximumScrollTop;
          scrollTop += scrollStep
        ) {
          scrollOffsets.push(scrollTop);
        }
        scrollOffsets.push(maximumScrollTop);

        if (attempt % 2 === 1) scrollOffsets.reverse();

        for (const scrollTop of scrollOffsets) {
          const domUpdated = await scrollAndWaitForDomUpdate(
            scrollContainer,
            scrollTop,
          );
          scanNeedsRetry ||= !domUpdated;
          collectCurrentEntries();
        }
      }

      if (!scanNeedsRetry) break;
    }
  } finally {
    for (const [scrollContainer, originalScrollTop] of originalScrollTops) {
      if (scrollContainer.isConnected) {
        await scrollAndWaitForDomUpdate(scrollContainer, originalScrollTop);
      }
    }
    collectCurrentEntries();
  }

  const calendars = [...calendarsByKey.values()];

  return {
    calendars,
    diagnostics: {
      matchedToggleCount: Math.max(matchedToggleCount, calendars.length),
      calendarsWithIdentifier: calendars.filter(
        (calendar) => calendar.identifier !== null,
      ).length,
      signedInAccountVisible,
      isStable: initialResult.diagnostics.isStable,
    },
  };
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

async function waitForCalendarState(
  calendarId: string,
  isVisible: boolean,
): Promise<boolean> {
  return waitForDomCondition(document.body, () => {
    const currentEntry = findCurrentCalendarByDataId(calendarId);
    return currentEntry?.calendar.isVisible === isVisible;
  });
}

/**
 * Applies a preset. Every write is preceded by a fresh data-id lookup because
 * Google Calendar can replace or reorder sidebar nodes after each click.
 */
export async function applyCalendarPresetToDom(
  calendarIds: string[],
): Promise<ApplyCalendarPresetResult> {
  const targetCalendarIds = new Set(calendarIds);
  await getStableCalendarsFromDom([], REQUIRED_SAFE_READ_SNAPSHOTS);

  const processedCalendarIds = new Set<string>();
  const scrollContainers = new Set<HTMLElement>();
  const originalScrollTops = new Map<HTMLElement, number>();
  let changedCalendarCount = 0;

  const processCurrentEntries = async (): Promise<void> => {
    const currentEntries = queryCurrentCalendarEntries().entries;
    for (const entry of currentEntries) {
      if (entry.scrollContainer) scrollContainers.add(entry.scrollContainer);

      const calendarId = entry.calendar.identifier?.value;
      if (!calendarId || processedCalendarIds.has(calendarId)) continue;

      // A virtual row can be replaced between reads, so resolve it again by ID.
      const currentEntry = findCurrentCalendarByDataId(calendarId);
      if (!currentEntry) continue;

      processedCalendarIds.add(calendarId);
      const shouldBeVisible =
        currentEntry.calendar.isSelf === true ||
        targetCalendarIds.has(calendarId);
      if (currentEntry.calendar.isVisible === shouldBeVisible) continue;

      const scrollContainer = currentEntry.scrollContainer;
      const scrollTopBeforeClick = scrollContainer?.scrollTop;
      currentEntry.toggle.click();
      changedCalendarCount += 1;

      const restoreUnexpectedClickScroll = async (): Promise<void> => {
        if (
          scrollContainer?.isConnected &&
          scrollTopBeforeClick !== undefined &&
          scrollContainer.scrollTop !== scrollTopBeforeClick
        ) {
          await scrollAndWaitForDomUpdate(
            scrollContainer,
            scrollTopBeforeClick,
          );
        }
      };

      await restoreUnexpectedClickScroll();
      let stateChanged = await waitForCalendarState(
        calendarId,
        shouldBeVisible,
      );
      if (!stateChanged) {
        await restoreUnexpectedClickScroll();
        stateChanged = await waitForCalendarState(calendarId, shouldBeVisible);
      }
      if (!stateChanged) {
        throw new Error(`Calendar state did not change: ${calendarId}`);
      }
    }
  };

  await processCurrentEntries();

  try {
    for (let attempt = 0; attempt < VIRTUAL_LIST_SCAN_ATTEMPTS; attempt += 1) {
      let scanNeedsRetry = false;

      for (const scrollContainer of scrollContainers) {
        if (!scrollContainer.isConnected) continue;
        if (!originalScrollTops.has(scrollContainer)) {
          originalScrollTops.set(scrollContainer, scrollContainer.scrollTop);
        }

        const maximumScrollTop = Math.max(
          0,
          scrollContainer.scrollHeight - scrollContainer.clientHeight,
        );
        const scrollStep = Math.max(
          32,
          Math.floor(scrollContainer.clientHeight * 0.75),
        );
        const scrollOffsets: number[] = [];
        for (
          let scrollTop = 0;
          scrollTop < maximumScrollTop;
          scrollTop += scrollStep
        ) {
          scrollOffsets.push(scrollTop);
        }
        scrollOffsets.push(maximumScrollTop);
        if (attempt % 2 === 1) scrollOffsets.reverse();

        for (const scrollTop of scrollOffsets) {
          const domUpdated = await scrollAndWaitForDomUpdate(
            scrollContainer,
            scrollTop,
          );
          scanNeedsRetry ||= !domUpdated;
          await processCurrentEntries();
        }
      }

      const allTargetsFound = [...targetCalendarIds].every((calendarId) =>
        processedCalendarIds.has(calendarId),
      );
      if (!scanNeedsRetry && allTargetsFound) break;
    }
  } finally {
    for (const [scrollContainer, originalScrollTop] of originalScrollTops) {
      if (scrollContainer.isConnected) {
        await scrollAndWaitForDomUpdate(scrollContainer, originalScrollTop);
      }
    }
  }

  return {
    changedCalendarCount,
    missingCalendarIds: [...targetCalendarIds].filter(
      (calendarId) => !processedCalendarIds.has(calendarId),
    ),
  };
}
