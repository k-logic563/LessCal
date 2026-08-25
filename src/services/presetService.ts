import { browser } from 'wxt/browser';
import type { CalendarPreset } from '../types/calendarPreset';

const STORAGE_KEY = 'calendarPresets';

export class PresetValidationError extends Error {}
export class PresetNotFoundError extends Error {}

function isCalendarPreset(value: unknown): value is CalendarPreset {
  if (typeof value !== 'object' || value === null) return false;

  const preset = value as Record<string, unknown>;
  return (
    typeof preset.id === 'string' &&
    typeof preset.name === 'string' &&
    Array.isArray(preset.calendarIds) &&
    preset.calendarIds.every((id) => typeof id === 'string') &&
    typeof preset.createdAt === 'number' &&
    typeof preset.updatedAt === 'number'
  );
}

export async function getPresets(): Promise<CalendarPreset[]> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const presets = stored[STORAGE_KEY];

  if (!Array.isArray(presets)) return [];
  return presets.filter(isCalendarPreset);
}

export async function createPreset(
  name: string,
  calendarIds: string[],
): Promise<CalendarPreset> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new PresetValidationError('プリセット名を入力してください。');
  }

  const presets = await getPresets();
  if (presets.some((preset) => preset.name === normalizedName)) {
    throw new PresetValidationError('同じ名前のプリセットが存在します。');
  }

  const now = Date.now();
  const preset: CalendarPreset = {
    id: crypto.randomUUID(),
    name: normalizedName,
    calendarIds: [...new Set(calendarIds)],
    createdAt: now,
    updatedAt: now,
  };

  await browser.storage.local.set({
    [STORAGE_KEY]: [...presets, preset],
  });

  return preset;
}

export async function renamePreset(
  presetId: string,
  name: string,
): Promise<CalendarPreset> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new PresetValidationError('プリセット名を入力してください。');
  }

  const presets = await getPresets();
  const presetIndex = presets.findIndex((preset) => preset.id === presetId);
  if (presetIndex === -1) {
    throw new PresetNotFoundError('プリセットが見つかりません。');
  }

  if (
    presets.some(
      (preset) =>
        preset.id !== presetId && preset.name === normalizedName,
    )
  ) {
    throw new PresetValidationError('同じ名前のプリセットが存在します。');
  }

  const renamedPreset: CalendarPreset = {
    ...presets[presetIndex],
    name: normalizedName,
    updatedAt: Date.now(),
  };
  presets[presetIndex] = renamedPreset;

  await browser.storage.local.set({ [STORAGE_KEY]: presets });
  return renamedPreset;
}

export async function updatePresetCalendarIds(
  presetId: string,
  calendarIds: string[],
): Promise<CalendarPreset> {
  const presets = await getPresets();
  const presetIndex = presets.findIndex((preset) => preset.id === presetId);
  if (presetIndex === -1) {
    throw new PresetNotFoundError('プリセットが見つかりません。');
  }

  const updatedPreset: CalendarPreset = {
    ...presets[presetIndex],
    calendarIds: [...new Set(calendarIds)],
    updatedAt: Date.now(),
  };
  presets[presetIndex] = updatedPreset;

  await browser.storage.local.set({ [STORAGE_KEY]: presets });
  return updatedPreset;
}

export async function deletePreset(presetId: string): Promise<void> {
  const presets = await getPresets();
  const remainingPresets = presets.filter((preset) => preset.id !== presetId);

  if (remainingPresets.length === presets.length) {
    throw new PresetNotFoundError('プリセットが見つかりません。');
  }

  await browser.storage.local.set({
    [STORAGE_KEY]: remainingPresets,
  });
}

export async function reorderPresets(orderedPresetIds: string[]): Promise<void> {
  const presets = await getPresets();
  const uniqueIds = new Set(orderedPresetIds);

  if (
    uniqueIds.size !== orderedPresetIds.length ||
    orderedPresetIds.length !== presets.length ||
    presets.some((preset) => !uniqueIds.has(preset.id))
  ) {
    throw new PresetValidationError('プリセットの並び順が不正です。');
  }

  const presetsById = new Map(presets.map((preset) => [preset.id, preset]));
  const reorderedPresets = orderedPresetIds.map(
    (presetId) => presetsById.get(presetId)!,
  );

  await browser.storage.local.set({
    [STORAGE_KEY]: reorderedPresets,
  });
}
