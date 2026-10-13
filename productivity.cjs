const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {localDay,exactTodayTask}=require('./day.js');
function quietNow(settings,date=new Date()){
 if(!settings?.quietEnabled)return false;const parse=t=>Number(t.slice(0,2))*60+Number(t.slice(3)),start=parse(settings.quietStart),end=parse(settings.quietEnd),now=date.getHours()*60+date.getMinutes();return start===end||start<end?(start===end||now>=start&&now<end):(now>=start||now<end);
}
function createProductivity(file,clock=Date.now){
 let data={settings:{quietEnabled:false,quietStart:'21:00',quietEnd:'09:00',notificationMode:'all',taskReminderHours:'work',petScale:1,positionLocked:false,sizeLocked:false},sessions:[],active:null,snoozed:[],digest:[],taskReminderSlot:null};try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));data={...data,...saved,settings:{...data.settings,...saved.settings}};}catch{}
 function persist(){fs.writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(file+'.tmp',file);}
 function finish(reason='stopped'){if(!data.active)return null;const active=data.active,end=Math.min(clock(),active.endAt),seconds=Math.max(0,Math.floor((end-active.startedAt)/1000));const session={id:active.id,startedAt:active.startedAt,endAt:end,seconds,completed:reason==='completed',taskCount:active.taskCount,day:localDay(new Date(active.startedAt))};data.sessions.push(session);data.sessions=data.sessions.slice(-1500);data.active=null;persist();return session;}
 function tick(){return data.active&&clock()>=data.active.endAt?finish('completed'):null;}
 if(data.settings.notificationMode==='priority'){data.settings.notificationMode='all';data.digest=[];persist();}
 // A restarted app does not claim focus time while it was closed.
 if(data.active){data.active=null;persist();}
 return {
  settings(){return {...data.settings};},
  saveSettings(input){const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;if(!time.test(input?.quietStart)||!time.test(input?.quietEnd))throw new Error('조용한 시간은 HH:MM 형식으로 입력해 주세요.');const mode=input.notificationMode??data.settings.notificationMode,scale=Number(input.petScale??data.settings.petScale);if(!['all','meetings'].includes(mode)||![0.75,1,1.25,1.5].includes(scale))throw new Error('알림 모드 또는 크기가 올바르지 않아요.');if(data.settings.sizeLocked&&scale!==data.settings.petScale)throw new Error('크기 잠금을 먼저 해제해 주세요.');data.settings={notificationMode:mode,taskReminderHours:input.taskReminderHours==='all'?'all':input.taskReminderHours==='work'?'work':data.settings.taskReminderHours,petScale:scale,positionLocked:!!(input.positionLocked??data.settings.positionLocked),sizeLocked:!!(input.sizeLocked??data.settings.sizeLocked),quietEnabled:!!input.quietEnabled,quietStart:input.quietStart,quietEnd:input.quietEnd};if(mode!=='priority')data.digest=[];persist();return this.settings();},
  route(priority=2,meeting=false){if(this.quiet())return 'silent';if(meeting)return 'immediate';return data.settings.notificationMode==='meetings'?'silent':'immediate';},
  queueDigest(item){data.digest.push({at:clock(),body:String(item.body).slice(0,300),count:Number(item.count)||1});data.digest=data.digest.slice(-100);persist();},
  flushDigest(){if(this.quiet()||data.settings.notificationMode!=='priority'||!data.digest.length||clock()-data.digest[0].at<3600000)return null;const items=data.digest;data.digest=[];persist();return {count:items.reduce((n,i)=>n+i.count,0),body:items.map(i=>i.body).slice(-3).join('\n')};},
  todayReminder(tasks){if(this.quiet()||this.route()==='silent')return null;const date=new Date(clock()),hour=date.getHours(),work=data.settings.taskReminderHours!=='all';if(work&&(hour<9||hour>=18))return null;const slot=Math.floor((hour-(work?9:0))/2),key=localDay(date)+':'+(work?'work':'all')+':'+slot;if(data.taskReminderSlot===key)return null;const items=tasks.filter(t=>exactTodayTask(t,localDay(date)));if(!items.length)return null;data.taskReminderSlot=key;persist();return items;},
  quiet(){return quietNow(data.settings,new Date(clock()));},
  focus(start,taskCount=0){if(!start)return finish();if(data.active)return data.active;data.active={id:randomUUID(),startedAt:clock(),endAt:clock()+25*60000,taskCount:Number.isFinite(taskCount)?taskCount:0};persist();return data.active;},
  tick,stop:finish,
  summary(day=localDay(new Date(clock()))){const start=new Date(day+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+1);const begin=start.getTime(),limit=end.getTime(),sessions=data.sessions.filter(s=>s.endAt>begin&&s.startedAt<limit),seconds=sessions.reduce((a,s)=>a+Math.max(0,Math.floor((Math.min(s.endAt,limit)-Math.max(s.startedAt,begin))/1000)),0),activeSeconds=data.active?Math.max(0,Math.floor((Math.min(clock(),data.active.endAt,limit)-Math.max(data.active.startedAt,begin))/1000)):0;return {day,minutes:Math.floor((seconds+activeSeconds)/60),sessions:sessions.length,completed:sessions.filter(s=>s.completed&&localDay(new Date(s.endAt))===day).length,active:data.active?{...data.active}:null};},
  snooze(payload){data.snoozed.push({id:randomUUID(),at:clock()+600000,payload});data.snoozed=data.snoozed.slice(-100);persist();},
  due(){if(this.quiet())return [];const due=data.snoozed.filter(s=>s.at<=clock());data.snoozed=data.snoozed.filter(s=>s.at>clock());if(due.length)persist();return due.map(s=>s.payload);}
 };
}
module.exports={createProductivity,quietNow};
