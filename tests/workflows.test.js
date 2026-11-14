import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
test('feature regression: authentication → shift → student record → analytics → validation', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'thryve-test-'));
  process.env.DATABASE_URL = `file:${path.join(directory, 'test.db')}`;
  process.env.SESSION_DIR = directory;
  process.env.SESSION_SECRET = 'integration-test-only';
  const setup = spawnSync(process.execPath, ['scripts/setup-db.js'], {env: process.env, encoding: 'utf8'});
  assert.equal(setup.status, 0, setup.stdout + setup.stderr);
  const { prisma } = await import('../lib/db.js');
  const { default: bcrypt } = await import('bcryptjs');
  const { app } = await import('../app.js');
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  function client() {
    let cookie = '';
    return async (route, body) => {
      const response = await fetch(url+route, {method: body ? 'POST' : 'GET', redirect: 'manual', headers: {cookie, ...(body ? {'Content-Type': 'application/x-www-form-urlencoded'} : {})}, ...(body ? {body: new URLSearchParams(body)} : {})});
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      return response;
    };
  }
  try {
    const admin = await prisma.admin.create({data: {username: 'matron', password: await bcrypt.hash('test-password', 4)}});
    const nurse = await prisma.nurse.create({data: {name: 'Test Nurse', email: 'nurse@example.test', password: 'legacy-password', adminId: admin.id}});
    const a = client(), n = client(), guest = client();
    assert.match(await (await guest('/')).text(), /School health workspace/);
    assert.equal((await guest('/student/records')).status, 302);
    assert.equal((await a('/auth/login/admin', {username:'matron', password:'incorrect'})).status, 401);
    assert.equal((await a('/auth/login/admin', {username:'matron', password:'test-password'})).status, 302);
    assert.equal((await n('/auth/login/nurse', {username:'Test Nurse', password:'legacy-password'})).status, 302);
    assert.equal((await n('/auth/login/nurse', {username:'Test Nurse', password:'legacy-password'})).status, 302);
    assert.equal(await prisma.shift.count({where:{nurseId:nurse.id, endTime:null}}), 1);
    assert.ok((await prisma.nurse.findUnique({where:{id:nurse.id}})).password.startsWith('$2'));
    assert.equal((await n('/admin/shifts')).status, 403);
    assert.equal((await n('/add/student', {name:'Ada', class:'JSS1', age:'12'})).status, 302);
    const student = await prisma.student.findFirst();
    assert.equal((await n(`/student/edit/${student.id}`, {name:'Ada Updated', class:'JSS2', age:'13', weight:'42'})).status, 302);
    assert.equal((await n(`/student/add/complaint/${student.id}`, {complaintIdent:'Fever', complaintNotes:'Rest and observation', tags:'fever, fever', severity:'mild', frequency:'1', duration:'2', nurseId:'999'})).status, 302);
    const complaint = await prisma.complaint.findFirst(); assert.equal(complaint.nurseId, nurse.id);
    for (const route of ['/admin/dashboard','/admin/analytics','/admin/shifts','/student/records',`/student/view/${student.id}`,'/student/complaints','/admin/nurses','/admin/record-books']) {
      const r = await a(route); assert.equal(r.status, 200, `${route}: ${await r.text()}`);
    }
    // Record books: creation, typed cells, atomic validation, edits and deletion.
    const createBook = await a('/admin/create/record-books', {tableName:'Equipment', 'columns[0][name]':'Item', 'columns[0][type]':'STRING', 'columns[0][required]':'true', 'columns[1][name]':'Count', 'columns[1][type]':'NUMBER'});
    assert.equal(createBook.status, 302);
    const bookList = await a('/admin/record-books');
    assert.equal(bookList.status, 200);
    const bookListHtml = await bookList.text();
    assert.match(bookListHtml, /Equipment/);
    assert.match(bookListHtml, /2 columns · 0 entries/);
    const book = await prisma.recordTemplate.findFirst({where:{name:'Equipment'}, include:{fields:{orderBy:{order:'asc'}}}});
    const bookPath = `/admin/record-books/${book.id}`;
    assert.equal((await a(bookPath)).status, 200);
    assert.match(await (await a(bookPath)).text(), /record-grid/);
    assert.equal((await a(`${bookPath}/entries`, {[`field_${book.fields[0].id}`]:'Bandages', [`field_${book.fields[1].id}`]:'12'})).status, 302);
    const entry = await prisma.recordEntry.findFirst({where:{templateId:book.id}});
    const fields = book.fields.map(f => ({id:f.id,name:f.name,type:f.type,required:f.required}));
    const login = await fetch(url+'/auth/login/admin', {method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'matron',password:'test-password'})});
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const saveGrid = payload => fetch(url+bookPath+'/grid', {method:'POST', headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const payload = {name:'Supply log',columns:fields,rows:[{id:entry.id,[`field_${fields[0].id}`]:'Gauze',[`field_${fields[1].id}`]:'invalid'}]};
    assert.equal((await saveGrid(payload)).status, 400);
    assert.equal((await prisma.recordTemplate.findUnique({where:{id:book.id}})).name,'Equipment');
    payload.rows[0][`field_${fields[1].id}`] = '24';
    assert.equal((await saveGrid(payload)).status, 200);
    assert.equal((await prisma.fieldValue.findFirst({where:{rowId:entry.id,columnId:fields[1].id}})).value,'24');
    payload.rows.push({id:null,[`field_${fields[0].id}`]:'Tape',[`field_${fields[1].id}`]:'3'});
    assert.equal((await saveGrid(payload)).status,200);
    assert.equal(await prisma.recordEntry.count({where:{templateId:book.id}}),2);
    assert.equal((await saveGrid({name:'Supply log',columns:[fields[0]],rows:[],deletedRows:[entry.id]})).status,200);
    assert.equal(await prisma.fieldDefinition.count({where:{templateId:book.id}}),1);
    assert.equal(await prisma.fieldValue.count({where:{rowId:entry.id}}),0);
    assert.equal((await n(bookPath)).status,403);
    const report = await (await a('/admin/analytics')).text();
    assert.match(report, /fever/);
    assert.match(report, /Visits by class/);
    assert.match(report, /JSS2/);
    assert.match(await (await a('/admin/dashboard')).text(), /Open cases <span class="badge">1<\/span>/);
    assert.equal((await a('/')).headers.get('location'), '/dashboard');
    assert.match(await (await n('/nurse/shifts')).text(), /You are on shift/);
    assert.equal((await n('/nurse/shifts/clock-out', {})).status, 302);
    assert.equal(await prisma.shift.count({where:{nurseId:nurse.id,endTime:null}}), 0);
    assert.match(await (await n('/nurse/shifts')).text(), /You are off shift/);
    assert.equal((await n(`/student/add/complaint/${student.id}`, {complaintIdent:'Blocked'})).status, 400);
    assert.equal((await n('/nurse/shifts/clock-in', {})).status, 302);
    assert.equal((await n('/nurse/shifts/clock-in', {})).status, 302);
    assert.equal(await prisma.shift.count({where:{nurseId:nurse.id,endTime:null}}), 1);
    assert.match(await (await n('/nurse/analytics?days=7')).text(), /Visits by class/);
    assert.equal((await n(`/student/complaint/${complaint.id}/resolve`, {})).status, 302);
    const shift = await prisma.shift.findFirst({where:{endTime:null}});
    assert.equal((await a(`/admin/shifts/${shift.id}/validate`, {})).status, 400);
    assert.equal((await n('/auth/logout', {userId:'999'})).status, 302);
    assert.equal(await prisma.shift.count({where:{endTime:null}}), 0);
    assert.equal((await a(`/admin/shifts/${shift.id}/validate`, {})).status, 302);
    assert.equal((await prisma.shift.findUnique({where:{id:shift.id}})).validatedBy, admin.id);
    assert.equal((await a('/student/view/99999')).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
    await rm(directory, {recursive:true, force:true});
  }
});
