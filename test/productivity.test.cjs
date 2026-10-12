const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createProductivity,quietNow}=require('../productivity.cjs');const {todayTask,localDay}=require('../day.js');
test('quiet hours include midnight and boundary times, without disabling disabled schedules',()=>{
 const s={quietEnabled:true,quietStart:'21:00',quietEnd:'09:00'};assert.equal(quietNow(s,new Date(2026,9,10,23)),true);assert.equal(quietNow(s,new Date(2026,9,11,8,59)),true);assert.equal(quietNow(s,new Date(2026,9,11,9)),false);assert.equal(quietNow({...s,quietEnabled:false},new Date(2026,9,10,23)),false);
});
test('focus records actual elapsed time, completes at 25 minutes, and snoozes persist exactly ten minutes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pika-focus-'));try{let now=new Date(2026,9,10,12).getTime();const p=createProductivity(path.join(dir,'data.json'),()=>now);p.focus(true);now+=5*60000;p.focus(false);assert.equal(p.summary().minutes,5);assert.equal(p.summary().completed,0);p.focus(true);now+=25*60000;assert.ok(p.tick());assert.equal(p.summary().minutes,30);assert.equal(p.summary().completed,1);
 p.snooze({title:'meeting'});now+=599999;assert.equal(p.due().length,0);now++;assert.equal(p.due().length,1);assert.equal(p.due().length,0);const restored=createProductivity(path.join(dir,'data.json'),()=>now);assert.equal(restored.summary().minutes,30);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('today filter uses due and scheduled dates, explicit tags, and local calendar day',()=>{
 assert.equal(todayTask({source:'obsidian',due:'2026-10-09'},'2026-10-10'),true);assert.equal(todayTask({source:'obsidian',due:'2026-10-11'},'2026-10-10'),false);assert.equal(todayTask({source:'obsidian',todayTag:true},'2026-10-10'),true);assert.equal(todayTask({source:'obsidian'},'2026-10-10'),false);assert.equal(localDay(new Date('2026-10-09T16:00:00Z'),'Asia/Seoul'),'2026-10-10');
});
test('focus crossing midnight allocates elapsed minutes to each local day',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pika-midnight-'));try{let now=new Date(2026,9,10,23,50).getTime();const p=createProductivity(path.join(dir,'data.json'),()=>now);p.focus(true);now+=25*60000;p.tick();assert.equal(p.summary('2026-10-10').minutes,10);assert.equal(p.summary('2026-10-11').minutes,15);assert.equal(p.summary('2026-10-11').completed,1);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('legacy priority mode migrates to immediate alerts and retains pet locks',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pika-mode-'));try{const file=path.join(dir,'p.json');fs.writeFileSync(file,JSON.stringify({settings:{notificationMode:'priority',petScale:1.25,sizeLocked:true,positionLocked:true},digest:[{count:2}]}));const p=createProductivity(file);assert.equal(p.settings().notificationMode,'all');assert.equal(p.route(1),'immediate');assert.equal(p.route(2),'immediate');assert.equal(p.route(2,true),'immediate');assert.equal(p.settings().positionLocked,true);assert.throws(()=>p.saveSettings({...p.settings(),petScale:1.5}));p.saveSettings({...p.settings(),notificationMode:'meetings'});assert.equal(p.route(1),'silent');assert.equal(p.route(2,true),'immediate');p.saveSettings({...p.settings(),quietEnabled:true,quietStart:'00:00',quietEnd:'00:00'});assert.equal(p.route(1,true),'silent');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
