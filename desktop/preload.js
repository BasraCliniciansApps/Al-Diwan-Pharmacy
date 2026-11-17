const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('diwanDesktop', {
    isDesktop: true,
    version: () => ipcRenderer.invoke('diwan:version'),
    writeBackup: (text) => ipcRenderer.invoke('diwan:writeBackup', text),
    backupInfo: () => ipcRenderer.invoke('diwan:backupInfo'),
    chooseBackupDir: () => ipcRenderer.invoke('diwan:chooseBackupDir'),
    openBackupDir: () => ipcRenderer.invoke('diwan:openBackupDir'),
    autostart: { get: () => ipcRenderer.invoke('diwan:autostart:get'), set: (on) => ipcRenderer.invoke('diwan:autostart:set', !!on) },
    lan: {
        digests: () => ipcRenderer.invoke('diwan:lan:digests'),
        info: () => ipcRenderer.invoke('diwan:lan:info'),
        enable: (on) => ipcRenderer.invoke('diwan:lan:enable', !!on),
        newCode: (role) => ipcRenderer.invoke('diwan:lan:code', role),
        pending: () => ipcRenderer.invoke('diwan:lan:pending'),
        mark: (ids, status) => ipcRenderer.invoke('diwan:lan:mark', ids, status),
        local: (list) => ipcRenderer.invoke('diwan:lan:local', list),
        need: (id, on) => ipcRenderer.invoke('diwan:lan:need', id, !!on),
        forget: (id) => ipcRenderer.invoke('diwan:lan:forget', id),
        onChange: (cb) => { ipcRenderer.on('diwan:lan:changed', () => { try { cb(); } catch (e) { /* تجاهل */ } }); }
    }
});
