const test=require('node:test');
const assert=require('node:assert/strict');
const {cleanSnapshot,completionCheer,clampBounds,popoverBounds}=require('../companion.cjs');
test('companion snapshot rejects remote images, invalid tasks, and unsafe meeting links',()=>{
 const result=cleanSnapshot({image:'https://example.com/tracker.png',tasks:[null,{id:'a',title:'Task',priority:9,done:1},{title:'Missing ID'}],meetings:[{id:'a',title:'Meeting',start:'2026-10-10T12:00:00Z',url:'javascript:alert(1)'}]});
 assert.equal(result.image,'/assets/characters/captain.png');assert.equal(result.tasks.length,1);assert.equal(result.tasks[0].priority,2);assert.equal(result.meetings[0].url,null);
 assert.equal(cleanSnapshot({image:'/assets/characters/tired.png'}).image,'/assets/characters/tired.png');
});
test('cheers follow actual task completions and not imports, initial load, or deletions',()=>{
 const before={tasks:[{id:'a',done:false},{id:'b',done:false}]};
 assert.equal(completionCheer(null,before),null);
 assert.equal(completionCheer(before,{tasks:[...before.tasks,{id:'c',done:true}]}),null);
 assert.equal(completionCheer(before,{tasks:[{id:'a',done:true},{id:'b',done:false}]}),'벌써 절반 했어요! (1/2)');
 assert.equal(completionCheer({tasks:[{id:'a',done:true},{id:'b',done:false}]},{tasks:[{id:'a',done:true}]}),null);
 assert.equal(completionCheer(before,{tasks:[{id:'a',done:true},{id:'b',done:true}]}),'모두 해냈어요! (2/2)');
});
test('pet and popover remain inside displays including negative monitor coordinates',()=>{
 const area={x:-1280,y:0,width:1280,height:720};
 const b=clampBounds({x:100,y:700,width:180,height:190},area);assert.equal(b.x,-180);assert.equal(b.y,530);
 const right=popoverBounds({x:-198,y:500,width:180,height:190},area);assert.equal(right.x,-570);assert.ok(right.y+right.height<=720);
 const left=popoverBounds({x:-1280,y:0,width:180,height:190},area);assert.equal(left.x,-1088);assert.equal(left.y,0);
});
test('alert origins retain HTTPS and registered-note IDs while rejecting executable URLs and limiting lists',()=>{const {cleanOrigins}=require('../companion.cjs');const items=cleanOrigins([{id:'a',title:'Slack',url:'https://slack.com/test',source:'slack'},{id:'b',title:'unsafe',url:'javascript:alert(1)'},{id:'c',title:'note',source:'obsidian',url:'file:///private'}]);assert.equal(items.length,2);assert.equal(items[1].url,null);assert.equal(cleanOrigins(Array.from({length:60},(_,i)=>({id:String(i),title:'mail',url:'https://mail.google.com/'}))).length,50);});
