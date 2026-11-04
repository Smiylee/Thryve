import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/db.js';
import { studentData, summarize } from './lib/health.js';
import loginRoutes from './routes/login.js';
import signupRoutes from './routes/signup.js';
const root = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
const SQLiteStore = SQLiteStoreFactory(session);
app.set('view engine', 'ejs'); app.set('views', path.join(root, 'views'));
app.use(express.static(path.join(root, 'public'), {index: false}));
app.use(express.urlencoded({extended: true, limit: '100kb'})); app.use(express.json({limit: '100kb'}));
app.use(session({store: new SQLiteStore({db: 'sessions.sqlite', dir: process.env.SESSION_DIR || root}), secret: process.env.SESSION_SECRET || randomBytes(48).toString('hex'), resave: false, saveUninitialized: false, cookie: {httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 86400000}}));
app.use((req,res,next) => {
  res.locals.isAdmin = !!req.session.admin;
  res.locals.currentPath = req.path;
  res.locals.viewer = req.session.admin?.username || req.session.nurse?.name || '';
  res.locals.error = '';
  if (req.session.admin || req.session.nurse) res.set('Cache-Control', 'no-store');
  // Block cross-origin writes, including JSON requests.
  if (req.method === 'POST' && req.headers.origin && new URL(req.headers.origin).host !== req.get('host')) return res.status(403).send('Invalid request origin.');
  next();
});
app.use('/auth', loginRoutes); app.use('/', signupRoutes);
app.get('/', (req,res) => req.session.admin || req.session.nurse ? res.redirect('/dashboard') : res.render('index'));
app.use((req,res,next) => {
  if (!req.session.admin && !req.session.nurse) return res.redirect('/auth/login/nurse');
  if (req.path.startsWith('/admin') && !req.session.admin) return res.status(403).render('message', {title: 'Matron access required', message: 'This page is available to the matron.'});
  next();
});
const id = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1) { const e = new Error('Invalid record ID.'); e.status = 400; throw e; } return n; };
const missing = () => { const e = new Error('Record not found.'); e.status = 404; throw e; };
app.get('/dashboard', (req,res) => res.redirect(req.session.admin ? '/admin/dashboard' : '/nurse/dashboard'));
async function dashboard(req,res) {
  const days = [7,30,90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const since = new Date(); since.setUTCHours(0,0,0,0); since.setUTCDate(since.getUTCDate() - days + 1);
  const [complaints, students, activeShifts] = await Promise.all([
    prisma.complaint.findMany({where: {started: {gte: since}}, include: {sicknesses: true, student: true}, orderBy: {started: 'desc'}}),
    prisma.student.count(), prisma.shift.findMany({where: {endTime: null, ...(req.session.admin ? {nurse: {adminId: req.session.admin.id}} : {nurseId: req.session.nurse.id})}, include: {nurse: true}, orderBy: {startTime: 'desc'}})
  ]);
  const stats = summarize(complaints, days);
  const classes = Object.entries(complaints.reduce((groups, visit) => {
    const key = visit.student.class; groups[key] ||= {visits: 0, open: 0};
    groups[key].visits++; if (!visit.ended) groups[key].open++; return groups;
  }, {})).sort((a,b) => b[1].visits - a[1].visits);
  const openCases = await prisma.complaint.findMany({where: {ended: null}, include: {student: true}, orderBy: {started: 'asc'}});
  res.render(req.path.endsWith('/analytics') || req.path === '/health-tracking' ? 'insights' : 'overview', {stats, students, activeShifts, classes, openCases});
}
app.get(['/admin/dashboard','/admin/analytics','/nurse/dashboard','/nurse/analytics','/health-tracking'], dashboard);
app.get('/admin/nurses', async (req,res) => res.render('nurses', {nurses: await prisma.nurse.findMany({where: {adminId: req.session.admin.id}})}));
app.get('/admin/add/nurse', (req,res) => res.render('add-nurse'));
app.post('/admin/add/nurse', async (req,res) => {
  const {name,email,password,confirmPassword,phoneNumber} = req.body;
  if (!name?.trim() || !email?.includes('@') || !password || password.length < 8 || password !== confirmPassword) return res.status(400).render('add-nurse', {error: 'Enter a name, valid email, and matching passwords of at least 8 characters.'});
  try { await prisma.nurse.create({data: {name: name.trim(), email: email.trim().toLowerCase(), phone: phoneNumber, password: await bcrypt.hash(password, 12), adminId: req.session.admin.id}}); }
  catch (e) { if (e.code === 'P2002') return res.status(400).render('add-nurse', {error: 'That email already belongs to a nurse.'}); throw e; }
  res.redirect('/admin/nurses');
});
app.get('/admin/shifts', async (req,res) => {
  const status = ['active','pending','validated'].includes(req.query.status) ? req.query.status : 'all';
  const where = {nurse: {adminId: req.session.admin.id}};
  if (status === 'active') where.endTime = null;
  if (status === 'pending') {where.endTime = {not: null}; where.validatedAt = null;}
  if (status === 'validated') where.validatedAt = {not: null};
  res.render('shift-log', {status, shifts: await prisma.shift.findMany({where, include: {nurse: true}, orderBy: {startTime: 'desc'}})});
});
app.get('/nurse/shifts', async (req,res) => {
  if (!req.session.nurse) return res.redirect('/admin/shifts');
  const status = ['active','pending','validated'].includes(req.query.status) ? req.query.status : 'all';
  const where = {nurseId: req.session.nurse.id};
  if (status === 'active') where.endTime = null;
  if (status === 'pending') { where.endTime = {not: null}; where.validatedAt = null; }
  if (status === 'validated') where.validatedAt = {not: null};
  const activeShift = await prisma.shift.findFirst({where: {nurseId: req.session.nurse.id, endTime: null}});
  res.render('shift-log', {status, activeShift, shifts: await prisma.shift.findMany({where, include: {nurse: true}, orderBy: {startTime: 'desc'}})});
});
app.post('/nurse/shifts/:action', async (req,res) => {
  if (!req.session.nurse) return res.sendStatus(403);
  const nurseId = req.session.nurse.id;
  if (req.params.action === 'clock-out') {
    await prisma.shift.updateMany({where: {nurseId, endTime: null}, data: {endTime: new Date()}});
  } else if (req.params.action === 'clock-in') {
    try {
      await prisma.$transaction(async tx => {
        if (!await tx.shift.findFirst({where: {nurseId, endTime: null}}))
          await tx.shift.create({data: {nurseId, nurseName: req.session.nurse.name, startTime: new Date()}});
      });
    } catch (error) { if (error.code !== 'P2002') throw error; }
  } else return res.sendStatus(400);
  res.redirect('/nurse/shifts');
});
app.post('/admin/shifts/:id/:action', async (req,res) => {
  const shift = await prisma.shift.findFirst({where: {id: id(req.params.id), nurse: {adminId: req.session.admin.id}}});
  if (!shift) return missing();
  if (req.params.action === 'close' && !shift.endTime) await prisma.shift.updateMany({where: {id: shift.id, endTime: null}, data: {endTime: new Date()}});
  else if (req.params.action === 'validate' && shift.endTime) await prisma.shift.updateMany({where: {id: shift.id, validatedAt: null}, data: {validatedAt: new Date(), validatedBy: req.session.admin.id}});
  else return res.status(400).render('message', {title: 'Shift cannot be updated', message: 'Only completed shifts can be validated. Refresh to see its latest status.'});
  res.redirect('/admin/shifts');
});
app.post(['/auth/logout/nurse','/auth/logout','/logout'], async (req,res) => {
  if (req.session.nurse) await prisma.shift.updateMany({where: {nurseId: req.session.nurse.id, endTime: null}, data: {endTime: new Date()}});
  await new Promise((resolve,reject) => req.session.destroy(err => err ? reject(err) : resolve()));
  res.clearCookie('connect.sid'); res.redirect('/');
});
app.get('/student/records', async (req,res) => {
  const q = String(req.query.q || '').trim();
  const students = await prisma.student.findMany({where: q ? {OR: [{name: {contains: q}}, {class: {contains: q}}]} : {}, include: {_count: {select: {complaints: true}}}, orderBy: {name: 'asc'}});
  res.render('students', {students, q});
});
app.get('/add/student', (req,res) => res.render('student-form', {student: {}, editing: false}));
app.get('/student/edit/:id', async (req,res) => {
  const student = await prisma.student.findUnique({where: {id: id(req.params.id)}}); if (!student) return missing();
  res.render('student-form', {student, editing: true});
});
app.post(['/add/student','/student/edit/:id'], async (req,res) => {
  const editing = !!req.params.id; let data;
  try { data = studentData(req.body); } catch(e) { return res.status(400).render('student-form', {student: {...req.body, id: req.params.id}, editing, error: e.message}); }
  const student = editing ? await prisma.student.update({where: {id: id(req.params.id)}, data}) : await prisma.student.create({data});
  res.redirect(`/student/view/${student.id}`);
});
app.get('/student/view/:id', async (req,res) => {
  const student = await prisma.student.findUnique({where: {id: id(req.params.id)}, include: {complaints: {include: {sicknesses: true, nurse: true}, orderBy: {started: 'desc'}}}});
  if (!student) return missing(); res.render('student-detail', {student});
});
app.post('/student/add/complaint/:id', async (req,res) => {
  if (!req.session.nurse) return res.status(403).render('message', {title: 'Nurse access required', message: 'Sign in as a nurse to record a health visit.'});
  const student = await prisma.student.findUnique({where: {id: id(req.params.id)}}); if (!student) return missing();
  const active = await prisma.shift.findFirst({where: {nurseId: req.session.nurse.id, endTime: null}});
  if (!active) return res.status(400).render('message', {title: 'Your shift has ended', message: 'Open My shifts and clock in before recording a visit.'});
  const {complaintIdent, complaintNotes, medication, severity} = req.body;
  const frequency = Number(req.body.frequency), duration = Number(req.body.duration);
  let tags;
  try { tags = req.body.tags?.startsWith('[') ? JSON.parse(req.body.tags) : String(req.body.tags || '').split(','); if (!Array.isArray(tags) || tags.some(t => typeof t !== 'string')) throw Error(); }
  catch { return res.status(400).render('message', {title: 'Invalid sickness list', message: 'Use comma-separated sickness names.'}); }
  if (!complaintIdent?.trim() || !complaintNotes?.trim() || !['mild','normal','severe'].includes(severity) || !Number.isInteger(frequency) || frequency < 1 || !Number.isInteger(duration) || duration < 0) return res.status(400).render('message', {title: 'Check the visit details', message: 'Add a complaint, notes, severity, positive daily frequency, and a non-negative duration.'});
  tags = [...new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean))];
  await prisma.complaint.create({data: {studentId: student.id, nurseId: req.session.nurse.id, studentName: student.name, nurseName: req.session.nurse.name, complaintIdent: complaintIdent.trim(), complaintNotes: complaintNotes.trim(), medication: medication?.trim() || 'None', severity, frequency, duration, sicknesses: {connectOrCreate: tags.map(name => ({where: {name}, create: {name}}))}}});
  res.redirect(`/student/view/${student.id}`);
});
app.post('/student/complaint/:id/resolve', async (req,res) => {
  if (!req.session.nurse) return res.sendStatus(403);
  const complaint = await prisma.complaint.findUnique({where: {id: id(req.params.id)}}); if (!complaint) return missing();
  await prisma.complaint.updateMany({where: {id: complaint.id, ended: null}, data: {ended: new Date()}});
  res.redirect(`/student/view/${complaint.studentId}`);
});
app.get('/student/complaints', async (req,res) => res.render('visits', {complaints: await prisma.complaint.findMany({include: {student: true}, orderBy: {started: 'desc'}})}));
app.get('/student/view/complaint/:id', async (req,res) => {
  const complaint = await prisma.complaint.findUnique({where: {id: id(req.params.id)}}); if (!complaint) return missing(); res.redirect(`/student/view/${complaint.studentId}#visit-${complaint.id}`);
});
app.get('/admin/record-books', async (req,res) => res.render('record-books', {recordBooks: await prisma.recordTemplate.findMany({orderBy: {createdAt: 'desc'}})}));
app.get('/admin/record-books/:id', async (req,res) => {
  const book = await prisma.recordTemplate.findUnique({where: {id: id(req.params.id)}, include: {fields: {orderBy: {order: 'asc'}}, rows: {include: {values: true}, orderBy: {createdAt: 'desc'}}}});
  if (!book) return missing();
  res.render('record-book-detail', {book});
});
app.post('/admin/create/record-books', async (req,res) => {
  const {tableName,columns} = req.body;
  if (!tableName?.trim() || !Array.isArray(columns) || !columns.length || columns.some(c => !c.name?.trim() || !['STRING','NUMBER','DATE','BOOLEAN'].includes(c.type)) || new Set(columns.map(c => c.name.trim().toLowerCase())).size !== columns.length) return res.status(400).json({error: 'Enter a title and unique, valid columns.'});
  await prisma.recordTemplate.create({data: {name: tableName.trim(), fields: {create: columns.map((c,i) => ({name: c.name.trim(), type: c.type, required: !!c.required, order: i + 1}))}}});
  res.redirect('/admin/record-books');
});
app.get('/complaints', (req,res) => res.redirect('/student/complaints'));
app.get('/records', (req,res) => res.redirect('/student/records'));
app.get(['/appointments','/medications'], (req,res) => res.render(req.path.slice(1)));
app.use((req,res) => res.status(404).render('message', {title: 'Page not found', message: 'Use the navigation to return to your workspace.'}));
app.use((err,req,res,next) => {
  console.error(err);
  const status = err.status || (err.code === 'P2025' ? 404 : 500);
  res.status(status).render('message', {title: status === 404 ? 'Record not found' : 'Unable to complete request', message: status < 500 ? err.message : 'Please try again. If the problem continues, contact your administrator.'});
});
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) app.listen(Number(process.env.PORT) || 3000, () => console.log('Thryve is running.'));
