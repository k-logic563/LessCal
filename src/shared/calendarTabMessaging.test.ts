import { beforeEach, describe, expect, it, vi } from 'vitest';

const extensionApi = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  executeScript: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      sendMessage: extensionApi.sendMessage,
    },
    scripting: {
      executeScript: extensionApi.executeScript,
    },
  },
}));

import { sendCalendarTabMessage } from './calendarTabMessaging';

const googleCalendarTab = {
  id: 42,
  url: 'https://calendar.google.com/calendar/u/0/r',
};
const message = { type: 'test-message' };

describe('sendCalendarTabMessage', () => {
  beforeEach(() => {
    extensionApi.sendMessage.mockReset();
    extensionApi.executeScript.mockReset();
    extensionApi.executeScript.mockResolvedValue([]);
  });

  it('uses the existing content script without injecting another copy', async () => {
    const response = { ok: true };
    extensionApi.sendMessage.mockResolvedValue(response);

    await expect(
      sendCalendarTabMessage(googleCalendarTab, message),
    ).resolves.toBe(response);
    expect(extensionApi.sendMessage).toHaveBeenCalledOnce();
    expect(extensionApi.executeScript).not.toHaveBeenCalled();
  });

  it('injects on a missing receiver and retries the message once', async () => {
    const response = { ok: true };
    extensionApi.sendMessage
      .mockRejectedValueOnce(
        new Error(
          'Could not establish connection. Receiving end does not exist.',
        ),
      )
      .mockResolvedValueOnce(response);

    await expect(
      sendCalendarTabMessage(googleCalendarTab, message),
    ).resolves.toBe(response);
    expect(extensionApi.executeScript).toHaveBeenCalledOnce();
    expect(extensionApi.executeScript).toHaveBeenCalledWith({
      target: { tabId: googleCalendarTab.id },
      files: ['content-scripts/google-calendar.js'],
    });
    expect(extensionApi.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('does not inject when the content script returns a DOM error', async () => {
    const response = {
      ok: false,
      error: 'Googleカレンダーの一覧を読み取れませんでした。',
    };
    extensionApi.sendMessage.mockResolvedValue(response);

    await expect(
      sendCalendarTabMessage(googleCalendarTab, message),
    ).resolves.toBe(response);
    expect(extensionApi.executeScript).not.toHaveBeenCalled();
  });

  it('does not inject for an unrelated messaging error', async () => {
    const error = new Error('The message port closed before a response was received.');
    extensionApi.sendMessage.mockRejectedValue(error);

    await expect(
      sendCalendarTabMessage(googleCalendarTab, message),
    ).rejects.toBe(error);
    expect(extensionApi.executeScript).not.toHaveBeenCalled();
  });

  it('does not inject outside Google Calendar', async () => {
    const error = new Error(
      'Could not establish connection. Receiving end does not exist.',
    );
    extensionApi.sendMessage.mockRejectedValue(error);

    await expect(
      sendCalendarTabMessage(
        { id: 42, url: 'https://example.com/' },
        message,
      ),
    ).rejects.toBe(error);
    expect(extensionApi.executeScript).not.toHaveBeenCalled();
  });

  it('does not retry more than once', async () => {
    const error = new Error(
      'Could not establish connection. Receiving end does not exist.',
    );
    extensionApi.sendMessage.mockRejectedValue(error);

    await expect(
      sendCalendarTabMessage(googleCalendarTab, message),
    ).rejects.toBe(error);
    expect(extensionApi.executeScript).toHaveBeenCalledOnce();
    expect(extensionApi.sendMessage).toHaveBeenCalledTimes(2);
  });
});
