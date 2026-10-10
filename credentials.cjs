const fs = require('node:fs');
const ALLOWED = ['SLACK_USER_TOKEN','GMAIL_ACCESS_TOKEN','JIRA_ACCESS_TOKEN','JIRA_CLOUD_ID','GOOGLE_REFRESH_TOKEN','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'];
function createVault(safeStorage, file) {
 function available() { return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || !safeStorage.getSelectedStorageBackend || safeStorage.getSelectedStorageBackend() !== 'basic_text'); }
 function read() { if (!fs.existsSync(file))return {}; if(!available())throw new Error('Secure storage unavailable'); return JSON.parse(safeStorage.decryptString(Buffer.from(fs.readFileSync(file,'utf8'),'base64'))); }
 let values={};try{values=read();}catch{}
 return {
  values:()=>({...values}),
  status:()=>({secure:available(),configured:ALLOWED.filter(key=>!!values[key])}),
  save(input) {
   if(!available())throw new Error('기기의 안전한 인증 저장소를 사용할 수 없어요.');
   const next={...values};
   for(const key of ALLOWED){if(typeof input?.[key]!=='string')continue;const value=input[key].trim();if(value.length>16384)throw new Error('입력 값이 너무 길어요.');if(value)next[key]=value;}
   if(next.JIRA_CLOUD_ID&&!/^[a-zA-Z0-9-]+$/.test(next.JIRA_CLOUD_ID))throw new Error('Jira Cloud ID 형식을 확인해 주세요.');
   const encrypted=safeStorage.encryptString(JSON.stringify(next));
   fs.writeFileSync(file+'.tmp',encrypted.toString('base64'),{mode:0o600});fs.renameSync(file+'.tmp',file);values=next;return this.status();
  },
  clear(){if(fs.existsSync(file))fs.unlinkSync(file);values={};return this.status();}
 };
}
module.exports={createVault};
