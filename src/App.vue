<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import PresetListItem from './components/PresetListItem.vue';
import {
  createPreset,
  deletePreset,
  getPresets,
  PresetValidationError,
  renamePreset,
  reorderPresets,
  updatePresetCalendarIds,
} from './services/presetService';
import {
  clearSelectedPresetId,
  getSelectedPresetId,
  observeSelectedPresetId,
  setSelectedPresetId,
} from './services/selectedPresetService';
import {
  APPLY_CALENDAR_PRESET_MESSAGE,
  GET_CALENDARS_MESSAGE,
  type ApplyCalendarPresetResponse,
  type CalendarDomItem,
  type GetCalendarsResponse,
} from './shared/calendarMessaging';
import { sendCalendarTabMessage } from './shared/calendarTabMessaging';
import type { CalendarPreset } from './types/calendarPreset';
import { isGoogleCalendarUrl } from './utils/googleCalendarUrl';
import { getComparableCalendarIds } from './utils/presetMatcher';

const hasCheckedActivePage = ref(false);
const isGoogleCalendarPage = ref(false);
const presets = ref<CalendarPreset[]>([]);
const isLoadingCalendars = ref(false);
const presetListError = ref<string | null>(null);
const hasLoadedPresets = ref(false);
const hasLoadedSelectedPreset = ref(false);
const selectedPresetId = ref<string | null>(null);
const applyingPresetId = ref<string | null>(null);
const applyError = ref<string | null>(null);
const activeMenuPresetId = ref<string | null>(null);
const managingPresetId = ref<string | null>(null);
const managementMode = ref<'rename' | 'delete' | null>(null);
const managedPreset = ref<CalendarPreset | null>(null);
const renameName = ref('');
const managementError = ref<string | null>(null);
const renameInput = ref<HTMLInputElement | null>(null);
const draggingPresetId = ref<string | null>(null);
const dragOverPresetId = ref<string | null>(null);
const dragOverPosition = ref<'before' | 'after' | null>(null);

const isSaveFormOpen = ref(false);
const isSaving = ref(false);
const presetName = ref('');
const saveError = ref<string | null>(null);
const calendarIdSnapshot = ref<string[] | null>(null);
const presetNameInput = ref<HTMLInputElement | null>(null);

const isCustomState = computed(
  () =>
    hasLoadedPresets.value &&
    hasLoadedSelectedPreset.value &&
    selectedPresetId.value === null,
);
let stopObservingSelectedPreset: (() => void) | null = null;

async function loadPresets(): Promise<void> {
  presetListError.value = null;
  hasLoadedPresets.value = false;

  try {
    presets.value = await getPresets();
    hasLoadedPresets.value = true;
  } catch {
    presetListError.value = '保存済みプリセットを読み込めませんでした。';
  }
}

async function loadCalendars(): Promise<CalendarDomItem[] | null> {
  isLoadingCalendars.value = true;

  try {
    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    const response = await sendCalendarTabMessage<GetCalendarsResponse>(
      activeTab,
      {
        type: GET_CALENDARS_MESSAGE,
        allowScroll: true,
      },
    );

    if (!response) {
      throw new Error('Content Scriptから応答がありません。');
    }

    if (!response.ok) {
      throw new Error(response.error);
    }

    return response.calendars;
  } catch {
    return null;
  } finally {
    isLoadingCalendars.value = false;
  }
}

function replacePresetInList(updatedPreset: CalendarPreset): void {
  presets.value = presets.value.map((preset) =>
    preset.id === updatedPreset.id ? updatedPreset : preset,
  );
}

function getKnownSelectedCalendarIds(): string[] | null {
  if (!selectedPresetId.value) return null;

  const selectedPreset = presets.value.find(
    (preset) => preset.id === selectedPresetId.value,
  );
  return selectedPreset ? [...selectedPreset.calendarIds] : null;
}

function togglePresetMenu(presetId: string): void {
  activeMenuPresetId.value =
    activeMenuPresetId.value === presetId ? null : presetId;
}

function closeManagementPanel(): void {
  managementMode.value = null;
  managedPreset.value = null;
  renameName.value = '';
  managementError.value = null;
}

async function openRenameForm(preset: CalendarPreset): Promise<void> {
  activeMenuPresetId.value = null;
  closeSaveForm();
  managementError.value = null;
  managedPreset.value = preset;
  renameName.value = preset.name;
  managementMode.value = 'rename';
  await nextTick();
  renameInput.value?.focus();
  renameInput.value?.select();
}

function openDeleteConfirmation(preset: CalendarPreset): void {
  activeMenuPresetId.value = null;
  closeSaveForm();
  managementError.value = null;
  managedPreset.value = preset;
  managementMode.value = 'delete';
}

async function submitRename(): Promise<void> {
  if (!managedPreset.value || managingPresetId.value) return;

  const targetPreset = managedPreset.value;
  const normalizedName = renameName.value.trim();
  managementError.value = null;

  if (!normalizedName) {
    managementError.value = 'プリセット名を入力してください。';
    return;
  }

  if (
    presets.value.some(
      (preset) =>
        preset.id !== targetPreset.id && preset.name === normalizedName,
    )
  ) {
    managementError.value = '同じ名前のプリセットが存在します。';
    return;
  }

  managingPresetId.value = targetPreset.id;

  try {
    const updatedPreset = await renamePreset(targetPreset.id, normalizedName);
    replacePresetInList(updatedPreset);
    closeManagementPanel();
  } catch (error) {
    managementError.value =
      error instanceof PresetValidationError
        ? error.message
        : 'プリセット名を変更できませんでした。';
  } finally {
    managingPresetId.value = null;
  }
}

async function updatePresetFromCurrent(preset: CalendarPreset): Promise<void> {
  if (managingPresetId.value) return;

  activeMenuPresetId.value = null;
  closeSaveForm();
  closeManagementPanel();
  managementError.value = null;
  managingPresetId.value = preset.id;

  try {
    const knownCalendarIds = getKnownSelectedCalendarIds();
    let safeCalendarIds = knownCalendarIds;
    let unavailableExistingCalendarIds: string[] = [];

    if (!safeCalendarIds) {
      const currentCalendars = await loadCalendars();
      if (!currentCalendars || currentCalendars.length === 0) {
        throw new Error('Calendars are unavailable');
      }

      const calendarIdResult = getComparableCalendarIds(currentCalendars);
      if (!calendarIdResult.ok) {
        managementError.value = `${calendarIdResult.error} プリセットを更新できません。`;
        return;
      }

      const availableCalendarIds = new Set(
        currentCalendars.flatMap((calendar) =>
          calendar.identifier ? [calendar.identifier.value] : [],
        ),
      );
      unavailableExistingCalendarIds = preset.calendarIds.filter(
        (calendarId) => !availableCalendarIds.has(calendarId),
      );
      safeCalendarIds = [
        ...new Set([
          ...calendarIdResult.calendarIds,
          ...unavailableExistingCalendarIds,
        ]),
      ];
    }

    const updatedPreset = await updatePresetCalendarIds(
      preset.id,
      safeCalendarIds,
    );
    replacePresetInList(updatedPreset);
    await setSelectedPresetId(updatedPreset.id);
    selectedPresetId.value = updatedPreset.id;
    if (unavailableExistingCalendarIds.length > 0) {
      managementError.value =
        `一覧で確認できない${unavailableExistingCalendarIds.length}件は、` +
        '既存の設定を保持しました。';
    }
  } catch {
    managementError.value =
      '現在の表示で更新できませんでした。Googleカレンダーを再読み込みしてください。';
  } finally {
    managingPresetId.value = null;
  }
}

async function confirmDelete(): Promise<void> {
  if (!managedPreset.value || managingPresetId.value) return;

  const targetPreset = managedPreset.value;
  managementError.value = null;
  managingPresetId.value = targetPreset.id;

  try {
    await deletePreset(targetPreset.id);
    presets.value = presets.value.filter(
      (preset) => preset.id !== targetPreset.id,
    );
    if (selectedPresetId.value === targetPreset.id) {
      await clearSelectedPresetId();
      selectedPresetId.value = null;
    }
    closeManagementPanel();
  } catch {
    managementError.value = 'プリセットを削除できませんでした。';
  } finally {
    managingPresetId.value = null;
  }
}

async function applyPreset(preset: CalendarPreset): Promise<void> {
  if (applyingPresetId.value) return;

  applyingPresetId.value = preset.id;
  activeMenuPresetId.value = null;
  applyError.value = null;

  try {
    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    const response = await sendCalendarTabMessage<ApplyCalendarPresetResponse>(
      activeTab,
      {
        type: APPLY_CALENDAR_PRESET_MESSAGE,
        presetId: preset.id,
        calendarIds: preset.calendarIds,
      },
    );

    if (!response) {
      throw new Error('Content Scriptから応答がありません。');
    }

    if (!response.ok) {
      throw new Error(response.error);
    }

    if (response.missingCalendarIds.length > 0) {
      selectedPresetId.value = null;
      applyError.value =
        `${response.missingCalendarIds.length}件は現在の一覧にないため、` +
        'プリセットを完全に適用できませんでした。';
    } else {
      selectedPresetId.value = preset.id;
    }
  } catch {
    applyError.value =
      'プリセットを適用できませんでした。Googleカレンダーを再読み込みしてください。';
  } finally {
    applyingPresetId.value = null;
  }
}

function startPresetDrag(presetId: string, event: DragEvent): void {
  if (applyingPresetId.value || managingPresetId.value || managementMode.value) {
    event.preventDefault();
    return;
  }

  activeMenuPresetId.value = null;
  draggingPresetId.value = presetId;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', presetId);
    const presetRow = (event.currentTarget as HTMLElement | null)?.closest(
      '.preset',
    );
    if (presetRow instanceof HTMLElement) {
      event.dataTransfer.setDragImage(presetRow, 16, presetRow.offsetHeight / 2);
    }
  }
}

function allowPresetDrop(targetPresetId: string, event: DragEvent): void {
  if (!draggingPresetId.value) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

  const sourceIndex = presets.value.findIndex(
    (preset) => preset.id === draggingPresetId.value,
  );
  const targetIndex = presets.value.findIndex(
    (preset) => preset.id === targetPresetId,
  );
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    dragOverPresetId.value = null;
    dragOverPosition.value = null;
    return;
  }

  dragOverPresetId.value = targetPresetId;
  dragOverPosition.value = sourceIndex < targetIndex ? 'after' : 'before';
}

function leavePresetDrop(targetPresetId: string, event: DragEvent): void {
  const nextTarget = event.relatedTarget;
  if (
    nextTarget instanceof Node &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.contains(nextTarget)
  ) {
    return;
  }
  if (dragOverPresetId.value === targetPresetId) {
    dragOverPresetId.value = null;
    dragOverPosition.value = null;
  }
}

function finishPresetDrag(): void {
  draggingPresetId.value = null;
  dragOverPresetId.value = null;
  dragOverPosition.value = null;
}

async function dropPreset(targetPresetId: string, event: DragEvent): Promise<void> {
  event.preventDefault();
  const sourcePresetId = draggingPresetId.value;
  finishPresetDrag();
  if (!sourcePresetId || sourcePresetId === targetPresetId) return;

  const sourceIndex = presets.value.findIndex(
    (preset) => preset.id === sourcePresetId,
  );
  const targetIndex = presets.value.findIndex(
    (preset) => preset.id === targetPresetId,
  );
  if (sourceIndex === -1 || targetIndex === -1) return;

  const previousPresets = [...presets.value];
  const reordered = [...presets.value];
  const [movedPreset] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, movedPreset);
  presets.value = reordered;
  presetListError.value = null;

  try {
    await reorderPresets(reordered.map((preset) => preset.id));
  } catch {
    presets.value = previousPresets;
    presetListError.value = 'プリセットの並び順を保存できませんでした。';
  }
}

async function openSaveForm(): Promise<void> {
  activeMenuPresetId.value = null;
  closeManagementPanel();
  saveError.value = null;

  const knownCalendarIds = getKnownSelectedCalendarIds();
  if (knownCalendarIds) {
    calendarIdSnapshot.value = knownCalendarIds;
  } else {
    const currentCalendars = await loadCalendars();
    if (!currentCalendars) return;
    if (currentCalendars.length === 0) {
      saveError.value = 'カレンダーを取得できないため、保存できません。';
      return;
    }

    const calendarIdResult = getComparableCalendarIds(currentCalendars);
    if (!calendarIdResult.ok) {
      saveError.value = `${calendarIdResult.error} プリセットを保存できません。`;
      return;
    }
    calendarIdSnapshot.value = calendarIdResult.calendarIds;
  }

  presetName.value = '';
  isSaveFormOpen.value = true;
  await nextTick();
  presetNameInput.value?.focus();
}

function closeSaveForm(): void {
  isSaveFormOpen.value = false;
  presetName.value = '';
  saveError.value = null;
  calendarIdSnapshot.value = null;
}

async function saveCurrentPreset(): Promise<void> {
  const normalizedName = presetName.value.trim();
  saveError.value = null;

  if (!normalizedName) {
    saveError.value = 'プリセット名を入力してください。';
    return;
  }

  if (presets.value.some((preset) => preset.name === normalizedName)) {
    saveError.value = '同じ名前のプリセットが存在します。';
    return;
  }

  if (!calendarIdSnapshot.value) {
    saveError.value = '現在のカレンダー構成を取得できません。';
    return;
  }

  isSaving.value = true;

  try {
    const preset = await createPreset(
      normalizedName,
      calendarIdSnapshot.value,
    );
    presets.value.push(preset);
    await setSelectedPresetId(preset.id);
    selectedPresetId.value = preset.id;
    closeSaveForm();
  } catch (error) {
    saveError.value =
      error instanceof PresetValidationError
        ? error.message
        : 'プリセットを保存できませんでした。';
  } finally {
    isSaving.value = false;
  }
}

onMounted(async () => {
  try {
    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    isGoogleCalendarPage.value = isGoogleCalendarUrl(activeTab?.url);
  } finally {
    hasCheckedActivePage.value = true;
  }

  if (!isGoogleCalendarPage.value) return;

  stopObservingSelectedPreset = observeSelectedPresetId((presetId) => {
    selectedPresetId.value = presetId;
    hasLoadedSelectedPreset.value = true;
  });

  const [, storedSelectedPresetId] = await Promise.all([
    loadPresets(),
    getSelectedPresetId(),
  ]);
  selectedPresetId.value = storedSelectedPresetId;

  if (
    selectedPresetId.value !== null &&
    !presets.value.some((preset) => preset.id === selectedPresetId.value)
  ) {
    await clearSelectedPresetId();
    selectedPresetId.value = null;
  }

  hasLoadedSelectedPreset.value = true;
});

onUnmounted(() => {
  stopObservingSelectedPreset?.();
});
</script>

<template>
  <main
    class="popup"
    @click="activeMenuPresetId = null"
    @keydown.esc="activeMenuPresetId = null"
  >
    <p v-if="!hasCheckedActivePage" class="page-status" aria-live="polite">
      確認中…
    </p>

    <section v-else-if="!isGoogleCalendarPage" class="unavailable-page">
      <h1>Googleカレンダーでのみ利用できます</h1>
      <p>Googleカレンダーを開いてからLessCalをご利用ください。</p>
    </section>

    <template v-else>
      <h1 class="popup__title">LessCal</h1>

    <p v-if="isCustomState" class="current-state">
      現在：<strong>カスタム</strong>
    </p>

    <p v-if="presetListError" class="status status--error">
      {{ presetListError }}
    </p>
    <p v-else-if="presets.length === 0" class="preset-empty">
      保存済みのプリセットはありません。
    </p>
    <TransitionGroup
      v-else
      name="preset-list"
      tag="ul"
      class="preset-list"
      aria-label="プリセット一覧"
    >
      <PresetListItem
        v-for="preset in presets"
        :key="preset.id"
        :preset-id="preset.id"
        :name="preset.name"
        :is-selected="selectedPresetId === preset.id"
        :disabled="applyingPresetId !== null || managingPresetId !== null || managementMode !== null"
        :menu-open="activeMenuPresetId === preset.id"
        :is-dragging="draggingPresetId === preset.id"
        :drop-position="
          dragOverPresetId === preset.id ? dragOverPosition : null
        "
        @select="applyPreset(preset)"
        @toggle-menu="togglePresetMenu(preset.id)"
        @rename="openRenameForm(preset)"
        @update-from-current="updatePresetFromCurrent(preset)"
        @delete="openDeleteConfirmation(preset)"
        @drag-start="startPresetDrag(preset.id, $event)"
        @drag-over="allowPresetDrop(preset.id, $event)"
        @drag-leave="leavePresetDrop(preset.id, $event)"
        @drop="dropPreset(preset.id, $event)"
        @drag-end="finishPresetDrag"
      />
    </TransitionGroup>
    <p v-if="applyError" class="status status--error" role="alert">
      {{ applyError }}
    </p>

    <section
      v-if="managementMode && managedPreset"
      class="management-panel"
      aria-label="プリセット管理"
    >
      <form v-if="managementMode === 'rename'" @submit.prevent="submitRename">
        <label for="rename-preset">プリセット名</label>
        <input
          id="rename-preset"
          ref="renameInput"
          v-model="renameName"
          type="text"
          autocomplete="off"
          :disabled="managingPresetId !== null"
        />
        <div class="save-form__actions">
          <button
            class="secondary-button"
            type="button"
            :disabled="managingPresetId !== null"
            @click="closeManagementPanel"
          >
            キャンセル
          </button>
          <button
            class="primary-button"
            type="submit"
            :disabled="managingPresetId !== null"
          >
            {{ managingPresetId ? '変更中…' : '変更' }}
          </button>
        </div>
      </form>

      <div v-else class="delete-confirmation">
        <p>「{{ managedPreset.name }}」を削除しますか？</p>
        <div class="save-form__actions">
          <button
            class="secondary-button"
            type="button"
            :disabled="managingPresetId !== null"
            @click="closeManagementPanel"
          >
            キャンセル
          </button>
          <button
            class="danger-button"
            type="button"
            :disabled="managingPresetId !== null"
            @click="confirmDelete"
          >
            {{ managingPresetId ? '削除中…' : '削除' }}
          </button>
        </div>
      </div>
    </section>
    <p v-if="managementError" class="status status--error" role="alert">
      {{ managementError }}
    </p>

    <div class="popup__footer">
      <form v-if="isSaveFormOpen" class="save-form" @submit.prevent="saveCurrentPreset">
        <label for="preset-name">プリセット名</label>
        <input
          id="preset-name"
          ref="presetNameInput"
          v-model="presetName"
          type="text"
          autocomplete="off"
          :disabled="isSaving"
        />
        <p v-if="saveError" class="status status--error" role="alert">
          {{ saveError }}
        </p>
        <div class="save-form__actions">
          <button
            class="secondary-button"
            type="button"
            :disabled="isSaving"
            @click="closeSaveForm"
          >
            キャンセル
          </button>
          <button class="primary-button" type="submit" :disabled="isSaving">
            {{ isSaving ? '保存中…' : '保存' }}
          </button>
        </div>
      </form>
      <button
        v-else
        class="save-button"
        type="button"
        :disabled="isLoadingCalendars"
        @click="openSaveForm"
      >
        <span aria-hidden="true">＋</span>
        現在の表示を保存
      </button>
    </div>
    </template>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  background: #ffffff;
}

:global(button),
:global(input) {
  font: inherit;
}

.popup {
  width: 320px;
  padding: 18px 16px 14px;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", sans-serif;
  color: #202124;
  background: #ffffff;
}

.popup__title {
  margin: 0 0 14px;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.4;
}

.page-status,
.unavailable-page {
  margin: 0;
  color: #5f6368;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
}

.unavailable-page {
  padding: 22px 8px;
}

.unavailable-page h1 {
  margin: 0 0 7px;
  color: #3c4043;
  font-size: 15px;
  font-weight: 600;
}

.unavailable-page p {
  margin: 0;
}

.current-state {
  margin: -4px 0 10px;
  color: #5f6368;
  font-size: 12px;
}

.current-state strong {
  color: #3c4043;
  font-weight: 600;
}

.preset-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.preset-list-move {
  transition: transform 180ms cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-reduced-motion: reduce) {
  .preset-list-move {
    transition-duration: 1ms;
  }
}

.preset-empty {
  margin: 0;
  padding: 10px;
  color: #5f6368;
  font-size: 12px;
  text-align: center;
}

.management-panel {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #dadce0;
  border-radius: 7px;
  background: #f8f9fa;
}

.management-panel form {
  display: grid;
  gap: 8px;
}

.management-panel label {
  font-size: 12px;
  font-weight: 600;
}

.management-panel input {
  width: 100%;
  padding: 8px 9px;
  border: 1px solid #bdc1c6;
  border-radius: 5px;
  color: #202124;
  background: #ffffff;
  font-size: 13px;
  outline: none;
}

.management-panel input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 1px #1a73e8;
}

.delete-confirmation {
  display: grid;
  gap: 10px;
}

.delete-confirmation p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.calendar-check {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #e3e6ea;
}

.calendar-check__header,
.calendar-result__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.calendar-check h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.reload-button {
  padding: 3px 6px;
  border: 0;
  border-radius: 4px;
  color: #1967d2;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
}

.reload-button:hover,
.reload-button:focus-visible {
  background: #f1f6fd;
  outline: none;
}

.reload-button:disabled {
  color: #9aa0a6;
  cursor: default;
}

.calendar-check__status,
.status {
  margin: 10px 0 2px;
  color: #5f6368;
  font-size: 12px;
  line-height: 1.5;
}

.calendar-check__status--error,
.status--error {
  color: #b3261e;
}

.calendar-results {
  display: grid;
  gap: 9px;
  max-height: 168px;
  margin: 10px 0 0;
  padding: 0 4px 0 0;
  overflow-y: auto;
  list-style: none;
}

.calendar-result__summary {
  font-size: 12px;
}

.calendar-result__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-result__self {
  margin-left: 4px;
  padding: 1px 4px;
  border-radius: 3px;
  color: #174ea6;
  background: #e8f0fe;
  font-size: 10px;
}

.calendar-result__state {
  flex: 0 0 auto;
  color: #80868b;
  font-size: 11px;
  font-weight: 600;
}

.calendar-result__state--on {
  color: #188038;
}

.calendar-result__id {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: #80868b;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-check__diagnostics {
  margin: 8px 0 0;
  color: #80868b;
  font-size: 10px;
}

.popup__footer {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #e3e6ea;
}

.save-button {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 6px;
  color: #1967d2;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.save-button:hover,
.save-button:focus-visible {
  background: #f1f6fd;
  outline: none;
}

.save-button:disabled {
  color: #9aa0a6;
  cursor: default;
}

.save-form {
  display: grid;
  gap: 8px;
}

.save-form label {
  font-size: 12px;
  font-weight: 600;
}

.save-form input {
  width: 100%;
  padding: 8px 9px;
  border: 1px solid #bdc1c6;
  border-radius: 5px;
  color: #202124;
  font-size: 13px;
  outline: none;
}

.save-form input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 1px #1a73e8;
}

.save-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.primary-button,
.secondary-button,
.danger-button {
  padding: 7px 12px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.primary-button {
  border: 1px solid #1a73e8;
  color: #ffffff;
  background: #1a73e8;
}

.secondary-button {
  border: 1px solid #dadce0;
  color: #3c4043;
  background: #ffffff;
}

.danger-button {
  border: 1px solid #b3261e;
  color: #ffffff;
  background: #b3261e;
}

.primary-button:disabled,
.secondary-button:disabled,
.danger-button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
