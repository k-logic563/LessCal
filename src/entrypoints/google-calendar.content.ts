import { browser } from 'wxt/browser';
import {
  applyCalendarPresetToDom,
  getSafeCalendarSnapshotFromDom,
} from '../calendar/calendarAdapter';
import {
  isApplyCalendarPresetMessage,
  isGetCalendarsMessage,
  type CalendarMessageResponse,
} from '../shared/calendarMessaging';

export default defineContentScript({
  matches: ['https://calendar.google.com/*'],
  main() {
    browser.runtime.onMessage.addListener(
      async (message: unknown): Promise<CalendarMessageResponse | undefined> => {
        if (isGetCalendarsMessage(message)) {
          try {
            const result = await getSafeCalendarSnapshotFromDom();
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
          try {
            const result = await applyCalendarPresetToDom(message.calendarIds);
            return { ok: true, ...result };
          } catch {
            return {
              ok: false,
              error: 'プリセットをGoogleカレンダーへ適用できませんでした。',
            };
          }
        }

        return undefined;
      },
    );
  },
});
