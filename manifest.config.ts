import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'Trace',
  description: 'Your personal knowledge graph powered by Chrome built-in AI. Automatically capture, summarize, and query your browsing history.',
  version: pkg.version,
  icons: {
    16: 'public/icons/trace16.png',
    48: 'public/icons/trace48.png',
    128: 'public/icons/trace128.png',
  },
  action: {
    default_icon: {
      16: 'public/icons/trace16.png',
      48: 'public/icons/trace48.png',
      128: 'public/icons/trace128.png',
    },
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background/background.ts',
    type: 'module',
  },
  permissions: [
    'sidePanel',
    'storage',
    'tabs',
    'activeTab',
    'scripting',
    'downloads',
  ],
  optional_permissions: [
    'history',
    'tabCapture',
  ],
  host_permissions: [
    'https://*/*',
    'http://*/*',
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
})
