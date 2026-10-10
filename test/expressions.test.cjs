const test=require('node:test');
const assert=require('node:assert/strict');
const faces=require('../expressions.js');
test('ten expressions have distinct faces and the six referenced moods',()=>{
 assert.equal(faces.choices.length,10);
 for(const id of ['sleepy','tired','surprised','goofy','angry','focused'])assert.ok(faces.choices.some(f=>f.id===id));
 const variants=faces.choices.map(({id})=>{const face=faces.get(id);assert.ok(face.eyes&&face.mouth&&face.ears);return face.eyes+face.mouth+face.brows+face.extra;});
 assert.equal(new Set(variants).size,10);
 assert.equal(faces.get('unknown').label,'자신 있는');
});
