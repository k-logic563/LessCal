<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import PresetListItem from './components/PresetListItem.vue';
import {
  createPreset,
  deletePreset,
  getPresets,
  PresetValidationError,
  renamePreset,
  updatePresetCalendarIds,
} from './services/presetService';
import {
  APPLY_CALENDAR_PRESET_MESSAGE,
  GET_CALENDARS_MESSAGE,
  type ApplyCalendarPresetResponse,
  type CalendarDomDiagnostics,
  type CalendarDomItem,
  type GetCalendarsResponse,
} from './shared/calendarMessaging';
import type { CalendarPreset } from './types/calendarPreset';
import {
  findMatchingPreset,
  getComparableCalendarIds,
} from './utils/presetMatcher';

const presets = ref<CalendarPreset[]>([]);
const calendars = ref<CalendarDomItem[]>([]);
const diagnostics = ref<CalendarDomDiagnostics | null>(null);
const isLoadingCalendars = ref(false);
const hasLoadedCalendars = ref(false);
const calendarError = ref<string | null>(null);
const presetListError = ref<string | null>(null);
const hasLoadedPresets = ref(false);
const applyingPresetId = ref<string | null>(null);
const applyFeedback = ref<string | null>(null);
const applyError = ref<string | null>(null);
const activeMenuPresetId = ref<string | null>(null);
const managingPresetId = ref<string | null>(null);
const managementMode = ref<'rename' | 'delete' | null>(null);
const managedPreset = ref<CalendarPreset | null>(null);
const renameName = ref('');
const managementError = ref<string | null>(null);
const managementFeedback = ref<string | null>(null);
const renameInput = ref<HTMLInputElement | null>(null);

const isSaveFormOpen = ref(false);
const isSaving = ref(false);
const presetName = ref('');
const saveError = ref<string | null>(null);
const saveSuccess = ref<string | null>(null);
const calendarSnapshot = ref<CalendarDomItem[]>([]);
const presetNameInput = ref<HTMLInputElement | null>(null);

const currentCalendarIdResult = computed(() =>
  hasLoadedCalendars.value ? getComparableCalendarIds(calendars.value) : null,
);
const selectedPresetId = computed(() => {
  if (!hasLoadedPresets.value) return null;

  const result = currentCalendarIdResult.value;
  if (!result?.ok) return null;

  return findMatchingPreset(presets.value, result.calendarIds)?.id ?? null;
});
const isCustomState = computed(
  () =>
    hasLoadedPresets.value &&
    currentCalendarIdResult.value?.ok === true &&
    selectedPresetId.value === null,
);

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
  hasLoadedCalendars.value = false;
  calendarError.value = null;

  try {
    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (activeTab.id === undefined) {
      throw new Error('Active tab is unavailable');
    }

    const response = (await browser.tabs.sendMessage(activeTab.id, {
      type: GET_CALENDARS_MESSAGE,
    })) as GetCalendarsResponse | undefined;

    if (!response) {
      throw new Error('Content Scriptから応答がありません。');
    }

    if (!response.ok) {
      throw new Error(response.error);
    }

    calendars.value = response.calendars;
    diagnostics.value = response.diagnostics;
    hasLoadedCalendars.value = true;
    return response.calendars;
  } catch {
    calendars.value = [];
    diagnostics.value = null;
    hasLoadedCalendars.value = false;
    calendarError.value =
      'Googleカレンダーを開き、ページを再読み込みしてから再取得してください。';
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
  managementFeedback.value = null;
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
  managementFeedback.value = null;
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
    managementFeedback.value = `「${targetPreset.name}」の名前を変更しました。`;
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
  managementFeedback.value = null;
  managementError.value = null;
  managingPresetId.value = preset.id;

  try {
    const currentCalendars = await loadCalendars();
    if (!currentCalendars || currentCalendars.length === 0) {
      throw new Error('Calendars are unavailable');
    }

    const calendarIdResult = getComparableCalendarIds(currentCalendars);
    if (!calendarIdResult.ok) {
      managementError.value = `${calendarIdResult.error} プリセットを更新できません。`;
      return;
    }

    const updatedPreset = await updatePresetCalendarIds(
      preset.id,
      calendarIdResult.calendarIds,
    );
    replacePresetInList(updatedPreset);
    managementFeedback.value = `「${preset.name}」を現在の表示で更新しました。`;
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
    closeManagementPanel();
    managementFeedback.value = `「${targetPreset.name}」を削除しました。`;
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
  applyFeedback.value = null;
  applyError.value = null;

  try {
    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (activeTab.id === undefined) {
      throw new Error('Active tab is unavailable');
    }

    const response = (await browser.tabs.sendMessage(activeTab.id, {
      type: APPLY_CALENDAR_PRESET_MESSAGE,
      calendarIds: preset.calendarIds,
    })) as ApplyCalendarPresetResponse | undefined;

    if (!response) {
      throw new Error('Content Scriptから応答がありません。');
    }

    if (!response.ok) {
      throw new Error(response.error);
    }

    const skippedMessage = response.missingCalendarIds.length
      ? ` ${response.missingCalendarIds.length}件は現在の一覧にないためスキップしました。`
      : '';
    applyFeedback.value = `「${preset.name}」を適用しました（${response.changedCalendarCount}件変更）。${skippedMessage}`;

    await loadCalendars();
  } catch {
    applyError.value =
      'プリセットを適用できませんでした。Googleカレンダーを再読み込みしてください。';
  } finally {
    applyingPresetId.value = null;
  }
}

async function openSaveForm(): Promise<void> {
  activeMenuPresetId.value = null;
  closeManagementPanel();
  saveError.value = null;
  saveSuccess.value = null;

  const currentCalendars = await loadCalendars();
  if (!currentCalendars) return;
  if (currentCalendars.length === 0) {
    calendarError.value =
      'カレンダーを取得できないため、プリセットを保存できません。';
    return;
  }

  calendarSnapshot.value = currentCalendars;
  presetName.value = '';
  isSaveFormOpen.value = true;
  await nextTick();
  presetNameInput.value?.focus();
}

function closeSaveForm(): void {
  isSaveFormOpen.value = false;
  presetName.value = '';
  saveError.value = null;
  calendarSnapshot.value = [];
}

async function saveCurrentPreset(): Promise<void> {
  const normalizedName = presetName.value.trim();
  saveError.value = null;
  saveSuccess.value = null;

  if (!normalizedName) {
    saveError.value = 'プリセット名を入力してください。';
    return;
  }

  if (presets.value.some((preset) => preset.name === normalizedName)) {
    saveError.value = '同じ名前のプリセットが存在します。';
    return;
  }

  const calendarIdResult = getComparableCalendarIds(calendarSnapshot.value);
  if (!calendarIdResult.ok) {
    saveError.value = `${calendarIdResult.error} プリセットを保存できません。`;
    return;
  }

  isSaving.value = true;

  try {
    const preset = await createPreset(
      normalizedName,
      calendarIdResult.calendarIds,
    );
    presets.value.push(preset);
    closeSaveForm();
    saveSuccess.value = `「${preset.name}」を保存しました。`;
  } catch (error) {
    saveError.value =
      error instanceof PresetValidationError
        ? error.message
        : 'プリセットを保存できませんでした。';
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  void Promise.all([loadPresets(), loadCalendars()]);
});
</script>

<template>
  <main
    class="popup"
    @click="activeMenuPresetId = null"
    @keydown.esc="activeMenuPresetId = null"
  >
    <h1 class="popup__title">表示プリセット</h1>

    <p v-if="isCustomState" class="current-state">
      現在：<strong>カスタム</strong>
    </p>

    <p v-if="presetListError" class="status status--error">
      {{ presetListError }}
    </p>
    <p v-else-if="presets.length === 0" class="preset-empty">
      保存済みのプリセットはありません。
    </p>
    <ul v-else class="preset-list" aria-label="プリセット一覧">
      <PresetListItem
        v-for="preset in presets"
        :key="preset.id"
        :preset-id="preset.id"
        :name="preset.name"
        :is-selected="selectedPresetId === preset.id"
        :disabled="applyingPresetId !== null || managingPresetId !== null || managementMode !== null"
        :menu-open="activeMenuPresetId === preset.id"
        @select="applyPreset(preset)"
        @toggle-menu="togglePresetMenu(preset.id)"
        @rename="openRenameForm(preset)"
        @update-from-current="updatePresetFromCurrent(preset)"
        @delete="openDeleteConfirmation(preset)"
      />
    </ul>
    <p v-if="applyFeedback" class="status status--success" role="status">
      {{ applyFeedback }}
    </p>
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
    <p v-if="managementFeedback" class="status status--success" role="status">
      {{ managementFeedback }}
    </p>
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
      <p v-if="saveSuccess" class="status status--success" role="status">
        {{ saveSuccess }}
      </p>
    </div>
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

.status--success {
  color: #188038;
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
