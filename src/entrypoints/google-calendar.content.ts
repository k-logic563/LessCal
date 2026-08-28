import { browser } from 'wxt/browser';
import {
  applyCalendarPresetToDom,
  CALENDAR_TOGGLE_SELECTOR,
  getCompleteCalendarSnapshotFromDom,
  getSafeCalendarSnapshotFromDom,
} from '../calendar/calendarAdapter';
import {
  clearSelectedPresetId,
  setSelectedPresetId,
} from '../services/selectedPresetService';
import {
  isApplyCalendarPresetMessage,
  isGetCalendarsMessage,
  type CalendarMessageResponse,
} from '../shared/calendarMessaging';

export default defineContentScript({
  matches: ['https://calendar.google.com/*'],
  main(ctx) {
    let isApplyingPreset = false;

    ctx.addEventListener(
      document,
      'change',
      (event) => {
        if (
          isApplyingPreset ||
          !(event.target instanceof HTMLInputElement) ||
          !event.target.matches(CALENDAR_TOGGLE_SELECTOR)
        ) {
          return;
        }

        void clearSelectedPresetId().catch(() => undefined);
      },
      { capture: true },
    );

    const handleMessage = async (
      message: unknown,
    ): Promise<CalendarMessageResponse | undefined> => {
      if (isGetCalendarsMessage(message)) {
        try {
          const result = message.allowScroll
            ? await getCompleteCalendarSnapshotFromDom()
            : await getSafeCalendarSnapshotFromDom();
          if (!result.diagnostics.isStable) {
            throw new Error('Calendar DOM did not stabilize');
          }
          return { ok: true, ...result };
        } catch {
          return {
            ok: false,
            error: 'Googleカレンダーの一覧を読み取れませんでした。',
          };
        }
      }

      if (isApplyCalendarPresetMessage(message)) {
        isApplyingPreset = true;
        try {
          const result = await applyCalendarPresetToDom(message.calendarIds);

          if (result.missingCalendarIds.length === 0) {
            await setSelectedPresetId(message.presetId);
          } else {
            await clearSelectedPresetId();
          }

          return { ok: true, ...result };
        } catch {
          await clearSelectedPresetId();
          return {
            ok: false,
            error: 'プリセットをGoogleカレンダーへ適用できませんでした。',
          };
        } finally {
          isApplyingPreset = false;
        }
      }

      return undefined;
    };

    browser.runtime.onMessage.addListener(handleMessage);
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(handleMessage);
    });
  },
});
