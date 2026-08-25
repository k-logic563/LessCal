<script setup lang="ts">
defineProps<{
  presetId: string;
  name: string;
  isSelected: boolean;
  disabled?: boolean;
  menuOpen: boolean;
  isDragging?: boolean;
  dropPosition?: 'before' | 'after' | null;
}>();

const emit = defineEmits<{
  select: [];
  toggleMenu: [];
  rename: [];
  updateFromCurrent: [];
  delete: [];
  dragStart: [event: DragEvent];
  dragOver: [event: DragEvent];
  dragLeave: [event: DragEvent];
  drop: [event: DragEvent];
  dragEnd: [];
}>();
</script>

<template>
  <li
    class="preset"
    :class="{
      'preset--selected': isSelected,
      'preset--dragging': isDragging,
      'preset--drop-before': dropPosition === 'before',
      'preset--drop-after': dropPosition === 'after',
    }"
    @dragover="emit('dragOver', $event)"
    @dragleave="emit('dragLeave', $event)"
    @drop="emit('drop', $event)"
  >
    <button
      class="preset__drag-handle"
      type="button"
      draggable="true"
      :aria-label="`${name}を並び替え`"
      :disabled="disabled"
      @click.stop
      @dragstart.stop="emit('dragStart', $event)"
      @dragend.stop="emit('dragEnd')"
    >
      <span aria-hidden="true">⋮⋮</span>
    </button>

    <button
      class="preset__name"
      type="button"
      :aria-pressed="isSelected"
      :disabled="disabled"
      @click="emit('select')"
    >
      <span
        class="preset__indicator"
        :class="{ 'preset__indicator--visible': isSelected }"
        aria-hidden="true"
      >●</span>
      <span>{{ name }}</span>
    </button>

    <button
      class="preset__menu"
      type="button"
      :aria-label="`${name}のメニュー`"
      :aria-expanded="menuOpen"
      :aria-controls="`preset-menu-${presetId}`"
      :disabled="disabled"
      @click.stop="emit('toggleMenu')"
    >
      ⋯
    </button>

    <div
      v-if="menuOpen"
      :id="`preset-menu-${presetId}`"
      class="preset__actions"
      role="menu"
      @click.stop
    >
      <button type="button" role="menuitem" @click="emit('rename')">
        名前を変更
      </button>
      <button type="button" role="menuitem" @click="emit('updateFromCurrent')">
        現在の表示で更新
      </button>
      <button
        class="preset__delete-action"
        type="button"
        role="menuitem"
        @click="emit('delete')"
      >
        削除
      </button>
    </div>
  </li>
</template>

<style scoped>
.preset {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 42px;
  border-radius: 7px;
  transition:
    transform 180ms cubic-bezier(0.2, 0, 0, 1),
    box-shadow 180ms ease,
    opacity 180ms ease,
    background-color 180ms ease;
}

.preset--selected {
  background: #eef3fc;
}

.preset--dragging {
  z-index: 2;
  background: #ffffff;
  box-shadow: 0 6px 16px rgb(60 64 67 / 18%);
  opacity: 0.78;
  transform: scale(1.018);
}

.preset--drop-before {
  transform: translateY(4px);
}

.preset--drop-after {
  transform: translateY(-4px);
}

.preset--drop-before::before,
.preset--drop-after::after {
  position: absolute;
  right: 8px;
  left: 8px;
  height: 2px;
  border-radius: 999px;
  background: #a8c7fa;
  content: "";
}

.preset--drop-before::before {
  top: -3px;
}

.preset--drop-after::after {
  bottom: -3px;
}

.preset__drag-handle {
  display: grid;
  place-items: center;
  align-self: stretch;
  width: 26px;
  padding: 0;
  border: 0;
  color: #9aa0a6;
  background: transparent;
  font-size: 12px;
  letter-spacing: -3px;
  cursor: grab;
}

.preset__drag-handle:active {
  cursor: grabbing;
}

.preset--dragging .preset__drag-handle {
  cursor: grabbing;
}

.preset__drag-handle:disabled {
  cursor: default;
}

.preset__name {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 9px;
  min-width: 0;
  align-self: stretch;
  padding: 8px 6px 8px 10px;
  border: 0;
  color: #3c4043;
  background: transparent;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.preset--selected .preset__name {
  color: #174ea6;
  font-weight: 600;
}

.preset__name:disabled {
  color: #9aa0a6;
  cursor: wait;
}

.preset__menu:disabled {
  color: #9aa0a6;
  cursor: wait;
}

.preset__indicator {
  flex: 0 0 8px;
  color: transparent;
  font-size: 8px;
}

.preset__indicator--visible {
  color: #1a73e8;
}

.preset__menu {
  display: grid;
  place-items: center;
  width: 38px;
  height: 34px;
  margin-right: 4px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #5f6368;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.preset__name:focus-visible,
.preset__drag-handle:focus-visible,
.preset__menu:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: -2px;
}

.preset__actions {
  position: absolute;
  z-index: 10;
  top: 38px;
  right: 4px;
  display: grid;
  width: 156px;
  padding: 5px;
  border: 1px solid #dadce0;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: 0 4px 12px rgb(60 64 67 / 20%);
}

.preset__actions button {
  padding: 8px 9px;
  border: 0;
  border-radius: 4px;
  color: #3c4043;
  background: transparent;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.preset__actions button:hover,
.preset__actions button:focus-visible {
  background: #f1f3f4;
  outline: none;
}

.preset__actions .preset__delete-action {
  color: #b3261e;
}

.preset:not(.preset--selected):hover,
.preset__menu:hover {
  background: #f5f6f7;
}

@media (prefers-reduced-motion: reduce) {
  .preset {
    transition-duration: 1ms;
  }
}
</style>
