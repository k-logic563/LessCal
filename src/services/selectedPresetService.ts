import { browser } from 'wxt/browser';

const STORAGE_KEY = 'selectedCalendarPresetId';

export async function getSelectedPresetId(): Promise<string | null> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const presetId = stored[STORAGE_KEY];
  return typeof presetId === 'string' ? presetId : null;
}

export async function setSelectedPresetId(presetId: string): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: presetId });
}

export async function clearSelectedPresetId(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}

export function observeSelectedPresetId(
  callback: (presetId: string | null) => void,
): () => void {
  const listener: Parameters<
    typeof browser.storage.onChanged.addListener
  >[0] = (changes, areaName) => {
    if (areaName !== 'local' || !(STORAGE_KEY in changes)) return;

    const presetId = changes[STORAGE_KEY].newValue;
    callback(typeof presetId === 'string' ? presetId : null);
  };

  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
