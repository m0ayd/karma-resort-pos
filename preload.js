const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, ...args) => callback(...args)),
  checkForUpdate: () => ipcRenderer.send('check-for-update'),
  startUpdate: () => ipcRenderer.send('start-update')
});