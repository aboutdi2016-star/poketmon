const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain, shell, safeStorage, screen, dialog, powerMonitor } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { startServer } = require('./server.cjs');
const { createVault } = require('./credentials.cjs');
const { dueReminders, validateMeetings } = require('./reminders.cjs');
const { collect, safeUrl } = require('./integrations.cjs');
const { cleanSnapshot, completionCheer, clampBounds, popoverBounds } = require('./companion.cjs');
const { createObsidian } = require('./obsidian.cjs');
const dialogue = require('./dialogue.js');
const {createGoogleAuth}=require('./google-auth.cjs');
const {createProductivity}=require('./productivity.cjs');
const {localDay,todayTask}=require('./day.js');
let window, pet, popover, tray, server, timer, syncTimer, bubbleTimer, productivity, quitting=false, ready=false;
let meetings=[],reminded=new Set(),snapshot=null,popup={mode:'panel'},drag=null,bubbles=[],pinned=true;
const lock=app.requestSingleInstanceLock();
if(!lock) app.quit();
else {
 app.on('second-instance',()=>{if(pet){pet.showInactive();pet.setIgnoreMouseEvents(false);}});
 app.whenReady().then(async()=>{
  if(process.platform==='win32')app.setAppUserModelId('PikaDay');
  const vault=createVault(safeStorage,path.join(app.getPath('userData'),'credentials.enc'));
  const getCredentials=()=>({...process.env,...vault.values()});
  const google=createGoogleAuth({values:getCredentials,save:input=>vault.save(input)});
  productivity=createProductivity(path.join(app.getPath('userData'),'productivity.json'));
  const obsidian=createObsidian(path.join(app.getPath('userData'),'obsidian.json'));
  async function collectAll(){const selected=obsidian.status().path;let env=getCredentials(),authError=null;try{env=await google.credentials();}catch(error){authError=error.message;env={...env,GMAIL_ACCESS_TOKEN:''};}const [remote,local]=await Promise.all([collect(env),obsidian.collect()]);if(authError)for(const result of remote.results.filter(p=>['gmail','calendar'].includes(p.source)))Object.assign(result,{status:'error',message:authError});return {...remote,results:[...remote.results,selected===obsidian.status().path?local:await obsidian.collect()]};}

  const scheduleFile=path.join(app.getPath('userData'),'meetings.json');
  const positionFile=path.join(app.getPath('userData'),'companion-position.json');
  try{const saved=JSON.parse(fs.readFileSync(scheduleFile,'utf8'));meetings=validateMeetings(saved.meetings);reminded=new Set(Array.isArray(saved.reminded)?saved.reminded:[]);}catch{}
  function persistMeetings(){fs.writeFileSync(scheduleFile,JSON.stringify({meetings,reminded:[...reminded]}),{mode:0o600});}
  function persistPosition(){if(pet&&!pet.isDestroyed())fs.writeFileSync(positionFile,JSON.stringify(pet.getBounds()),{mode:0o600});}
  const isDashboard=e=>e.sender===window?.webContents;
  const isCompanion=e=>e.sender===pet?.webContents||e.sender===popover?.webContents;
  const allowed=e=>isDashboard(e)||isCompanion(e);
  const send=(target,channel,data)=>{if(target&&!target.isDestroyed())target.webContents.send(channel,data);};
  function areaFor(bounds){return screen.getDisplayNearestPoint({x:bounds.x+Math.round(bounds.width/2),y:bounds.y+Math.round(bounds.height/2)}).workArea;}
  function anchorPopup(){if(!pet||!popover)return;const bounds=popoverBounds(pet.getBounds(),areaFor(pet.getBounds()),360,popup.mode==='bubble'?204:440),side=bounds.x<pet.getBounds().x?'right':'left',changed=popup.side!==side;popup.side=side;popover.setBounds(bounds);if(changed)send(popover,'companion:popup',popup);}
  function showDashboard(section){window.show();window.focus();hidePopup(false);if(section==='settings')send(window,'companion:command',{type:'settings'});}
  function showQuickNote(){showPanel();send(popover,'companion:popup',{...popup,quickNote:true});}
  function resizePet(){if(!pet)return;const scale=productivity.settings().petScale,b=pet.getBounds();pet.setBounds(clampBounds({...b,width:Math.round(180*scale),height:Math.round(190*scale)},areaFor(b)));anchorPopup();persistPosition();}
  function showPanel(){if(!ready)return;send(window,'companion:command',{type:'activity'});clearTimeout(bubbleTimer);if(popup.mode==='bubble')bubbles.unshift(popup);popup={mode:'panel'};anchorPopup();send(popover,'companion:popup',popup);popover.show();popover.focus();}
  function hidePopup(advance=true){clearTimeout(bubbleTimer);popover?.hide();popup={mode:'panel'};if(advance)setTimeout(nextBubble,100);}
  function nextBubble(){
   if(productivity.quiet())return;
   if(!ready||!pet.isVisible()||popover.isVisible()||!bubbles.length)return;
   popup=bubbles.shift();if(popup.meetingId){const m=meetings.find(m=>m.id===popup.meetingId);if(!m||Date.now()>Date.parse(m.start)+600000){popup={mode:'panel'};nextBubble();return;}const minutes=Math.ceil((Date.parse(m.start)-Date.now())/60000);popup.body=`${m.title} · ${minutes>0?minutes+'분 후 시작해요.':'회의가 시작됐어요.'}`;}anchorPopup();send(popover,'companion:popup',popup);popover.showInactive();
   bubbleTimer=setTimeout(()=>{popover.hide();popup={mode:'panel'};nextBubble();},popup.meetingId?60000:12000);
  }
  function bubble(title,body,{meetingId=null,canJoin=false}={}){
   if(productivity.quiet()||(!meetingId&&productivity.settings().notificationMode==='meetings'))return;
   const item={mode:'bubble',title:String(title).slice(0,150),body:String(body).slice(0,350),meetingId,canJoin};
   if(meetingId&&popover?.isVisible()&&popup.mode==='bubble'&&!popup.meetingId){clearTimeout(bubbleTimer);popover.hide();popup={mode:'panel'};}
   if(meetingId){bubbles=bubbles.filter(b=>b.meetingId!==meetingId);bubbles.unshift(item);}else bubbles.push(item);
   if(bubbles.length>10)bubbles.splice(10);
   nextBubble();
  }
  function nativeNote(title,body,meetingId=null){
   if(productivity.quiet()||!Notification.isSupported())return;
   const note=new Notification({title,body});
   note.on('click',()=>{const m=meetings.find(m=>m.id===meetingId);const url=safeUrl(m?.url);if(url)shell.openExternal(url);else showPanel();});note.show();
  }
  function menuTemplate(){return [
   {label:'오늘의 할 일',click:()=>{pet.showInactive();showPanel();}},
   {label:'빠른 메모',click:showQuickNote},
   {label:'전체 화면 열기',click:()=>showDashboard()},
   {label:'서비스 연결 · 설정',click:()=>showDashboard('settings')},
   {type:'separator'},
   {label:'피카츄 표시',type:'checkbox',checked:pet.isVisible(),click:item=>{if(item.checked){pet.showInactive();pet.setIgnoreMouseEvents(false);nextBubble();}else{pet.hide();hidePopup(false);}refreshTray();}},
   {label:'다른 창 위에 표시',type:'checkbox',checked:pinned,click:item=>{pinned=item.checked;pet.setAlwaysOnTop(pinned,'floating');popover.setAlwaysOnTop(pinned,'floating');refreshTray();}},
   {label:'위치 잠금',type:'checkbox',checked:productivity.settings().positionLocked,click:item=>{productivity.saveSettings({...productivity.settings(),positionLocked:item.checked});drag=null;refreshTray();}},
   {label:'피카츄 위치 초기화',enabled:!productivity.settings().positionLocked,click:()=>{const a=screen.getPrimaryDisplay().workArea;pet.setBounds({x:a.x+a.width-198,y:a.y+a.height-212,width:pet.getBounds().width,height:pet.getBounds().height});pet.showInactive();pet.setIgnoreMouseEvents(false);anchorPopup();persistPosition();refreshTray();}},
   {type:'separator'},
   {label:'25분 집중하기',click:()=>send(window,'companion:command',{type:'focus'})},
   {label:'5분 쉬기',click:()=>send(window,'companion:command',{type:'rest'})},
   {type:'separator'},
   {label:'완전히 종료',click:()=>{quitting=true;app.quit();}}
  ];}
  function refreshTray(){tray?.setContextMenu(Menu.buildFromTemplate(menuTemplate()));}
  ipcMain.handle('credentials:status',e=>isDashboard(e)?vault.status():null);
  ipcMain.handle('credentials:save',(e,input)=>{if(!isDashboard(e))return {ok:false};try{google.reset();return {ok:true,...vault.save(input)};}catch(error){return {ok:false,error:error.message};}});
  ipcMain.handle('credentials:clear',e=>{if(!isDashboard(e))return null;google.reset();return vault.clear();});
  function broadcastFocus(){const state=productivity.summary();send(window,'focus:update',state);send(popover,'focus:update',state);return state;}
  ipcMain.handle('productivity:status',e=>allowed(e)?{settings:productivity.settings(),focus:productivity.summary()}:null);
  ipcMain.handle('productivity:settings',(e,input)=>{if(!isDashboard(e))return {ok:false};try{const settings=productivity.saveSettings(input);drag=null;resizePet();refreshTray();bubbles=bubbles.filter(b=>settings.notificationMode!=='meetings'||b.meetingId);if(productivity.quiet()||settings.notificationMode==='meetings'&&!popup.meetingId){bubbles=[];if(popup.mode==='bubble')hidePopup(false);}return {ok:true,settings};}catch(error){return {ok:false,error:error.message};}});
  ipcMain.handle('startup:status',e=>isDashboard(e)?{supported:process.platform==='win32',enabled:process.platform==='win32'&&app.getLoginItemSettings().openAtLogin}:null);
  ipcMain.handle('startup:set',(e,enabled)=>{if(!isDashboard(e)||process.platform!=='win32')return {ok:false,error:'Windows에서만 지원해요.'};try{app.setLoginItemSettings({openAtLogin:!!enabled,path:process.execPath,args:[]});const actual=app.getLoginItemSettings().openAtLogin;return {ok:actual===!!enabled,enabled:actual,error:actual===!!enabled?null:'Windows 시작 앱 설정을 확인해 주세요.'};}catch(error){return {ok:false,error:error.message};}});
  ipcMain.handle('quick-note:save',async(e,text)=>{if(!allowed(e))return {ok:false};try{return {ok:true,...await obsidian.saveQuickNote(text)};}catch(error){return {ok:false,error:error.message};}});
  ipcMain.on('companion:quick-note',e=>{if(isCompanion(e))showQuickNote();});
  ipcMain.handle('focus:set',(e,start)=>{if(!isDashboard(e))return null;productivity.focus(!!start,snapshot?.tasks.filter(t=>t.done).length||0);return broadcastFocus();});
  ipcMain.on('companion:snooze',e=>{if(!isCompanion(e)||popup.mode!=='bubble')return;productivity.snooze({...popup});hidePopup();});
  ipcMain.handle('summary:save',async e=>{
   if(!allowed(e))return {ok:false};
   try{const day=localDay(),tasks=snapshot?.tasks||[],focus=productivity.summary(day),escape=s=>String(s).replace(/[\r\n]/g,' ').replace(/<!--/g,'&lt;!--');const completed=tasks.filter(t=>t.done&&t.completedAt&&localDay(new Date(t.completedAt))===day),remaining=tasks.filter(t=>!t.done&&(todayTask(t,day)||(!t.due&&!t.scheduled)));
    const body=`# ${day} 하루 마무리\n\n집중 시간: ${focus.minutes}분 · 완료한 집중 세션: ${focus.completed}회\n\n## 오늘 완료한 일 (${completed.length})\n`+(completed.map(t=>'- [x] '+escape(t.title)).join('\n')||'- 기록된 완료가 없어요.')+`\n\n## 내일로 넘길 일 (${remaining.length})\n`+(remaining.map(t=>'- [ ] '+escape(t.title)).join('\n')||'- 남은 일이 없어요.');
    const result=await obsidian.saveReport(day,body);return {ok:true,...result};
   }catch(error){return {ok:false,error:error.message};}
  });
  ipcMain.handle('obsidian:status',e=>isDashboard(e)?obsidian.status():null);
  ipcMain.handle('obsidian:choose',async e=>{
   if(!isDashboard(e))return {ok:false};
   const selected=await dialog.showOpenDialog(window,{title:'옵시디언 보관함 폴더 선택',properties:['openDirectory']});
   if(selected.canceled)return {ok:false,canceled:true};
   try{return {ok:true,...await obsidian.choose(selected.filePaths[0])};}catch(error){return {ok:false,error:error.message};}
  });
  ipcMain.handle('obsidian:clear',async e=>isDashboard(e)?obsidian.clear():null);
  ipcMain.handle('obsidian:open',(e,id)=>{if(!allowed(e)||typeof id!=='string')return;const url=obsidian.noteUrl(id);if(url)return shell.openExternal(url);});
  ipcMain.handle('meetings:load',e=>isDashboard(e)?meetings:[]);
  ipcMain.handle('meetings:save',(e,items)=>{
   if(!isDashboard(e))return [];
   meetings=validateMeetings(items);const valid=new Set(meetings.map(m=>`${m.id}:${m.start}`));reminded=new Set([...reminded].filter(id=>valid.has(id)));persistMeetings();
   bubbles=bubbles.filter(b=>!b.meetingId||meetings.some(m=>m.id===b.meetingId));
   if(popup.meetingId&&!meetings.some(m=>m.id===popup.meetingId))hidePopup();
   return meetings;
  });
  ipcMain.handle('link:open',(e,url)=>{if(!allowed(e))return;const clean=safeUrl(url);if(clean)return shell.openExternal(clean);});
  ipcMain.handle('notify',(e,payload)=>{if(!isDashboard(e)||typeof payload?.body!=='string')return;const title=String(payload.title||'피카 데이').slice(0,100),body=payload.body.slice(0,300);const route=productivity.route(payload.priority);if(route==='digest'){productivity.queueDigest({body,count:payload.count});return;}if(route==='immediate'){bubble(title,body);nativeNote(title,body);}});
  ipcMain.handle('companion:state',e=>isCompanion(e)?snapshot:null);
  ipcMain.handle('companion:popup',e=>isCompanion(e)?popup:null);
  ipcMain.on('companion:publish',(e,input)=>{
   if(!isDashboard(e))return;const next=cleanSnapshot(input),cheer=completionCheer(snapshot,next),previousMood=snapshot?.mood;snapshot=next;
   send(pet,'companion:state',snapshot);send(popover,'companion:state',snapshot);
   if(cheer&&productivity.route()==='immediate'){const done=next.tasks.filter(t=>t.done).length,total=next.tasks.length;const kind=done===total?'complete':done>=total/2?'halfway':'step';bubble(dialogue.pick(kind)+` (${done}/${total})`,dialogue.pick('happy'));}
   else if(productivity.route()==='immediate'&&ready&&next.mood!==previousMood&&['focused','goofy'].includes(next.mood))bubble(next.greeting,next.message);
  });
  ipcMain.on('companion:panel',e=>{if(isCompanion(e))showPanel();});
  ipcMain.on('companion:close',e=>{if(isCompanion(e))hidePopup();});
  ipcMain.on('companion:dashboard',(e,section)=>{if(isCompanion(e))showDashboard(section);});
  ipcMain.on('companion:command',(e,input)=>{
   if(!isCompanion(e)||!['toggle-task','toggle-core','add-task','sync','focus','rest'].includes(input?.type))return;
   if(input.type==='toggle-task'&&typeof input.id!=='string')return;
   send(window,'companion:command',{type:input.type,id:typeof input.id==='string'?input.id.slice(0,200):null,done:!!input.done,title:typeof input.title==='string'?input.title.slice(0,140):'',priority:input.priority===1?1:2});
  });
  ipcMain.on('companion:join',(e,id)=>{if(!isCompanion(e))return;const m=meetings.find(m=>m.id===id);const url=safeUrl(m?.url);if(url){shell.openExternal(url);hidePopup();}});
  ipcMain.on('companion:menu',e=>{if(e.sender===pet?.webContents)Menu.buildFromTemplate(menuTemplate()).popup({window:pet});});
  ipcMain.on('companion:pointer',(e,data)=>{
   if(e.sender!==pet?.webContents)return;
   if(data?.phase==='ignore'){if(!drag)pet.setIgnoreMouseEvents(!!data.value,{forward:true});}
   else if(data?.phase==='start'&&!productivity.settings().positionLocked){drag={point:screen.getCursorScreenPoint(),bounds:pet.getBounds()};pet.setIgnoreMouseEvents(false);}
   else if(data?.phase==='move'&&drag&&!productivity.settings().positionLocked){const p=screen.getCursorScreenPoint(),b={...drag.bounds,x:drag.bounds.x+p.x-drag.point.x,y:drag.bounds.y+p.y-drag.point.y};pet.setBounds(clampBounds(b,screen.getDisplayNearestPoint(p).workArea));if(popover.isVisible())anchorPopup();}
   else if(data?.phase==='end'){drag=null;persistPosition();}
  });
  server=await startServer({port:3417,getCredentials,collectData:collectAll});const address=`http://127.0.0.1:${server.address().port}`;
  const securePreferences=preload=>({preload:path.join(__dirname,preload),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false});
  window=new BrowserWindow({show:false,width:1240,height:940,minWidth:390,minHeight:600,title:'피카 데이',icon:path.join(__dirname,'assets','tray.png'),backgroundColor:'#f7f8f2',webPreferences:securePreferences('preload.cjs')});
  const area=screen.getPrimaryDisplay().workArea;
  let position={x:area.x+area.width-198,y:area.y+area.height-212,width:Math.round(180*productivity.settings().petScale),height:Math.round(190*productivity.settings().petScale)};
  try{const saved=JSON.parse(fs.readFileSync(positionFile,'utf8'));if(Number.isFinite(saved.x)&&Number.isFinite(saved.y))position=clampBounds({...position,x:saved.x,y:saved.y},areaFor({...position,x:saved.x,y:saved.y}));}catch{}
  const floating={show:false,frame:false,transparent:true,resizable:false,maximizable:false,minimizable:false,skipTaskbar:true,hasShadow:false,alwaysOnTop:true,backgroundColor:'#00000000',webPreferences:securePreferences('companion-preload.cjs')};
  pet=new BrowserWindow({...floating,...position,title:'피카츄'});popover=new BrowserWindow({...floating,width:360,height:440,title:'피카 데이 · 작은 패널'});
  for(const target of [window,pet,popover]){
   target.webContents.setWindowOpenHandler(({url})=>{if(safeUrl(url))shell.openExternal(url);return {action:'deny'};});
   target.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(address+'/')){event.preventDefault();if(safeUrl(url))shell.openExternal(url);}});
   target.on('close',event=>{if(!quitting){event.preventDefault();target.hide();if(target===pet)hidePopup(false);if(target===popover)hidePopup();}});
  }
  window.on('minimize',()=>window.hide());
  popover.on('blur',()=>{if(popup.mode==='panel')hidePopup();});
  pet.on('move',()=>{if(popover.isVisible())anchorPopup();});
  screen.on('display-removed',()=>{pet.setBounds(clampBounds(pet.getBounds(),screen.getPrimaryDisplay().workArea));anchorPopup();persistPosition();});
  screen.on('display-metrics-changed',()=>{pet.setBounds(clampBounds(pet.getBounds(),areaFor(pet.getBounds())));anchorPopup();});
  await window.loadURL(address+'/');await pet.loadURL(address+'/pet.html');await popover.loadURL(address+'/companion.html');
  tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'assets','tray.png')));tray.setToolTip('피카 데이 · 클릭하면 오늘의 할 일');tray.on('click',()=>{pet.showInactive();pet.setIgnoreMouseEvents(false);showPanel();refreshTray();});
  pet.on('show',refreshTray);pet.on('hide',refreshTray);
  ready=true;pet.setAlwaysOnTop(true,'floating');popover.setAlwaysOnTop(true,'floating');pet.showInactive();refreshTray();
  send(pet,'companion:state',snapshot);send(popover,'companion:state',snapshot);
  const left=snapshot?.tasks.filter(t=>!t.done)||[],p1=left.filter(t=>t.priority===1).length;
  bubble(dialogue.pick('welcome'),left.length?`남은 할 일 ${left.length}개 · P1 ${p1}개. 하나씩 함께 해봐요.`:'저를 클릭하면 할 일을 볼 수 있어요. 드래그해서 편한 곳으로 옮겨 주세요.');
  syncTimer=setInterval(async()=>{try{send(window,'sync:update',await collectAll(getCredentials()));}catch{bubble(dialogue.pick('angry'),'설정에서 연결 상태를 확인할 수 있어요.');}},300000);
  function checkMeetings(){for(const m of dueReminders(meetings,reminded)){reminded.add(`${m.id}:${m.start}`);persistMeetings();send(window,'reminder',m);const body=`${m.title} · ${Math.max(1,Math.ceil((Date.parse(m.start)-Date.now())/60000))}분 후 시작해요.`;bubble(dialogue.pick('meeting'),body,{meetingId:m.id,canJoin:!!safeUrl(m.url)});nativeNote('⚡ 곧 회의가 시작돼요',body,m.id);}}
  function tick(){checkMeetings();const finished=productivity.tick();broadcastFocus();const digest=productivity.flushDigest();if(digest){bubble(`P2 새 할 일 ${digest.count}개 · 한 시간 요약`,digest.body);nativeNote('⚡ P2 한 시간 요약',digest.body);}if(finished&&productivity.route()==='immediate')bubble(dialogue.pick('happy'),'25분 집중을 마쳤어요! 오늘의 집중 기록에 저장했어요.');for(const item of productivity.due()){if(item.meetingId){const m=meetings.find(m=>m.id===item.meetingId);if(!m||Date.parse(m.start)+600000<=Date.now())continue;}bubble(item.title,item.body,item);}nextBubble();}
  powerMonitor.on('suspend',()=>{productivity.stop();broadcastFocus();});
  tick();timer=setInterval(tick,15000);
 }).catch(error=>{console.error('데스크톱 시작 실패:',error.message);app.quit();});
 app.on('before-quit',()=>{quitting=true;productivity?.stop();clearInterval(timer);clearInterval(syncTimer);clearTimeout(bubbleTimer);server?.close();});
 app.on('window-all-closed',()=>{});
 app.on('activate',()=>{pet?.showInactive();pet?.setIgnoreMouseEvents(false);});
}
