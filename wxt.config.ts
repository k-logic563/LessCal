import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Calendar Presets',
    version: '0.1.2',
    description:
      'Googleカレンダーの表示メンバー構成をプリセットとして保存し、簡単に切り替えられる社内向けChrome拡張機能です。',
    action: {
      default_title: 'Calendar Presets',
    },
    permissions: ['storage'],
  },
  runner: {
    disabled: true,
  },
});
