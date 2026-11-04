import test from 'node:test';
import assert from 'node:assert/strict';
import { studentData, summarize } from '../lib/health.js';
test('student records accept optional measurements and reject invalid inputs', () => {
  assert.equal(studentData({name: ' Ada ', class: 'JSS1', age: '12', height: '', weight: ''}).name, 'Ada');
  assert.equal(studentData({name: 'Ada', class: 'JSS1', age: '12'}).weight, null);
  for (const overrides of [{age: '12.5'}, {age: ''}, {height: '-1'}, {weight: 'no'}, {name: ' '}, {lastTetanus: 'invalid'}]) assert.throws(() => studentData({name: 'Ada', class: 'JSS1', age: 12, ...overrides}));
});
test('analytics count visits, distinct students, open cases and deduplicate illness tags', () => {
  const row = {studentId: 1, started: new Date('2026-11-04T10:00:00Z'), ended: null, complaintIdent: 'Fever', severity: 'mild', sicknesses: [{name:'Fever'}, {name:'fever'}]};
  const result = summarize([row, {...row, sicknesses: [], ended: new Date()}, {...row, studentId: 2, severity: 'severe'}, {...row, started: new Date('2025-01-01')}], 7, new Date('2026-11-04T12:00:00Z'));
  assert.equal(result.total, 3); assert.equal(result.affected, 2); assert.equal(result.open, 2);
  assert.equal(result.illnesses[0].count, 3); assert.equal(result.trend.at(-1).count, 3); assert.equal(result.severity.severe, 1);
});
test('empty analytics retain zero-filled daily counts', () => {
  const result = summarize([], 30); assert.equal(result.trend.length, 30); assert.equal(result.total, 0); assert.deepEqual(result.illnesses, []);
});
