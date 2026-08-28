import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'LessCal',
    version: '0.2.3',
    description:
      'Googleカレンダーの表示メンバー構成をプリセットとして保存し、簡単に切り替えられるChrome拡張機能です。',
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: 'LessCal',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
      },
    },
    permissions: ['storage', 'activeTab', 'scripting'],
  },
  runner: {
    disabled: true,
  },
});
