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
    artifactName: 'Manthra-mac-${arch}.dmg',
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
  },
  win: {
    artifactName: 'Manthra-win-x64.exe',
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  linux: {
    artifactName: 'Manthra-linux-${arch}.AppImage',
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'AppImage', arch: ['arm64'] },
    ],
    category: 'Development',
  },
} satisfies Configuration;
