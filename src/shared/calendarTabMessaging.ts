import { browser } from 'wxt/browser';
import { isGoogleCalendarUrl } from '../utils/googleCalendarUrl';

const CONTENT_SCRIPT_FILE = 'content-scripts/google-calendar.js';
const MISSING_RECEIVER_ERROR =
  'Could not establish connection. Receiving end does not exist';

type CalendarTab = {
  id?: number;
  url?: string;
};

export function isMissingContentScriptError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes(MISSING_RECEIVER_ERROR)
  );
}

export async function sendCalendarTabMessage<TResponse>(
  tab: CalendarTab,
  message: unknown,
): Promise<TResponse | undefined> {
  if (tab.id === undefined) {
    throw new Error('Active tab is unavailable');
  }

  try {
    return (await browser.tabs.sendMessage(tab.id, message)) as
      | TResponse
      | undefined;
  } catch (error) {
    if (
      !isMissingContentScriptError(error) ||
      !isGoogleCalendarUrl(tab.url)
    ) {
      throw error;
    }

    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: [CONTENT_SCRIPT_FILE],
    });

    return (await browser.tabs.sendMessage(tab.id, message)) as
      | TResponse
      | undefined;
  }
}
