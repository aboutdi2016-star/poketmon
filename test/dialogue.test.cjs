const test=require('node:test'),assert=require('node:assert/strict');
const {lines,createPicker}=require('../dialogue.js');
test('each situation has multiple lines and never repeats its last choice',()=>{
 const pick=createPicker(()=>0);
 for(const situation of Object.keys(lines)){assert.ok(lines[situation].length>=4);assert.equal(new Set(lines[situation]).size,lines[situation].length);let last;for(let i=0;i<15;i++){const line=pick(situation);assert.ok(lines[situation].includes(line));assert.notEqual(line,last);last=line;}}
});
