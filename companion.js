'use strict';
const bridge=window.pikaCompanion,$=id=>document.getElementById(id);
const names={manual:'나의 할 일',slack:'Slack',gmail:'Gmail',jira:'Jira',obsidian:'Obsidian'};
let snapshot={tasks:[],meetings:[]},meetingId=null;
function element(tag,cls,text){const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e;}
function render(state){
 if(!state)return;const oldDone=snapshot.tasks.filter(t=>t.done).length;snapshot=state;const done=state.tasks.filter(t=>t.done).length,total=state.tasks.length,p1=state.tasks.filter(t=>!t.done&&t.priority===1).length;
 if(done>oldDone)$('feedback').textContent=state.greeting;
 $('counts').textContent=`남은 일 ${total-done}개`;$('progress').textContent=`${done}/${total} 완료${total&&done>=total/2?' · 잘하고 있어요!':''}`;$('fill').style.width=(total?done/total*100:0)+'%';
 $('tasks').replaceChildren();for(const t of state.tasks.filter(t=>$('day-filter').value==='all'||($('day-filter').value==='core'?t.coreDay===PikaDayTools.localDay():PikaDayTools.todayTask(t))).sort((a,b)=>Number(a.done)-Number(b.done))){
  const row=element('div','task'+(t.done?' done':'')),check=element('input');check.type='checkbox';check.checked=t.done;check.setAttribute('aria-label',t.title+' 완료');
  check.onchange=()=>{check.disabled=true;bridge.command({type:'toggle-task',id:t.id,done:check.checked});};
  const label=element('div','task-label',t.title);label.onclick=()=>check.click();label.append(element('span','source',(t.demo?'예시 · ':'')+(names[t.source]||'나의 할 일')));if(t.source==='obsidian'){const open=element('button','quiet','노트 ↗');open.onclick=e=>{e.stopPropagation();bridge.openObsidian(t.id);};label.append(open);}const star=element('button','quiet',t.coreDay===PikaDayTools.localDay()?'★':'☆');star.setAttribute('aria-label',t.title+' 핵심 선택');star.onclick=()=>{if(t.coreDay!==PikaDayTools.localDay()&&snapshot.tasks.filter(x=>x.coreDay===PikaDayTools.localDay()).length>=3){$('feedback').textContent='핵심은 최대 3개예요. 선택을 먼저 해제해 주세요.';return;}bridge.command({type:'toggle-core',id:t.id});};row.append(check,label,star);$('tasks').append(row);
 }
 if(!$('tasks').children.length)$('tasks').append(element('div','empty','오늘 할 일 하나부터 적어봐요.\n서비스 연결은 설정에서 할 수 있어요.'));
 $('meetings').replaceChildren();for(const m of state.meetings.filter(m=>Date.parse(m.start)>Date.now()-600000).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))){
  const row=element('div','meeting'),info=element('div','',m.title);info.append(element('span','source',(m.demo?'예시 · ':'')+new Date(m.start).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})));row.append(info);
  if(m.url){const join=element('button','join','참가 ↗');join.onclick=()=>bridge.join(m.id);row.append(join);}else info.append(element('span','source','참가 링크 없음'));$('meetings').append(row);
 }
 if(!$('meetings').children.length)$('meetings').append(element('div','empty','다가오는 회의가 없어요.'));
}
function popup(data){document.body.classList.toggle('arrow-left',data?.side==='left');const panel=data?.mode==='panel';if(panel){$('quick-note-form').hidden=!data.quickNote;if(data.quickNote)setTimeout(()=>$('quick-note-text').focus(),50);}$('panel').hidden=!panel;$('bubble').hidden=panel;meetingId=data?.meetingId||null;if(!panel){$('bubble-title').textContent=data?.title||'피카!';$('bubble-body').textContent=data?.body||'';$('bubble-join').hidden=!data?.canJoin;}}
for(const id of ['close-panel','close-bubble'])$(id).onclick=()=>bridge.close();
$('bubble-panel').onclick=()=>bridge.panel();$('bubble-join').onclick=()=>bridge.join(meetingId);
$('details').onclick=()=>bridge.dashboard();$('settings').onclick=()=>bridge.dashboard('settings');
$('sync').onclick=()=>{bridge.command({type:'sync'});$('feedback').textContent='최근 업무를 확인하고 있어요…';};
$('tab-tasks').onclick=()=>{$('tasks').hidden=false;$('meetings').hidden=true;$('add-form').hidden=false;$('tab-tasks').classList.add('active');$('tab-meetings').classList.remove('active');};
$('tab-meetings').onclick=()=>{$('tasks').hidden=true;$('meetings').hidden=false;$('add-form').hidden=true;$('tab-meetings').classList.add('active');$('tab-tasks').classList.remove('active');};
$('add-form').onsubmit=e=>{e.preventDefault();const title=$('title').value.trim();if(!title)return;bridge.command({type:'add-task',title,priority:2});$('title').value='';$('feedback').textContent='할 일을 추가했어요.';};
document.addEventListener('keydown',e=>{if(e.key==='Escape')bridge.close();});
bridge?.onState(render);bridge?.onPopup(popup);bridge?.state().then(render);bridge?.popup().then(popup);

$('day-filter').onchange=()=>render(snapshot);
$('bubble-snooze').onclick=()=>bridge.snooze();
$('daily-summary').onclick=async()=>{const result=await bridge.saveSummary();$('feedback').textContent=result.ok?`요약 저장 · ${result.file}`:result.error;};
let focusActive=false;function renderFocus(data){focusActive=!!data.active;$('focus-stats').textContent=`오늘 ${data.minutes}분`;$('focus-start').textContent=focusActive?'집중 마치기':'25분 집중';}
$('focus-start').onclick=()=>bridge.command({type:'focus'});
bridge?.onFocus(renderFocus);bridge?.productivityStatus().then(data=>data?.focus&&renderFocus(data.focus));

$('quick-note').onclick=()=>bridge.quickNote();$('note-cancel').onclick=()=>{$('quick-note-form').hidden=true;};$('quick-note-form').onsubmit=async e=>{e.preventDefault();const result=await bridge.saveQuickNote($('quick-note-text').value);$('feedback').textContent=result.ok?'옵시디언에 메모를 저장했어요.':result.error;if(result.ok){$('quick-note-text').value='';$('quick-note-form').hidden=true;}};
