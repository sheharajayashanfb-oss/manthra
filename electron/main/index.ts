import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { join } from 'path';
import { execSync } from 'child_process';
import { registerBridge } from '../../src/electron/bridge.js';

const isDev = process.env['NODE_ENV'] !== 'production';

// ── Fix PATH for packaged Mac/Linux app ────────────────────────────────────
// When Electron runs as a .app bundle it inherits a minimal PATH
// (/usr/bin:/bin) — not the user's full shell PATH. This breaks MCP servers
// that use npx/node/brew tools, and tool execution in general.
if (process.platform !== 'win32') {
  try {
    const userShell = process.env['SHELL'] || '/bin/zsh';
    const shellPath = execSync(`${userShell} -l -c 'echo $PATH'`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (shellPath) process.env['PATH'] = shellPath;
  } catch {
    // Fallback: prepend the most common tool locations
    const home = process.env['HOME'] ?? '';
    const extras = [
      `${home}/.nvm/current/bin`,
      `${home}/.nvm/versions/node/default/bin`,
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/local/sbin',
    ].join(':');
    process.env['PATH'] = `${extras}:${process.env['PATH'] ?? '/usr/bin:/bin'}`;
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0f0f0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on('ready-to-show', () => win.show());

  // Cmd+Option+I (Mac) / Ctrl+Shift+I (Win/Linux) opens DevTools in any build
  win.webContents.on('before-input-event', (_e, input) => {
    const mod = process.platform === 'darwin' ? input.meta && input.alt : input.control && input.shift;
    if (mod && input.key === 'i') win.webContents.toggleDevTools();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  registerBridge(win);

  // Directory picker
  ipcMain.handle('dir:pick', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Working Directory',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  // Set dark theme after app is ready
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { nativeTheme } = require('electron') as typeof import('electron');
    nativeTheme.themeSource = 'dark';
  } catch { /* ignore */ }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
