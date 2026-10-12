const images = new Set(['captain', 'sleepy', 'tired', 'surprised', 'angry', 'focused', 'goofy', 'happy'].map(n => `/assets/characters/${n}.png`));
const cleanText = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
function cleanSnapshot(input) {
  const tasks = (Array.isArray(input?.tasks) ? input.tasks : []).filter(t => typeof t?.id === 'string' && typeof t.title === 'string').slice(0, 6000).map(t => ({id:t.id.slice(0,200),title:t.title.slice(0,140),done:!!t.done,priority:t.priority===1?1:2,source:cleanText(t.source,30),demo:!!t.demo,due:cleanText(t.due,10),scheduled:cleanText(t.scheduled,10),todayTag:!!t.todayTag,coreDay:cleanText(t.coreDay,10),completedAt:Number.isFinite(Date.parse(t.completedAt))?t.completedAt:null}));
  const meetings = (Array.isArray(input?.meetings) ? input.meetings : []).filter(m => typeof m?.id==='string' && Number.isFinite(Date.parse(m.start))).slice(0,200).map(m=>({id:m.id.slice(0,200),title:cleanText(m.title,140),start:m.start,url:typeof m.url==='string'&&/^https:\/\//.test(m.url)?m.url:null,demo:!!m.demo}));
  const image = images.has(input?.image) || (typeof input?.image==='string' && input.image.length<=5*1024*1024 && /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(input.image)) ? input.image : '/assets/characters/captain.png';
  return {tasks,meetings,image,greeting:cleanText(input?.greeting,200),message:cleanText(input?.message,400),mood:cleanText(input?.mood,30),checkedAt:cleanText(input?.checkedAt,50)};
}
function completionCheer(previous, next) {
  if (!previous || !next.tasks.length) return null;
  // Compare the same tasks; importing or deleting a task never creates a cheer.
  const old = new Map(previous.tasks.map(t=>[t.id,t]));
  if (!next.tasks.some(t=>t.done && old.has(t.id) && !old.get(t.id).done)) return null;
  const done=next.tasks.filter(t=>t.done).length,total=next.tasks.length;
  return done===total?`모두 해냈어요! (${done}/${total})`:done>=total/2?`벌써 절반 했어요! (${done}/${total})`:`한 걸음 더 해냈어요! (${done}/${total})`;
}
function clampBounds(bounds, area) {
  return {...bounds,x:Math.round(Math.max(area.x,Math.min(bounds.x,area.x+area.width-bounds.width))),y:Math.round(Math.max(area.y,Math.min(bounds.y,area.y+area.height-bounds.height)))};
}
function popoverBounds(pet, area, width=360, height=440) {
  const left=pet.x-width-12;
  return clampBounds({x:left>=area.x?left:pet.x+pet.width+12,y:pet.y+pet.height-height,width,height},area);
}
module.exports={cleanSnapshot,completionCheer,clampBounds,popoverBounds};
