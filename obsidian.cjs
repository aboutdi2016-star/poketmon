const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const idFor=(root,file,title,occurrence)=>'obsidian:'+crypto.createHash('sha256').update(root+'\0'+file+'\0'+title+'\0'+occurrence).digest('hex').slice(0,40);
function parseTasks(text,{root,file}){
 let fence=null;const counts=new Map(),tasks=[];
 for(const [index,line] of text.split(/\r?\n/).entries()){
  const delimiter=line.match(/^\s{0,3}(`{3,}|~{3,})/);if(delimiter){if(!fence)fence=delimiter[1];else if(delimiter[1][0]===fence[0]&&delimiter[1].length>=fence.length)fence=null;continue;}if(fence)continue;
  const match=line.match(/^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+?)\s*$/);if(!match)continue;
  const text=match[2],occurrence=counts.get(text)||0;counts.set(text,occurrence+1);
  tasks.push({id:idFor(root,file,text,occurrence),title:text.slice(0,140),source:'obsidian',priority:/#p1\b|#urgent\b|🔺|⏫|긴급|오늘까지|asap/i.test(text)?1:2,note:file,line:index+1,due:(text.match(/📅\s*(\d{4}-\d{2}-\d{2})|\bdue::\s*(\d{4}-\d{2}-\d{2})/)||[]).slice(1).find(Boolean)||null,scheduled:(text.match(/⏳\s*(\d{4}-\d{2}-\d{2})/)||[])[1]||null,todayTag:/#(?:today|오늘)\b/i.test(text)||text.includes('#오늘'),done:match[1].toLowerCase()==='x',candidate:false});
 }
 return tasks;
}
function createObsidian(configFile){
 let root=null;try{const config=JSON.parse(require('node:fs').readFileSync(configFile,'utf8'));if(typeof config.root==='string')root=config.root;}catch{}
 async function validate(folder){const actual=await fs.realpath(folder);if(!(await fs.stat(actual)).isDirectory()||!(await fs.stat(path.join(actual,'.obsidian'))).isDirectory())throw new Error('옵시디언 보관함 폴더를 선택해 주세요. (.obsidian 폴더가 있는 위치)');return actual;}
 function status(){return {configured:!!root,name:root?path.basename(root):null,path:root};}
 async function choose(folder){const actual=await validate(folder);await fs.writeFile(configFile,JSON.stringify({root:actual}),{mode:0o600});root=actual;return status();}
 async function clear(){await fs.rm(configFile,{force:true});root=null;return status();}
 let noteLinks=new Map(),inFlight;
 async function scan(){
  const selected=root;if(!selected)return {source:'obsidian',status:'disconnected',message:'보관함 폴더를 선택해 주세요.',items:[]};
  try{
   await validate(selected);const files=[],directories=[selected];let inspected=0;
   while(directories.length){const dir=directories.pop();for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    if(++inspected>30000)throw new Error('보관함 항목이 너무 많아요. 더 작은 보관함을 선택해 주세요.');
    if(entry.name.startsWith('.')||entry.name==='node_modules'||(dir===selected&&entry.name==='Pika Day')||entry.isSymbolicLink())continue;
    const full=path.join(dir,entry.name);if(entry.isDirectory())directories.push(full);else if(entry.isFile()&&/\.md$/i.test(entry.name))files.push(full);
    if(files.length>5000)throw new Error('최대 5,000개 Markdown 노트를 읽을 수 있어요.');
   }}
   files.sort();const all=[];
   for(let offset=0;offset<files.length;offset+=16){const batch=await Promise.all(files.slice(offset,offset+16).map(async full=>{
    const stat=await fs.lstat(full);if(!stat.isFile()||stat.isSymbolicLink())return [];
    const relative=path.relative(selected,full).split(path.sep).join('/');
    const actual=await fs.realpath(full);const rel=path.relative(selected,actual);if(rel.startsWith('..'+path.sep)||path.isAbsolute(rel))return [];
    if(stat.size>2*1024*1024)throw new Error('2MB가 넘는 Markdown 노트가 있어요. 보관함 크기를 확인해 주세요.');
    return parseTasks(await fs.readFile(actual,'utf8'),{root:selected,file:relative});
   }));all.push(...batch.flat());if(all.length>5000)throw new Error('최대 5,000개 체크리스트를 읽을 수 있어요.');}
   if(root!==selected)return {source:'obsidian',status:'disconnected',message:'보관함 연결이 변경되었어요. 다시 수집해 주세요.',items:[]};
   noteLinks=new Map(all.map(t=>[t.id,t.note]));
   return {source:'obsidian',status:'connected',message:`${path.basename(selected)} · ${files.length}개 노트 확인`,items:all.filter(t=>!t.done),presentIds:all.map(t=>t.id),completedIds:all.filter(t=>t.done).map(t=>t.id)};
  }catch(error){return {source:'obsidian',status:'error',message:error.code?'보관함을 읽지 못했어요. 폴더 위치와 접근 권한을 확인해 주세요.':error.message,items:[]};}
 }
 return {status,choose,clear,collect(){if(!inFlight)inFlight=scan().finally(()=>{inFlight=null;});return inFlight;},async saveReport(day,body){if(!root)throw new Error('먼저 옵시디언 보관함을 연결해 주세요.');if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('요약 날짜가 올바르지 않아요.');const folder=path.join(root,'Pika Day');await fs.mkdir(folder,{recursive:true});const actual=await fs.realpath(folder),relative=path.relative(root,actual);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('요약 폴더가 보관함 밖을 가리키고 있어요.');const file=path.join(actual,day+'.md');try{if((await fs.lstat(file)).isSymbolicLink())throw new Error('요약 파일이 외부 파일을 가리키고 있어요.');}catch(e){if(e.code!=='ENOENT')throw e;}let previous='';try{previous=await fs.readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}const section='<!-- pika-day-summary:start -->\n'+body+'\n<!-- pika-day-summary:end -->';const managed=/<!-- pika-day-summary:start -->[\s\S]*?<!-- pika-day-summary:end -->/;const next=managed.test(previous)?previous.replace(managed,()=>section):previous+(previous?'\n\n':'')+section+'\n';await fs.writeFile(file,next,'utf8');return {file:'Pika Day/'+day+'.md',url:'obsidian://open?'+new URLSearchParams({vault:path.basename(root),file:'Pika Day/'+day})};},noteUrl(id){const file=noteLinks.get(id);if(!root||!file)return null;return 'obsidian://open?'+new URLSearchParams({vault:path.basename(root),file:file.replace(/\.md$/i,'')});}};
}
module.exports={parseTasks,createObsidian};
