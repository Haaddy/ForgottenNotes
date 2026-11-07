import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Video Later',
    description:
      'Личная библиотека полезных ссылок и видео: теги, заметки, поиск. Всё хранится локально.',
    version: '0.1.0',
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
    permissions: [
      'storage',
      'unlimitedStorage',
      'activeTab',
      'scripting',
      'contextMenus',
      'commands',
    ],
    commands: {
      'save-current-tab': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Сохранить текущую вкладку',
      },
    },
    action: {
      default_title: 'Сохранить в Video Later',
    },
  },
});
