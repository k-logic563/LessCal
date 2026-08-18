import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Calendar Presets',
    version: '0.1.0',
    description: 'Google Calendar preset extension',
    action: {
      default_title: 'Calendar Presets',
    },
    permissions: ['storage'],
  },
  runner: {
    disabled: true,
  },
});
