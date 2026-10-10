const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain, shell, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { startServer } = require('./server.cjs');
const { createVault } = require('./credentials.cjs');
const { dueReminders, validateMeetings } = require('./reminders.cjs');
const { collect, safeUrl } = require('./integrations.cjs');
let window, tray, server, timer, syncTimer, quitting = false, meetings = [], reminded = new Set();
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
 app.on('second-instance', () => { if(window) { window.show(); window.focus(); } });
 app.whenReady().then(async () => {
  const vault = createVault(safeStorage, path.join(app.getPath('userData'), 'credentials.enc'));
  const getCredentials = () => ({...process.env, ...vault.values()});
  ipcMain.handle('credentials:status', () => vault.status());
  ipcMain.handle('credentials:save', (_event, input) => {try {return {ok:true,...vault.save(input)};}catch(error){return {ok:false,error:error.message};}});
  ipcMain.handle('credentials:clear', () => vault.clear());
  const file = path.join(app.getPath('userData'), 'meetings.json');
  try { const saved = JSON.parse(fs.readFileSync(file, 'utf8')); meetings = validateMeetings(saved.meetings); reminded = new Set(Array.isArray(saved.reminded) ? saved.reminded : []); } catch {}
  function persist() { fs.writeFileSync(file, JSON.stringify({meetings, reminded: [...reminded]}), {mode:0o600}); }
  ipcMain.handle('meetings:load', () => meetings);
  ipcMain.handle('meetings:save', (_event, items) => { meetings = validateMeetings(items); const valid = new Set(meetings.map(m => `${m.id}:${m.start}`)); reminded = new Set([...reminded].filter(id => valid.has(id))); persist(); return meetings; });
  ipcMain.handle('link:open', (_event, url) => { const clean = safeUrl(url); if (clean) return shell.openExternal(clean); });
  ipcMain.handle('notify', (_event, payload) => { if(Notification.isSupported() && typeof payload?.body === 'string') new Notification({title: String(payload.title || '피카 데이').slice(0,100),body:payload.body.slice(0,300)}).show(); });
  server = await startServer({port:3417,getCredentials});
  const address = `http://127.0.0.1:${server.address().port}`;
  // Fixed loopback origin keeps localStorage stable across launches.
  window = new BrowserWindow({width:1240,height:940,minWidth:390,minHeight:600,title:'피카 데이',icon:path.join(__dirname,'assets','tray.png'),backgroundColor:'#f7f8f2',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await window.loadURL(address);
  window.webContents.setWindowOpenHandler(({url}) => { if(safeUrl(url)) shell.openExternal(url); return {action:'deny'}; });
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(address + '/')) { event.preventDefault(); if(safeUrl(url)) shell.openExternal(url); } });
  window.on('close', event => { if(!quitting) { event.preventDefault(); window.hide(); } });
  const trayIcon = nativeImage.createFromPath(path.join(__dirname,'assets','tray.png'));
  tray = new Tray(trayIcon);
  tray.setToolTip('피카 데이 · 회의 알림 대기 중');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'피카 데이 열기',click:()=>window.show()},{label:'완전히 종료',click:()=>{quitting=true;app.quit();}}]));
  tray.on('click',()=>window.show());
  syncTimer = setInterval(async () => { const result = await collect(getCredentials()); window.webContents.send('sync:update', result); }, 300000);
  timer = setInterval(() => {
    for (const m of dueReminders(meetings, reminded)) {
      reminded.add(`${m.id}:${m.start}`); persist();
      window.webContents.send('reminder',m);
      if(Notification.isSupported()) { const note = new Notification({title:'⚡ 곧 회의가 시작돼요',body:`${m.title} · ${Math.ceil((Date.parse(m.start)-Date.now())/60000)}분 후`,actions:m.url?[{type:'button',text:'참가하기'}]:[]});
        const join = () => { if(m.url) shell.openExternal(m.url); else window.show(); };
        note.on('click',join); note.on('action',join); note.show(); }
    }
  },15000);
 }).catch(error=>{console.error('데스크톱 시작 실패:',error.message);app.quit();});
 app.on('before-quit',()=>{quitting=true;clearInterval(timer);clearInterval(syncTimer);server?.close();});
 app.on('window-all-closed',()=>{});
 app.on('activate',()=>window?.show());
}
