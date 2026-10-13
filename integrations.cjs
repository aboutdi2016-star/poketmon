const { fetch, EnvHttpProxyAgent } = require('undici');
const dispatcher = new EnvHttpProxyAgent();
const ACTION = /할\s?일|요청|부탁|확인|검토|제출|답장|마감|please|action|review|deadline|todo|to-do|follow.?up|due|request/i;
const URGENT = /긴급|급한|마감|오늘까지|즉시|urgent|asap|deadline|due today|highest|critical|blocker/i;
function priority(text) { return URGENT.test(text) ? 1 : 2; }
function safeUrl(value) { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } }
async function api(url, token, options = {}) {
  const response = await fetch(url, { ...options, dispatcher, headers: { Authorization: `Bearer ${token}`, ...options.headers }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) { const error = new Error(`HTTP ${response.status}`); error.status = response.status; throw error; }
  return response.json();
}
async function slack(env, request) {
  const date = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const result = await request(`https://slack.com/api/search.messages?${new URLSearchParams({ query: `to:me after:${date}`, count: '50', sort: 'timestamp', sort_dir: 'desc' })}`, env.SLACK_USER_TOKEN);
  if (!result.ok) { const e = new Error('Slack API error'); e.status = result.error === 'invalid_auth' || result.error === 'token_expired' ? 401 : 403; throw e; }
  return (result.messages?.matches || []).filter(m => ACTION.test(m.text || '')).map(m => ({ id: `slack:${m.channel?.id}:${m.ts}`, title: (m.text || '').replace(/<[^>]+>/g, '').slice(0, 140), source: 'slack', priority: priority(m.text), url: safeUrl(m.permalink), candidate: true }));
}
async function gmail(env, request) {
  const base = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
  const result = await request(`${base}?${new URLSearchParams({ q: 'in:inbox is:unread newer_than:7d', maxResults: '25' })}`, env.GMAIL_ACCESS_TOKEN);
  const items = [];
  // Bounded concurrency avoids bursting the user's Gmail quota.
  for (let i = 0; i < (result.messages || []).length; i += 5) {
    const batch = await Promise.all(result.messages.slice(i, i + 5).map(m => request(`${base}/${encodeURIComponent(m.id)}?format=metadata&metadataHeaders=Subject`, env.GMAIL_ACCESS_TOKEN)));
    for (const m of batch) {
      const title = m.payload?.headers?.find(h => h.name.toLowerCase() === 'subject')?.value || '(제목 없는 메일)';
      if (ACTION.test(title + ' ' + (m.snippet || ''))) items.push({ id: `gmail:${m.id}`, title: title.slice(0, 140), source: 'gmail', priority: priority(title + ' ' + (m.snippet || '')), url: `https://mail.google.com/mail/u/0/#all/${m.id}`, candidate: true });
    }
  }
  return items;
}
async function jira(env, request) {
  if (!/^[a-zA-Z0-9-]+$/.test(env.JIRA_CLOUD_ID || '')) throw new Error('Jira cloud ID missing');
  const base = `https://api.atlassian.com/ex/jira/${env.JIRA_CLOUD_ID}/rest/api/3`;
  const result = await request(`${base}/search/jql?${new URLSearchParams({ jql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY priority ASC, updated DESC', fields: 'summary,priority', maxResults: '50' })}`, env.JIRA_ACCESS_TOKEN);
  return (result.issues || []).map(m => ({ id: `jira:${m.id}`, title: `${m.key} · ${m.fields?.summary || '할 일'}`.slice(0, 140), source: 'jira', priority: /highest|high|critical|blocker|높음|긴급/i.test(m.fields?.priority?.name || '') ? 1 : 2, url: null, candidate: false }));
}
async function calendar(env, request) {
  const result = await request(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams({ timeMin: new Date().toISOString(), timeMax: new Date(Date.now() + 7 * 86400000).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '50' })}`, env.GMAIL_ACCESS_TOKEN);
  return (result.items || []).filter(e => e.status !== 'cancelled' && (e.start?.dateTime||e.start?.date) && !e.attendees?.some(a => a.self && a.responseStatus === 'declined')).map(e => ({ id: `calendar:${e.id}`, title: (e.summary || '일정')+(e.start.dateTime?'':' (종일 · 09시 기준)'), start: e.start.dateTime||new Date(e.start.date+'T09:00:00').toISOString(), url: safeUrl(e.hangoutLink || e.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri), source: 'calendar' }));
}
function failure(error) { if (error.status === 401) return '인증이 만료되었거나 유효하지 않아요.'; if (error.status === 403) return '접근 권한 또는 네트워크 허용 설정을 확인해 주세요.'; return '수집하지 못했어요. 연결 설정을 확인하고 다시 시도해 주세요.'; }
async function collect(env = process.env, request = api) {
  const providers = [ ['slack', 'SLACK_USER_TOKEN', slack], ['gmail', 'GMAIL_ACCESS_TOKEN', gmail], ['jira', 'JIRA_ACCESS_TOKEN', jira], ['calendar', 'GMAIL_ACCESS_TOKEN', calendar] ];
  const results = await Promise.all(providers.map(async ([source, key, fn]) => {
    if (!env[key] || (source === 'jira' && !env.JIRA_CLOUD_ID)) return { source, status: 'disconnected', message: '연결 설정이 필요해요.', items: [] };
    try { return { source, status: 'connected', message: '최근 항목을 확인했어요.', items: await fn(env, request) }; }
    catch (error) { return { source, status: 'error', message: failure(error), items: [] }; }
  }));
  return { results, checkedAt: new Date().toISOString() };
}
module.exports = { collect, priority, safeUrl };
