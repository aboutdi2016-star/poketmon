const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pikaCompanion', {
  saveQuickNote: text => ipcRenderer.invoke('quick-note:save',text),
  productivityStatus: () => ipcRenderer.invoke('productivity:status'),
  saveSummary: () => ipcRenderer.invoke('summary:save'),
  snooze: () => ipcRenderer.send('companion:snooze'),
  onFocus: callback => ipcRenderer.on('focus:update',(_event,data)=>callback(data)),
  state: () => ipcRenderer.invoke('companion:state'),
  popup: () => ipcRenderer.invoke('companion:popup'),
  quickNote: () => ipcRenderer.send('companion:quick-note'),
  panel: () => ipcRenderer.send('companion:panel'),
  close: () => ipcRenderer.send('companion:close'),
  dashboard: section => ipcRenderer.send('companion:dashboard', section),
  command: input => ipcRenderer.send('companion:command', input),
  openOrigin: index => ipcRenderer.invoke('companion:origin',index),
  join: id => ipcRenderer.send('companion:join', id),
  openObsidian: id => ipcRenderer.invoke('obsidian:open',id),
  pointer: data => ipcRenderer.send('companion:pointer', data),
  menu: () => ipcRenderer.send('companion:menu'),
  onState: callback => ipcRenderer.on('companion:state', (_event, state) => callback(state)),
  onPopup: callback => ipcRenderer.on('companion:popup', (_event, data) => callback(data))
});
