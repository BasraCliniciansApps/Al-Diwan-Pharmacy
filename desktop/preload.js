const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('diwanDesktop', {
    isDesktop: true,
    writeBackup: (text) => ipcRenderer.invoke('diwan:writeBackup', text),
    backupInfo: () => ipcRenderer.invoke('diwan:backupInfo'),
    chooseBackupDir: () => ipcRenderer.invoke('diwan:chooseBackupDir'),
    openBackupDir: () => ipcRenderer.invoke('diwan:openBackupDir'),
    lan: {
        info: () => ipcRenderer.invoke('diwan:lan:info'),
        enable: (on) => ipcRenderer.invoke('diwan:lan:enable', !!on),
        newCode: () => ipcRenderer.invoke('diwan:lan:code'),
        pending: () => ipcRenderer.invoke('diwan:lan:pending'),
        mark: (ids, status) => ipcRenderer.invoke('diwan:lan:mark', ids, status),
        forget: (id) => ipcRenderer.invoke('diwan:lan:forget', id),
        onChange: (cb) => { ipcRenderer.on('diwan:lan:changed', () => { try { cb(); } catch (e) { /* تجاهل */ } }); }
    }
});
