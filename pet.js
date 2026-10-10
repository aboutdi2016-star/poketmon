'use strict';
const bridge=window.pikaCompanion,button=document.getElementById('pet'),image=document.getElementById('character');
const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
let pixels=null,drag=null,ignoring=false;
function setIgnoring(value){if(value===ignoring)return;ignoring=value;bridge?.pointer({phase:'ignore',value});}
function loadPixels(){if(!image.naturalWidth)return;canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;ctx.drawImage(image,0,0);pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;}
image.onload=loadPixels;if(image.complete)loadPixels();
function opaque(x,y){
 if(!pixels)return false;
 const r=image.getBoundingClientRect(),scale=Math.min(r.width/canvas.width,r.height/canvas.height),w=canvas.width*scale,h=canvas.height*scale;
 const px=Math.floor((x-r.left-(r.width-w)/2)/scale),py=Math.floor((y-r.top-(r.height-h)/2)/scale);
 return px>=0&&py>=0&&px<canvas.width&&py<canvas.height&&pixels[(py*canvas.width+px)*4+3]>35;
}
document.addEventListener('pointermove',e=>{
 if(drag){if(Math.hypot(e.screenX-drag.x,e.screenY-drag.y)>5)drag.moved=true;if(drag.moved)bridge?.pointer({phase:'move'});return;}
 setIgnoring(!opaque(e.clientX,e.clientY));
});
button.addEventListener('pointerdown',e=>{
 if(e.button!==0||!opaque(e.clientX,e.clientY))return;
 setIgnoring(false);drag={id:e.pointerId,x:e.screenX,y:e.screenY,moved:false};button.setPointerCapture(e.pointerId);button.classList.add('dragging');bridge?.pointer({phase:'start'});
});
function finish(e,canceled=false){if(!drag)return;const moved=drag.moved;drag=null;button.classList.remove('dragging');bridge?.pointer({phase:'end'});if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);if(!canceled&&!moved)bridge?.panel();}
button.addEventListener('pointerup',e=>finish(e));button.addEventListener('pointercancel',e=>finish(e,true));
button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();bridge?.panel();}});
document.addEventListener('contextmenu',e=>{e.preventDefault();if(opaque(e.clientX,e.clientY))bridge?.menu();});
function render(state){if(state?.image&&image.getAttribute('src')!==state.image){pixels=null;image.src=state.image;}button.setAttribute('aria-label',`피카츄 · ${state?.greeting||'오늘의 할 일 보기'}`);}
bridge?.onState(render);bridge?.state().then(render);
image.onerror=()=>{if(image.getAttribute('src')!=='/assets/characters/captain.png')image.src='/assets/characters/captain.png';};
