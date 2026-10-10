const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createVault } = require('../credentials.cjs');
test('credential vault persists encrypted values, preserves blanks, exposes presence only',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pika-vault-')), file=path.join(root,'credentials.enc');
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(16);
 const safe={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'test-encrypted',encryptString:text=>{const c=crypto.createCipheriv('aes-256-cbc',key,iv);return Buffer.concat([c.update(text),c.final()]);},decryptString:bytes=>{const c=crypto.createDecipheriv('aes-256-cbc',key,iv);return Buffer.concat([c.update(bytes),c.final()]).toString();}};
 try{const vault=createVault(safe,file);vault.save({SLACK_USER_TOKEN:'example-private-token'});assert.ok(!fs.readFileSync(file,'utf8').includes('example-private-token'));assert.deepEqual(vault.status().configured,['SLACK_USER_TOKEN']);assert.ok(!JSON.stringify(vault.status()).includes('example-private-token'));vault.save({SLACK_USER_TOKEN:''});assert.equal(createVault(safe,file).values().SLACK_USER_TOKEN,'example-private-token');vault.clear();assert.equal(fs.existsSync(file),false);}finally{fs.rmSync(root,{recursive:true});}
});
test('unavailable OS encryption cannot silently save plaintext credentials',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pika-vault-')),file=path.join(root,'credentials.enc');
 try{const vault=createVault({isEncryptionAvailable:()=>false},file);assert.throws(()=>vault.save({GMAIL_ACCESS_TOKEN:'test'}));assert.equal(fs.existsSync(file),false);}finally{fs.rmSync(root,{recursive:true});}
});
