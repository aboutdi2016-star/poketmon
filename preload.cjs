const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pikaDesktop', {
  productivityStatus: () => ipcRenderer.invoke('productivity:status'),
  saveProductivitySettings: input => ipcRenderer.invoke('productivity:settings',input),
  setFocus: start => ipcRenderer.invoke('focus:set',start),
  saveSummary: () => ipcRenderer.invoke('summary:save'),
  onFocus: callback => ipcRenderer.on('focus:update',(_event,data)=>callback(data)),
  credentialStatus: () => ipcRenderer.invoke('credentials:status'),
  saveCredentials: input => ipcRenderer.invoke('credentials:save',input),
  clearCredentials: () => ipcRenderer.invoke('credentials:clear'),
  obsidianStatus: () => ipcRenderer.invoke('obsidian:status'),
  chooseObsidian: () => ipcRenderer.invoke('obsidian:choose'),
  clearObsidian: () => ipcRenderer.invoke('obsidian:clear'),
  openObsidian: id => ipcRenderer.invoke('obsidian:open',id),
  onSync: callback => { ipcRenderer.on('sync:update', (_event, data) => callback(data)); },
  publishCompanion: snapshot => ipcRenderer.send('companion:publish', snapshot),
  onCompanionCommand: callback => { ipcRenderer.on('companion:command', (_event, data) => callback(data)); },
  loadMeetings: () => ipcRenderer.invoke('meetings:load'),
  saveMeetings: items => ipcRenderer.invoke('meetings:save', items),
  openLink: url => ipcRenderer.invoke('link:open', url),
  notify: (title, body) => ipcRenderer.invoke('notify', {title, body}),
  onReminder: callback => { ipcRenderer.on('reminder', (_event, m) => callback(m)); }
});
