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
  // Generic update server — generates latest-mac.yml / latest-linux.yml / latest.yml
  // which electron-updater reads to check for and download updates.
  publish: [{
    provider: 'generic',
    url: 'https://manthra.informaticsint.au/releases/desktop',
  }],
  mac: {
    category: 'public.app-category.developer-tools',
    artifactName: 'Manthra-mac-${arch}.${ext}',
    identity: null, // ad-hoc signing — no Developer ID required; open via right-click → Open
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] }, // required for electron-updater on macOS
    ],
  },
  win: {
    artifactName: 'Manthra-win-x64.${ext}',
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  linux: {
    artifactName: 'Manthra-linux-${arch}.${ext}',
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'AppImage', arch: ['arm64'] },
    ],
    category: 'Development',
  },
} satisfies Configuration;
