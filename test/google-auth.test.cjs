const test=require('node:test'),assert=require('node:assert/strict');const {createGoogleAuth}=require('../google-auth.cjs');
test('Google refresh exchanges correct credentials, caches until expiry, and refreshes before expiration',async()=>{
 let now=0,calls=0;const env={GOOGLE_REFRESH_TOKEN:'test-refresh',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',SLACK_USER_TOKEN:'test-slack'};
 const auth=createGoogleAuth({values:()=>env,save:()=>{},clock:()=>now,request:async input=>{calls++;assert.equal(input.grant_type,'refresh_token');assert.equal(input.refresh_token,env.GOOGLE_REFRESH_TOKEN);return {access_token:'test-access-'+calls,expires_in:3600};}});
 const [a,b]=await Promise.all([auth.credentials(),auth.credentials()]);assert.equal(calls,1);assert.equal(a.GMAIL_ACCESS_TOKEN,'test-access-1');assert.equal(b.SLACK_USER_TOKEN,'test-slack');now=3500000;await auth.credentials();assert.equal(calls,1);now=3550000;await auth.credentials();assert.equal(calls,2);
});
test('manual access-token mode remains available and refresh failures are not reported as connected',async()=>{
 const manual=createGoogleAuth({values:()=>({GMAIL_ACCESS_TOKEN:'test-manual'}),save:()=>{},request:()=>{throw new Error('unexpected');}});assert.equal((await manual.credentials()).GMAIL_ACCESS_TOKEN,'test-manual');
 const failure=createGoogleAuth({values:()=>({GOOGLE_REFRESH_TOKEN:'test',GOOGLE_CLIENT_ID:'test'}),save:()=>{},request:async()=>{throw new Error('revoked');}});await assert.rejects(failure.credentials(),/revoked/);
});
