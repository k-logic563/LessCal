import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: storage,
    },
  },
}));

import { PresetValidationError, reorderPresets } from './presetService';

const presets = [
  {
    id: 'preset-1',
    name: 'プリセット1',
    calendarIds: ['calendar-1'],
    createdAt: 1,
    updatedAt: 2,
  },
  {
    id: 'preset-2',
    name: 'プリセット2',
    calendarIds: ['calendar-2'],
    createdAt: 3,
    updatedAt: 4,
  },
];

describe('reorderPresets', () => {
  beforeEach(() => {
    storage.get.mockReset();
    storage.set.mockReset();
    storage.get.mockResolvedValue({ calendarPresets: presets });
    storage.set.mockResolvedValue(undefined);
  });

  it('stores the existing preset objects in the requested array order', async () => {
    await reorderPresets(['preset-2', 'preset-1']);

    expect(storage.set).toHaveBeenCalledWith({
      calendarPresets: [presets[1], presets[0]],
    });
  });

  it.each([
    { orderedIds: ['preset-1'] },
    { orderedIds: ['preset-1', 'preset-1'] },
    { orderedIds: ['preset-1', 'unknown'] },
  ])('rejects an incompatible preset order: $orderedIds', async ({ orderedIds }) => {
    await expect(reorderPresets(orderedIds)).rejects.toBeInstanceOf(
      PresetValidationError,
    );
    expect(storage.set).not.toHaveBeenCalled();
  });
});
