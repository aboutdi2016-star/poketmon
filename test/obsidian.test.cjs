const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {parseTasks,createObsidian}=require('../obsidian.cjs');
test('Markdown checklists exclude code blocks, preserve duplicates, and IDs survive inserted lines',()=>{
 const ctx={root:'/vault',file:'Daily/오늘.md'},text='- [ ] 첫 할 일 #p1\n- [x] 완료\n```md\n- [ ] 예시\n```\n- [ ] 첫 할 일 #p1\n1. [ ] 다른 일\n- [-] 취소';
 const tasks=parseTasks(text,ctx);assert.equal(tasks.length,4);assert.equal(tasks[0].priority,1);assert.equal(tasks[1].done,true);assert.notEqual(tasks[0].id,tasks[2].id);
 assert.deepEqual(parseTasks('제목\n\n'+text,ctx).map(t=>t.id),tasks.map(t=>t.id));
});
test('local vault imports only pending tasks, opens registered notes, reflects edits and completion, and never edits notes',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'pika-obsidian-'));try{
 const vault=path.join(folder,'Vault');await fs.mkdir(path.join(vault,'.obsidian'),{recursive:true});await fs.mkdir(path.join(vault,'.git'));await fs.writeFile(path.join(vault,'.git','hidden.md'),'- [ ] hidden');
 const note=path.join(vault,'오늘 & 계획.md'),content='- [ ] 검토 #p1\n- [x] 이미 완료\n- [ ] 두 번째 할 일';await fs.writeFile(note,content);
 const adapter=createObsidian(path.join(folder,'config.json'));assert.equal((await adapter.collect()).status,'disconnected');await adapter.choose(vault);
 let result=await adapter.collect();assert.equal(result.items.length,2);assert.equal(result.completedIds.length,1);assert.equal(result.presentIds.length,3);
 const id=result.items[0].id,url=new URL(adapter.noteUrl(id));assert.equal(url.protocol,'obsidian:');assert.equal(url.searchParams.get('vault'),'Vault');assert.equal(url.searchParams.get('file'),'오늘 & 계획');assert.equal(adapter.noteUrl('forged'),null);
 assert.equal(await fs.readFile(note,'utf8'),content);
 await fs.writeFile(note,'새 제목\n'+content.replace('[ ] 검토','[x] 검토'));result=await adapter.collect();assert.equal(result.items.length,1);assert.ok(result.completedIds.includes(id));
 const restored=createObsidian(path.join(folder,'config.json'));assert.equal(restored.status().configured,true);await restored.clear();assert.equal((await restored.collect()).status,'disconnected');
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});
test('invalid vault selection preserves existing connection, and symlink notes are not read',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'pika-obsidian-'));try{
 const vault=path.join(folder,'Vault');await fs.mkdir(path.join(vault,'.obsidian'),{recursive:true});await fs.writeFile(path.join(folder,'outside.md'),'- [ ] outside');
 const adapter=createObsidian(path.join(folder,'config.json'));await adapter.choose(vault);await assert.rejects(adapter.choose(folder));assert.equal(adapter.status().name,'Vault');
 if(process.platform!=='win32'){await fs.symlink(path.join(folder,'outside.md'),path.join(vault,'linked.md'));assert.equal((await adapter.collect()).items.length,0);}
 await fs.rm(vault,{recursive:true});assert.equal((await adapter.collect()).status,'error');
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});
test('daily report preserves user text, replaces only its managed section, and stays out of task import',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'pika-summary-'));try{await fs.mkdir(path.join(folder,'.obsidian'));const adapter=createObsidian(path.join(os.tmpdir(),'pika-summary-'+Date.now()+'.json'));await adapter.choose(folder);await fs.mkdir(path.join(folder,'Pika Day'));const file=path.join(folder,'Pika Day','2026-10-10.md');await fs.writeFile(file,'내 메모');await adapter.saveReport('2026-10-10','- [ ] 내일 할 일');await adapter.saveReport('2026-10-10','- [x] 마친 일');const text=await fs.readFile(file,'utf8');assert.ok(text.startsWith('내 메모'));assert.ok(text.includes('마친 일'));assert.ok(!text.includes('내일 할 일'));assert.equal((await adapter.collect()).items.length,0);await adapter.clear();}finally{await fs.rm(folder,{recursive:true,force:true});}
});
test('quick notes preserve exact text, use unique files, exclude checklists from import and reject symlink destinations',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pika-notes-'));try{const root=path.join(dir,'vault');await fs.mkdir(path.join(root,'.obsidian'),{recursive:true});const adapter=createObsidian(path.join(dir,'config.json'));await adapter.choose(root);const text='메모 원문\n- [ ] 메모 속 체크박스';const a=await adapter.saveQuickNote(text),b=await adapter.saveQuickNote(text);assert.notEqual(a.file,b.file);assert.equal(await fs.readFile(path.join(root,a.file),'utf8'),text+'\n');assert.equal((await adapter.collect()).items.length,0);await assert.rejects(adapter.saveQuickNote('   '));if(process.platform!=='win32'){await fs.rm(path.join(root,'Pika Quick Notes'),{recursive:true});await fs.symlink(dir,path.join(root,'Pika Quick Notes'),'dir');await assert.rejects(adapter.saveQuickNote('외부 저장 금지'));}}finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('Obsidian links encode spaces as percent20, preserving literal plus signs and Korean note names',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pika-uri-'));try{const root=path.join(dir,'Obsidian Vault + 한글');await fs.mkdir(path.join(root,'.obsidian'),{recursive:true});await fs.writeFile(path.join(root,'오늘 할 일 + 메모.md'),'- [ ] 확인');const adapter=createObsidian(path.join(dir,'config.json'));await adapter.choose(root);const item=(await adapter.collect()).items[0],url=adapter.noteUrl(item.id);assert.ok(url.includes('Obsidian%20Vault%20%2B%20'));assert.ok(!url.includes('+'));assert.equal(new URL(url).searchParams.get('file'),'오늘 할 일 + 메모');const report=await adapter.saveReport('2026-10-12','내용');assert.ok(report.url.includes('Pika%20Day'));assert.ok(!report.url.includes('+'));}finally{await fs.rm(dir,{recursive:true,force:true});}});
