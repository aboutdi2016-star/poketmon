function dueReminders(meetings, reminded, now = Date.now()) {
  return meetings.filter(m => { const start = Date.parse(m.start); return Number.isFinite(start) && now >= start - 600000 && now < start && !reminded.has(`${m.id}:${m.start}`); });
}
function validateMeetings(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(m => typeof m.id === 'string' && typeof m.title === 'string' && Number.isFinite(Date.parse(m.start))).slice(0, 200).map(m => ({ id: m.id, title: m.title.slice(0, 140), start: m.start, url: /^https:\/\//.test(m.url || '') ? m.url : null, source: m.source }));
}
module.exports = { dueReminders, validateMeetings };
