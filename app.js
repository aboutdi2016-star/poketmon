'use strict';
const $ = id => document.getElementById(id);
const desktop = window.pikaDesktop;
const KEY = 'pika-day-state-v2';
const names = {manual:'나의 할 일',slack:'Slack',gmail:'Gmail',jira:'Jira',calendar:'Google Calendar'};
let storageOkay = true;
function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (parsed && Array.isArray(parsed.tasks) && Array.isArray(parsed.meetings) && Array.isArray(parsed.alerts)) return parsed;
    const old = JSON.parse(localStorage.getItem('pika-day-tasks-v1') || '[]');
    return {tasks:Array.isArray(old)?old.map(t=>({...t,source:'manual'})):[],meetings:[],alerts:[],seen:[],dismissed:[],reminded:[],providers:[],checkedAt:null};
  } catch { storageOkay=false; return {tasks:[],meetings:[],alerts:[],seen:[],dismissed:[],reminded:[],providers:[],checkedAt:null}; }
}
let state = load();
for (const key of ['seen','dismissed','reminded','providers']) if(!Array.isArray(state[key])) state[key]=[];
state.tasks = state.tasks.map(t=>({...t,priority:t.priority===3?2:t.priority})).filter(t => typeof t.id==='string' && typeof t.title==='string' && [1,2,3].includes(t.priority));
state.meetings = state.meetings.filter(m=>typeof m.id==='string'&&typeof m.title==='string'&&Number.isFinite(Date.parse(m.start)));
let filter='all', syncing=false, syncError=false, toastTimer, forcedEmotion=null;
function persist() { try { localStorage.setItem(KEY,JSON.stringify(state)); } catch { storageOkay=false; toast('저장이 불가능해 현재 화면에만 유지돼요.'); } }
function save() { persist(); render(); }
function toast(message) { $('toast').textContent=message; $('toast').style.display='block'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').style.display='none',4000); }
function el(tag,cls,text) { const item=document.createElement(tag); if(cls)item.className=cls; if(text!==undefined)item.textContent=text; return item; }
function addAlert(title,body,type='tasks',key=null) {
  if(key && state.alerts.some(a=>a.key===key))return;
  state.alerts.unshift({id:crypto.randomUUID(),title,body,type,key,time:new Date().toISOString(),read:false});
  state.alerts=state.alerts.slice(0,50);
}
function validLink(url) { try { return new URL(url).protocol==='https:'; } catch { return false; } }
function openLink(url) { if(!validLink(url))return; if(desktop)desktop.openLink(url); else window.open(url,'_blank','noopener,noreferrer'); }
function notify(title,body) {
  if(desktop) desktop.notify(title,body);
  else if('Notification' in window && Notification.permission==='granted')new Notification(title,{body});
}
let personalPicture=null, pictureMode='expressions';
try{const picture=JSON.parse(localStorage.getItem('pika-day-picture-v1')||'null');if(picture&&/^data:image\/(png|jpeg|webp);base64,/.test(picture.src)){personalPicture=picture;pictureMode=localStorage.getItem('pika-day-picture-mode')||'picture';}}catch{}
let facePreview=null, focusUntil=0, restUntil=0, lastInteraction=Date.now();
function expression(mood) {
  const face=PikaFaces.get(mood);
  const showPicture=!!personalPicture&&pictureMode==='picture'&&!facePreview;
  $('personal-picture').hidden=!showPicture;document.querySelector('.captain-art').hidden=showPicture;
  if(showPicture&&$('personal-picture').getAttribute('src')!==personalPicture.src)$('personal-picture').src=personalPicture.src;
  for(const id of ['show-picture','show-expressions','remove-picture'])$(id).hidden=!personalPicture;
  $('show-picture').setAttribute('aria-pressed',String(showPicture));$('show-expressions').setAttribute('aria-pressed',String(!showPicture));
  document.querySelector('.art').dataset.emotion=mood;
  document.querySelector('.art').setAttribute('aria-label',face.label+' 표정의 캡틴 피카츄');
  $('eyes').innerHTML=face.eyes;$('brows').innerHTML=face.brows;
  $('mouth').innerHTML=face.mouth;$('ears').innerHTML=face.ears;$('face-extra').innerHTML=face.extra;
  $('emotion').textContent=(facePreview?'미리보기 · ':showPicture?'내 그림 · ':'')+face.label+' · '+face.caption;
  document.querySelectorAll('.face-choice').forEach(b=>{b.classList.toggle('selected',b.dataset.face===facePreview);b.setAttribute('aria-pressed',String(b.dataset.face===facePreview));});
  $('focus-toggle').textContent=Date.now()<focusUntil?'집중 마치기':'⚡ 집중하기';
  $('rest-toggle').textContent=Date.now()<restUntil?'쉬기 마치기':'☁ 잠깐 쉬기';
}
function renderTasks() {
  const done=state.tasks.filter(t=>t.done).length,total=state.tasks.length,left=total-done,urgent=state.tasks.filter(t=>!t.done&&t.priority===1).length,pct=total?Math.round(done/total*100):0;
  $('all-count').textContent=total;$('urgent-count').textContent=urgent;$('done-count').textContent=done;$('total').textContent=total?`· ${total}`:'';
  $('percent').textContent=pct+'%';$('fill').style.width=pct+'%';$('progress-text').textContent=`${total}개의 할 일 중 ${done}개를 마쳤어요.`;$('remaining').textContent=`${left}개의 작은 한 걸음이 남았어요`;
  let mood=urgent?'determined':'confident', greeting='피카피카! 오늘도 응원할게요.',message=left?`할 일이 ${left}개 남았어요. ${urgent?`P1 ${urgent}개부터 `:''}하나씩 함께 해봐요.`:'작은 할 일 하나부터 적어봐요.';
  if(total && done>=total/2) {mood='happy';greeting=done===total?'모두 해냈어요! 정말 멋져요 ⚡':`벌써 절반 했어요! (${done}/${total})`;message=done===total?'수고했어요. 이제 푹 쉬어도 괜찮아요.':`멋져요! ${left}개도 함께 해봐요.`;}
  if(state.alerts.some(a=>!a.read&&a.type==='tasks')){mood=state.alerts.find(a=>!a.read&&a.type==='tasks').count>=3?'surprised':'excited';greeting='피카! 새로운 소식이 왔어요.';message=state.alerts.find(a=>!a.read&&a.type==='tasks').body;}
  if(left>=10&&!state.alerts.some(a=>!a.read&&a.type==='tasks')){mood='tired';greeting='할 일이 많아도 괜찮아요.';message=`${left}개를 한 번에 할 필요 없어요. 하나씩 함께 해봐요.`;}
  if(state.providers.some(p=>p.status==='error')){mood='angry';greeting='앗, 연결이 잠깐 꼬였어요.';message='피카츄도 같이 해결할게요. 연결 안내에서 인증과 권한을 확인해 주세요.';}
  if(Date.now()-lastInteraction>=20*60000){mood='sleepy';greeting='피카… 잠깐 쉬어갈까요?';message='한동안 조용했네요. 눈도 어깨도 가볍게 풀어주세요.';}
  if(Date.now()<restUntil){mood='goofy';greeting='피카~ 잠깐 웃고 갈까요?';message='5분만 가볍게 쉬어요. 다시 돌아오면 함께 시작해요.';}
  if(Date.now()<focusUntil){mood='focused';greeting='좋아요, 지금은 집중할 시간!';message='25분 동안 한 가지 일에 집중해 봐요. 피카츄가 응원할게요.';}
  if(forcedEmotion && Date.now()<forcedEmotion.until) {mood=forcedEmotion.mood;greeting=forcedEmotion.title;message=forcedEmotion.body;}
  if(facePreview){mood=facePreview;greeting=PikaFaces.get(mood).label+' 표정 미리보기';message=PikaFaces.get(mood).caption;}
  expression(mood);$('greeting').textContent=greeting;$('message').textContent=message;
  const visible=state.tasks.filter(t=>filter==='all'||(filter==='urgent'?!t.done&&t.priority===1:t.done)).slice().sort((a,b)=>Number(a.done)-Number(b.done)||a.priority-b.priority);
  $('tasks').replaceChildren();
  for(const t of visible){
    const row=el('div','task'+(t.done?' done':'')),cb=el('input','check');cb.type='checkbox';cb.checked=!!t.done;cb.setAttribute('aria-label',t.title+' 완료');
    cb.onchange=()=>{t.done=cb.checked;if(t.done){const n=state.tasks.filter(x=>x.done).length;const message=n===total?`모두 해냈어요! (${n}/${total})`:n>=total/2?`벌써 절반 했어요! (${n}/${total})`:`한 걸음 더 해냈어요! (${n}/${total})`;forcedEmotion={mood:'happy',title:message,body:'피카츄가 힘껏 응원하고 있어요 ⚡',until:Date.now()+30000};toast(message);}else forcedEmotion=null;save();};
    const content=el('div','task-content'),title=el('div','task-title',t.title),meta=el('div','meta');
    meta.append(el('span','',`${t.demo?'예시 · ':''}${names[t.source]||'나의 할 일'}${t.candidate?' · 확인할 후보':''}${t.done?' · 완료':''}`));
    if(validLink(t.url)){const link=el('a','source-link','원문 ↗');link.href=t.url;link.target='_blank';link.rel='noopener noreferrer';link.onclick=e=>{e.preventDefault();openLink(t.url);};meta.append(link);}
    content.append(title,meta);const p=el('span','priority p'+t.priority,'P'+t.priority),del=el('button','delete','×');del.setAttribute('aria-label',t.title+' 삭제');
    del.onclick=()=>{state.tasks=state.tasks.filter(x=>x.id!==t.id);if(t.source!=='manual')state.dismissed.push(t.id);save();};row.append(cb,content,p,del);$('tasks').append(row);
  }
  if(!visible.length)$('tasks').append(el('div','empty',filter==='done'?'완료한 일들이 여기에 모여요 🌱':filter==='urgent'?'급한 할 일이 없어요. 차근차근 해봐요 🌱':'할 일을 추가하거나 업무 서비스를 연결해 주세요 ⚡'));
}
function renderConnections() {
  $('services').replaceChildren();
  for(const id of ['slack','gmail','calendar','jira']) {const provider=state.providers.find(p=>p.source===id),status=provider?.status||'disconnected',card=el('div','service '+status);card.append(el('b','',names[id]),el('span','',status==='connected'?'● 연결됨':status==='error'?'● 수집 오류':'○ 연결 필요'));card.title=provider?.message||'연결 설정이 필요해요.';$('services').append(card);}
  const connected=state.providers.filter(p=>p.status==='connected').length,errors=state.providers.filter(p=>p.status==='error').length;
  $('sync-status').textContent=syncError?'수집 서버 연결 실패 · 앱 실행 상태를 확인해 주세요.':syncing?'최근 업무를 확인하고 있어요…':state.tasks.some(t=>t.demo)?'예시 체험 중 · 실제 계정에서 수집한 항목이 아닙니다.':connected?`${connected}개 서비스 확인 · ${state.checkedAt?new Date(state.checkedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):''}${errors?' · 일부 수집 실패':''}`:errors?'수집 실패 · 연결 권한과 네트워크 설정을 확인해 주세요.':'계정 연결 후 실제 할 일을 모을 수 있어요.';
  $('sync').disabled=syncing;
}
function renderMeetings() {
  $('meetings').replaceChildren();
  const upcoming=state.meetings.filter(m=>Date.parse(m.start)>Date.now()-600000).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  for(const m of upcoming) {
    const row=el('div','meeting'),date=new Date(m.start),time=el('div','meeting-time',date.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}));time.append(el('small','',date.toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'})));
    const info=el('div','meeting-info',m.title),minutes=Math.ceil((date-Date.now())/60000);info.append(el('small','',`${m.demo?'예시 · ':''}${m.source==='calendar'?'Google Calendar':'직접 등록'} · ${minutes>0?minutes+'분 후':'진행 중'}`));row.append(time,info);
    if(validLink(m.url)){const join=el('button','join','참가하기 ↗');join.onclick=()=>openLink(m.url);row.append(join);}else row.append(el('span','meta','참가 링크 없음'));
    if(m.source!=='calendar'||m.demo){const del=el('button','delete','×');del.setAttribute('aria-label',m.title+' 회의 삭제');del.onclick=()=>{state.meetings=state.meetings.filter(x=>x.id!==m.id);saveMeetings();save();};row.append(del);}
    $('meetings').append(row);
  }
  if(!upcoming.length)$('meetings').append(el('div','compact-empty','다가오는 회의가 없어요. 캘린더를 연결하거나 회의를 직접 추가해 주세요.'));
  $('reminder-status').textContent=desktop?'창을 닫아도 트레이에서 10분 전 알림 · 완전히 종료하면 중단돼요.':'웹 모드 · 페이지를 열어둔 동안 10분 전 알림';
  $('enable-notifications').textContent=desktop?'알림 테스트':('Notification' in window&&Notification.permission==='granted'?'알림 켜짐':'알림 켜기');
}
function renderAlerts() {
  $('alerts').replaceChildren();const unread=state.alerts.filter(a=>!a.read).length;$('alert-count').textContent=unread?'· '+unread:'';
  for(const a of state.alerts.slice(0,5)){const row=el('div','alert'+(a.read?' read':''));row.append(el('strong','',a.title),el('div','',a.body),el('small','',new Date(a.time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+(a.read?' · 읽음':'')));$('alerts').append(row);}
  if(!state.alerts.length)$('alerts').append(el('div','compact-empty','새 할 일이 발견되면 여기에서 모아 알려드릴게요.'));
}
function render() {renderTasks();renderConnections();renderMeetings();renderAlerts();}
async function saveMeetings(){if(desktop)try{await desktop.saveMeetings(state.meetings);}catch{toast('데스크톱 회의 알림 저장에 실패했어요.');}}
function applySync(data, quiet=false) {
  const newTasks=[];let calendarChanged=false;
  state.providers=data.results.map(({source,status,message})=>({source,status,message}));state.checkedAt=data.checkedAt;
  for(const provider of data.results){
    if(provider.status!=='connected')continue;
    if(provider.source==='calendar') {state.meetings=state.meetings.filter(m=>m.source!=='calendar'||m.demo).concat(provider.items);calendarChanged=true;continue;}
    for(const t of provider.items){
      const existing=state.tasks.find(x=>x.id===t.id);
      if(existing){Object.assign(existing,t,{done:existing.done});continue;}
      if(state.dismissed.includes(t.id)||state.seen.includes(t.id))continue;
      state.tasks.push({...t,done:false});state.seen.push(t.id);newTasks.push(t);
    }
  }
  if(newTasks.length){const p1=newTasks.filter(t=>t.priority===1).length;const groups=['slack','gmail','jira'].map(s=>{const n=newTasks.filter(t=>t.source===s).length;return n?`${names[s]} ${n}개`:null;}).filter(Boolean).join(' · ');const body=`${groups}. P1 ${p1}개, P2 ${newTasks.length-p1}개를 모았어요.`;addAlert(`새 할 일 ${newTasks.length}개를 발견했어요`,body);state.alerts[0].count=newTasks.length;notify('피카! 새로운 할 일이 도착했어요',body);}
  if(calendarChanged)saveMeetings();save();
  if(!quiet)toast(newTasks.length?`새 할 일 ${newTasks.length}개를 모았어요.`:data.results.some(p=>p.status==='connected')?'최근 업무를 확인했어요. 새로운 할 일은 없어요.':'아직 연결된 서비스가 없어요. 연결 안내를 확인해 주세요.');
}
async function sync(quiet=false){if(syncing)return;syncing=true;syncError=false;renderConnections();try{const response=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw new Error('sync');applySync(await response.json(),quiet);}catch{syncError=true;if(!quiet)toast('수집 서버에 연결하지 못했어요. 앱 실행 상태를 확인해 주세요.');$('sync-status').textContent='수집 서버 연결 실패';}finally{syncing=false;renderConnections();}}
function remind(m){facePreview=null;const key=`${m.id}:${m.start}`;const minutes=Math.max(1,Math.ceil((Date.parse(m.start)-Date.now())/60000));const body=`${m.title} · ${minutes}분 후 시작해요.${validLink(m.url)?' 참가 버튼으로 바로 들어가세요.':''}`;addAlert('곧 회의가 시작돼요 ⚡',body,'meeting',key);forcedEmotion={mood:'determined',title:'피카! 회의 시간이 다가와요.',body,until:Date.now()+600000};save();toast(body);}
function checkReminders(){if(desktop)return;for(const m of state.meetings){const start=Date.parse(m.start),key=`${m.id}:${m.start}`;if(Date.now()>=start-600000&&Date.now()<start&&!state.reminded.includes(key)){state.reminded.push(key);remind(m);notify('⚡ 곧 회의가 시작돼요',m.title);}}}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));renderTasks();});
$('open').onclick=()=>{$('dialog').showModal();$('title').focus();};$('cancel').onclick=()=>{$('dialog').close();$('form').reset();};$('title').oninput=()=>$('title').setCustomValidity('');
$('form').onsubmit=e=>{e.preventDefault();const title=$('title').value.trim();if(!title){$('title').setCustomValidity('할 일을 입력해 주세요.');$('title').reportValidity();return;}state.tasks.push({id:crypto.randomUUID(),title,priority:Number($('priority').value),done:false,source:'manual'});save();$('dialog').close();$('form').reset();toast('새로운 한 걸음을 추가했어요.');};
$('clear').onclick=()=>{const done=state.tasks.filter(t=>t.done);if(!done.length){toast('아직 완료한 일이 없어요.');return;}state.dismissed.push(...done.filter(t=>t.source!=='manual').map(t=>t.id));state.tasks=state.tasks.filter(t=>!t.done);forcedEmotion=null;save();toast('완료한 일을 정리했어요.');};
$('sync').onclick=()=>sync();$('settings').onclick=async()=>{$('settings-dialog').showModal();if(desktop){$('credentials-form').hidden=false;try{const status=await desktop.credentialStatus();$('credentials-status').textContent=status.secure?`안전한 저장소 사용 가능 · 저장된 연결 ${status.configured.length}개`:'이 기기에서 안전한 저장소를 사용할 수 없어요. 실행 환경 변수를 사용해 주세요.';}catch{$('credentials-status').textContent='연결 저장소를 확인하지 못했어요.';}}};$('settings-close').onclick=()=>{$('credentials-form').reset();$('settings-dialog').close();};$('settings-dialog').addEventListener('close',()=>$('credentials-form').reset());
$('read-all').onclick=()=>{state.alerts.forEach(a=>a.read=true);forcedEmotion=null;save();};
$('enable-notifications').onclick=async()=>{if(desktop){await desktop.notify('⚡ 피카 데이 알림 테스트','회의 시작 10분 전 이렇게 알려드릴게요.');toast('알림이 보이지 않으면 기기의 알림 설정을 확인해 주세요.');}else if('Notification' in window){const permission=await Notification.requestPermission();toast(permission==='granted'?'회의 알림을 켰어요.':'기기의 알림 권한 설정을 확인해 주세요.');renderMeetings();}else toast('이 브라우저는 시스템 알림을 지원하지 않아요. 앱 안에서 알려드릴게요.');};
$('add-meeting').onclick=()=>{$('meeting-dialog').showModal();$('meeting-title').focus();const d=new Date(Date.now()+3600000);$('meeting-start').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};$('meeting-cancel').onclick=()=>{$('meeting-dialog').close();$('meeting-form').reset();};
$('meeting-url').oninput=()=>$('meeting-url').setCustomValidity('');$('meeting-start').oninput=()=>$('meeting-start').setCustomValidity('');$('meeting-title').oninput=()=>$('meeting-title').setCustomValidity('');
$('meeting-form').onsubmit=e=>{e.preventDefault();const title=$('meeting-title').value.trim(),start=new Date($('meeting-start').value),url=$('meeting-url').value.trim();if(!title){$('meeting-title').setCustomValidity('회의 이름을 입력해 주세요.');$('meeting-title').reportValidity();return;}if(!Number.isFinite(start.getTime())||start<=new Date()){$('meeting-start').setCustomValidity('미래의 시작 시간을 선택해 주세요.');$('meeting-start').reportValidity();return;}if(url&&!validLink(url)){$('meeting-url').setCustomValidity('HTTPS 참가 링크를 입력해 주세요.');$('meeting-url').reportValidity();return;}state.meetings.push({id:crypto.randomUUID(),title,start:start.toISOString(),url:url||null,source:'manual'});saveMeetings();save();$('meeting-dialog').close();$('meeting-form').reset();toast('회의를 등록했어요. 시작 10분 전에 알려드릴게요.');checkReminders();};
$('demo').onclick=()=>{if(state.tasks.some(t=>t.demo)){state.tasks=state.tasks.filter(t=>!t.demo);state.meetings=state.meetings.filter(m=>!m.demo);state.alerts=state.alerts.filter(a=>a.type!=='demo');forcedEmotion=null;$('demo').textContent='예시 체험';saveMeetings();save();return;}
 const sample=[['하늘님 질문 답장 — 결제 화면 오류','slack',1],['분기 셀프 리뷰 제출 (오늘 마감)','gmail',1],['HARU-142 오프라인 동기화 충돌 수정','jira',1],['PR #128 리뷰 코멘트 반영','slack',2],['주간회의 액션 아이템 정리','slack',2],['디자인 QA 피드백 정리','gmail',2],['기획 문서 검토하기','jira',2],['팀에 진행 상황 공유하기','slack',2]];
 state.tasks.push(...sample.map(([title,source,priority],i)=>({id:'demo:'+i,title,source,priority,done:i>=4,demo:true})));
 state.meetings.push({id:'demo:meeting',title:'주간 팀 미팅',start:new Date(Date.now()+11*60000).toISOString(),url:null,source:'manual',demo:true});addAlert('예시 · 새 할 일 요약','Slack 2개, Gmail 1개가 새로 생겼어요. P1 2개, P2 1개를 확인해 보세요.','demo');$('demo').textContent='예시 지우기';saveMeetings();save();toast('예시 데이터로 기능을 체험할 수 있어요.');};
$('date').textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date())+' · MY LITTLE DAILY COMPANION';
if(desktop){desktop.onReminder(remind);desktop.onSync(data=>applySync(data,true));desktop.loadMeetings().then(meetings=>{if(meetings.length){state.meetings=meetings;save();}else saveMeetings();}).catch(()=>toast('저장된 회의를 불러오지 못했어요.'));}
render();if(state.tasks.some(t=>t.demo))$('demo').textContent='예시 지우기';if(!storageOkay)toast('기기 저장을 사용할 수 없어요.');sync(true);checkReminders();
setInterval(()=>{checkReminders();renderMeetings();if(forcedEmotion&&Date.now()>=forcedEmotion.until)forcedEmotion=null;renderTasks();},15000);
if(!desktop)setInterval(()=>{if(state.providers.some(p=>p.status==='connected'))sync(true);},300000);

$('credentials-form').onsubmit=async e=>{e.preventDefault();if(!desktop)return;const result=await desktop.saveCredentials({SLACK_USER_TOKEN:$('slack-token').value,GMAIL_ACCESS_TOKEN:$('google-token').value,JIRA_ACCESS_TOKEN:$('jira-token').value,JIRA_CLOUD_ID:$('jira-cloud').value});$('credentials-form').reset();if(result.ok){$('credentials-status').textContent=`저장된 연결 ${result.configured.length}개`;toast('인증 정보를 안전하게 저장했어요. 실제 연결을 확인합니다.');sync();}else toast(result.error||'인증 정보를 저장하지 못했어요.');};$('credentials-clear').onclick=async()=>{if(!desktop)return;await desktop.clearCredentials();$('credentials-form').reset();$('credentials-status').textContent='앱에 저장한 인증 정보를 지웠어요. 실행 환경의 연결 설정은 유지됩니다.';toast('앱에 저장한 연결을 지웠어요.');sync();};

for(const choice of PikaFaces.choices){const button=el('button','face-choice',choice.label);button.dataset.face=choice.id;button.setAttribute('aria-pressed','false');button.onclick=()=>{facePreview=choice.id;renderTasks();};$('face-options').append(button);}
$('face-auto').onclick=()=>{facePreview=null;renderTasks();};
$('focus-toggle').onclick=()=>{facePreview=null;forcedEmotion=null;restUntil=0;focusUntil=Date.now()<focusUntil?0:Date.now()+25*60000;renderTasks();};
$('rest-toggle').onclick=()=>{facePreview=null;forcedEmotion=null;focusUntil=0;restUntil=Date.now()<restUntil?0:Date.now()+5*60000;renderTasks();};
document.addEventListener('pointerdown',()=>{lastInteraction=Date.now();},{passive:true});document.addEventListener('keydown',()=>{lastInteraction=Date.now();},{passive:true});


$('choose-picture').onclick=()=>$('picture-file').click();
function selectPictureMode(mode){pictureMode=mode;facePreview=null;try{localStorage.setItem('pika-day-picture-mode',mode);}catch{}renderTasks();}
$('show-picture').onclick=()=>selectPictureMode('picture');$('show-expressions').onclick=()=>selectPictureMode('expressions');
$('remove-picture').onclick=()=>{personalPicture=null;pictureMode='expressions';try{localStorage.removeItem('pika-day-picture-v1');localStorage.removeItem('pika-day-picture-mode');}catch{}$('personal-picture').removeAttribute('src');$('picture-file').value='';renderTasks();toast('기본 캡틴 피카츄로 돌아왔어요.');};
$('picture-file').onchange=async()=>{
 const file=$('picture-file').files[0];if(!file)return;
 try{
  if(file.size>3*1024*1024)throw new Error('3MB 이하의 PNG, JPG 또는 WebP 이미지를 선택해 주세요.');
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const png=[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!png&&!jpeg&&!webp)throw new Error('PNG, JPG 또는 WebP 이미지 파일을 선택해 주세요.');
  const mime=png?'image/png':jpeg?'image/jpeg':'image/webp';
  const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('이미지 파일을 읽지 못했어요.'));reader.readAsDataURL(new Blob([file],{type:mime}));});
  const image=new Image();image.src=src;try{await image.decode();}catch{throw new Error('이 이미지를 표시할 수 없어요. 다른 PNG 파일을 선택해 주세요.');}
  const next={src,name:file.name.slice(0,120)};
  try{localStorage.setItem('pika-day-picture-v1',JSON.stringify(next));localStorage.setItem('pika-day-picture-mode','picture');}catch{throw new Error('이미지를 저장할 공간이 부족해요. 더 작은 파일을 선택해 주세요.');}
  personalPicture=next;pictureMode='picture';facePreview=null;renderTasks();toast('원본 이미지로 메인 캐릭터를 바꿨어요.');
 }catch(error){toast(error.message);}finally{$('picture-file').value='';}
};
$('personal-picture').onerror=()=>{pictureMode='expressions';renderTasks();toast('저장된 이미지를 표시하지 못했어요. 다시 선택해 주세요.');};
