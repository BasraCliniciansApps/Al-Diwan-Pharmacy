const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('diwanDesktop', {
    isDesktop: true,
    writeBackup: (text) => ipcRenderer.invoke('diwan:writeBackup', text),
    backupInfo: () => ipcRenderer.invoke('diwan:backupInfo'),
    chooseBackupDir: () => ipcRenderer.invoke('diwan:chooseBackupDir'),
    openBackupDir: () => ipcRenderer.invoke('diwan:openBackupDir')
});
