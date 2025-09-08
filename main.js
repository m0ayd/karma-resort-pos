const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

log.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs/main.log');
log.transports.file.level = 'info';
autoUpdater.logger = log;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'icons/icon-192x192.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.maximize();
  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('check-for-update', () => {
  autoUpdater.checkForUpdates();
});

ipcMain.on('start-update', () => {
  autoUpdater.quitAndInstall();
});

autoUpdater.on('checking-for-update', () => {
  mainWindow.webContents.send('update-status', { status: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('update-status', { status: 'available', info });
});

autoUpdater.on('update-not-available', (info) => {
  mainWindow.webContents.send('update-status', { status: 'not-available', info });
});

autoUpdater.on('error', (err) => {
  mainWindow.webContents.send('update-status', { status: 'error', error: err.message });
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('update-status', { status: 'downloading', progress: progressObj });
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow.webContents.send('update-status', { status: 'downloaded', info });
});