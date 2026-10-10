const test = require('node:test');
const assert = require('node:assert/strict');
const { collect, priority, safeUrl } = require('../integrations.cjs');
const { dueReminders, validateMeetings } = require('../reminders.cjs');
test('missing credentials never produce fabricated tasks', async()=>{
 const result = await collect({},()=>{throw new Error('must not request');});
 assert.equal(result.results.length,4);
 assert.ok(result.results.every(p=>p.status==='disconnected'&&p.items.length===0));
});
test('collects actionable Slack and Gmail, assigned Jira, timed calendar events', async()=>{
 const env={SLACK_USER_TOKEN:'test-slack',GMAIL_ACCESS_TOKEN:'test-google',JIRA_ACCESS_TOKEN:'test-jira',JIRA_CLOUD_ID:'cloud-test'};
 const request=async(url,token)=>{
  const u=new URL(url);assert.ok(token.startsWith('test-'));
  if(u.hostname==='slack.com')return {ok:true,messages:{matches:[{text:'긴급 검토 부탁드립니다',ts:'1',channel:{id:'C1'},permalink:'https://slack.com/a'},{text:'안녕하세요',ts:'2',channel:{id:'C1'}}]}};
  if(u.hostname==='gmail.googleapis.com'&&u.pathname.endsWith('/messages'))return {messages:[{id:'m1'},{id:'m2'}]};
  if(u.pathname.endsWith('/m1'))return {id:'m1',payload:{headers:[{name:'Subject',value:'오늘까지 리뷰 제출 요청'}]},snippet:'검토'};
  if(u.pathname.endsWith('/m2'))return {id:'m2',payload:{headers:[{name:'Subject',value:'주말 인사'}]},snippet:'반가워요'};
  if(u.hostname==='api.atlassian.com')return {issues:[{id:'j1',key:'PIKA-1',fields:{summary:'동기화 수정',priority:{name:'High'}}}]};
  if(u.hostname==='www.googleapis.com')return {items:[{id:'c1',summary:'팀 미팅',start:{dateTime:'2026-10-11T10:00:00+09:00'},hangoutLink:'https://meet.google.com/test'},{id:'c2',start:{date:'2026-10-11'}},{id:'c3',start:{dateTime:'2026-10-11T11:00:00+09:00'},attendees:[{self:true,responseStatus:'declined'}]}]};
  throw new Error('unexpected request');
 };
 const result=await collect(env,request);
 assert.ok(result.results.every(p=>p.status==='connected'));
 assert.equal(result.results[0].items.length,1);assert.equal(result.results[0].items[0].priority,1);
 assert.equal(result.results[1].items.length,1);assert.equal(result.results[1].items[0].candidate,true);
 assert.equal(result.results[2].items[0].priority,1);
 assert.equal(result.results[3].items.length,1);assert.equal(result.results[3].items[0].url,'https://meet.google.com/test');
});
test('one service failure preserves results from successful services',async()=>{
 const result=await collect({SLACK_USER_TOKEN:'x',GMAIL_ACCESS_TOKEN:'x'},async(url)=>{
  if(url.includes('slack.com')){const e=new Error('secret must never appear');e.status=401;throw e;}
  if(url.includes('calendar')){const e=new Error('scope');e.status=403;throw e;}
  return {messages:[]};
 });
 assert.equal(result.results[0].status,'error');assert.ok(!JSON.stringify(result).includes('secret must never appear'));
 assert.equal(result.results[1].status,'connected');assert.equal(result.results[3].status,'error');
});
test('reminder triggers at 10 minutes, once per event start, excludes past meetings',()=>{
 const start=Date.parse('2026-10-11T01:00:00Z'),meeting={id:'one',title:'회의',start:new Date(start).toISOString()};
 assert.equal(dueReminders([meeting],new Set(),start-600001).length,0);
 assert.equal(dueReminders([meeting],new Set(),start-600000).length,1);
 assert.equal(dueReminders([meeting],new Set(['one:'+meeting.start]),start-1000).length,0);
 assert.equal(dueReminders([meeting],new Set(),start).length,0);
 assert.equal(dueReminders([{...meeting,start:new Date(start+60000).toISOString()}],new Set(['one:'+meeting.start]),start).length,1);
});
test('non-HTTPS links cannot become meeting launch targets',()=>{
 assert.equal(safeUrl('javascript:alert(1)'),null);assert.equal(safeUrl('file:///etc/passwd'),null);
 assert.equal(validateMeetings([{id:'x',title:'x',start:new Date().toISOString(),url:'javascript:alert(1)'}])[0].url,null);
 assert.equal(priority('평범한 검토'),2);assert.equal(priority('ASAP review'),1);
});
