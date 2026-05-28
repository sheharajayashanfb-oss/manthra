import type { Configuration } from 'electron-builder';

export default {
  appId: 'au.manthra.desktop',
  productName: 'Manthra',
  copyright: 'Copyright © 2025 Informatics International',
  directories: {
    buildResources: 'resources',
    output: 'releases/desktop',
  },
  files: ['out/**'],
  mac: {
    category: 'public.app-category.developer-tools',
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  linux: {
    target: [{ target: 'AppImage', arch: ['x64'] }],
    category: 'Development',
  },
} satisfies Configuration;
