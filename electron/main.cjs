const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const capturePreview = process.argv.includes('--capture-preview');
if (capturePreview && process.platform === 'linux') {
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

function createWindow() {
  const win = new BrowserWindow({
    width: capturePreview ? 1920 : 1600,
    height: capturePreview ? 1080 : 900,
    minWidth: capturePreview ? 800 : 1100,
    minHeight: capturePreview ? 600 : 700,
    backgroundColor: '#010105',
    autoHideMenuBar: true,
    frame: capturePreview,
    fullscreen: capturePreview ? false : true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });
  win.webContents.on('did-fail-load', (_event, code, desc) => {
    console.error(`did-fail-load ${code}: ${desc}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('render-process-gone', details);
  });

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  if (capturePreview) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const outDir = path.join(process.cwd(), 'preview');
          fs.mkdirSync(outDir, { recursive: true });
          const image = await win.webContents.capturePage();
          const out = path.join(outDir, 'V8_HEART_RUNTIME.png');
          fs.writeFileSync(out, image.toPNG());
          console.log(`PREVIEW_SAVED=${out}`);
          app.exit(0);
        } catch (err) {
          console.error(err);
          app.exit(1);
        }
      }, 15000);
    });
  } else {
    win.once('ready-to-show', () => win.show());
    globalShortcut.register('Escape', () => {
      if (win.isFullScreen()) win.setFullScreen(false);
      else win.close();
    });
    globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));
    globalShortcut.register('CommandOrControl+R', () => win.reload());
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
