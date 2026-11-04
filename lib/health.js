export function studentData(body) {
  const data = { name: String(body.name || '').trim(), class: String(body.class || '').trim(), age: Number(body.age) };
  if (!data.name || !data.class || !Number.isInteger(data.age) || data.age < 1 || data.age > 100) throw new Error('Enter a name, class, and valid age (1–100).');
  for (const key of ['height', 'weight']) {
    data[key] = body[key] === '' || body[key] == null ? null : Number(body[key]);
    if (data[key] !== null && (!Number.isFinite(data[key]) || data[key] <= 0)) throw new Error('Height and weight must be positive numbers.');
  }
  for (const key of ['lastTetanus', 'lastAntiMalaria']) {
    data[key] = body[key] ? new Date(body[key]) : null;
    if (data[key] && (!Number.isFinite(data[key].getTime()) || data[key] > new Date())) throw new Error('Treatment dates must be valid and cannot be in the future.');
  }
  return data;
}
export function summarize(complaints, days = 30, now = new Date()) {
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - days + 1);
  const rows = complaints.filter(c => new Date(c.started) >= start && new Date(c.started) <= now);
  const trend = Array.from({length: days}, (_, i) => {
    const date = new Date(start); date.setUTCDate(date.getUTCDate() + i);
    return {date: date.toISOString().slice(0, 10), count: 0};
  });
  const illnesses = new Map(); const severity = {mild: 0, normal: 0, severe: 0, other: 0};
  for (const c of rows) {
    trend.find(d => d.date === new Date(c.started).toISOString().slice(0, 10)).count++;
    severity[Object.hasOwn(severity, c.severity) ? c.severity : 'other']++;
    const names = c.sicknesses.length ? c.sicknesses.map(s => s.name) : [c.complaintIdent];
    for (const name of new Set(names.map(n => n.trim().toLowerCase()).filter(Boolean))) illnesses.set(name, (illnesses.get(name) || 0) + 1);
  }
  return {days, total: rows.length, affected: new Set(rows.map(c => c.studentId)).size, open: rows.filter(c => !c.ended).length,
    severity, trend, illnesses: [...illnesses].map(([name, count]) => ({name, count})).sort((a,b) => b.count - a.count), recent: rows.slice(0, 8)};
}
