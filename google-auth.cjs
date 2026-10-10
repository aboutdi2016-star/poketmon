const {fetch,EnvHttpProxyAgent}=require('undici');
const dispatcher=new EnvHttpProxyAgent();
async function exchange(input){const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',dispatcher,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(input),signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(response.status===400?'Google 자동 갱신 정보를 확인해 주세요. 갱신 토큰이 취소되었을 수 있어요.':'Google 인증 서버에 연결하지 못했어요.');return response.json();}
function createGoogleAuth({values,save,request=exchange,clock=Date.now}){
 let cached=null,pending=null,identity='';
 async function credentials(){const env=values();const key=[env.GOOGLE_REFRESH_TOKEN,env.GOOGLE_CLIENT_ID,env.GOOGLE_CLIENT_SECRET].join('\0');if(key!==identity){cached=null;identity=key;}
  if(!env.GOOGLE_REFRESH_TOKEN||!env.GOOGLE_CLIENT_ID)return env;
  if(cached&&cached.expiresAt>clock()+60000)return {...env,GMAIL_ACCESS_TOKEN:cached.token};
  if(!pending)pending=(async()=>{const result=await request({grant_type:'refresh_token',refresh_token:env.GOOGLE_REFRESH_TOKEN,client_id:env.GOOGLE_CLIENT_ID,...(env.GOOGLE_CLIENT_SECRET?{client_secret:env.GOOGLE_CLIENT_SECRET}:{})});if(typeof result.access_token!=='string'||!Number.isFinite(Number(result.expires_in)))throw new Error('Google 토큰 응답이 올바르지 않아요.');if(identity===key){cached={token:result.access_token,expiresAt:clock()+Number(result.expires_in)*1000};if(result.refresh_token)save({GOOGLE_REFRESH_TOKEN:result.refresh_token});}return {...env,GMAIL_ACCESS_TOKEN:result.access_token};})().finally(()=>{pending=null;});
  return pending;
 }
 return {credentials,reset(){cached=null;identity='';}};
}
module.exports={createGoogleAuth};
