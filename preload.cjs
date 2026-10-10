const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pikaDesktop', {
  credentialStatus: () => ipcRenderer.invoke('credentials:status'),
  saveCredentials: input => ipcRenderer.invoke('credentials:save',input),
  clearCredentials: () => ipcRenderer.invoke('credentials:clear'),
  onSync: callback => { ipcRenderer.on('sync:update', (_event, data) => callback(data)); },
  loadMeetings: () => ipcRenderer.invoke('meetings:load'),
  saveMeetings: items => ipcRenderer.invoke('meetings:save', items),
  openLink: url => ipcRenderer.invoke('link:open', url),
  notify: (title, body) => ipcRenderer.invoke('notify', {title, body}),
  onReminder: callback => { ipcRenderer.on('reminder', (_event, m) => callback(m)); }
});
