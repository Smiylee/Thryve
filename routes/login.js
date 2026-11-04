import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db.js';
const router = express.Router();
for (const role of ['admin', 'nurse']) {
  router.get(`/login/${role}`, (req,res) => res.render(`login_${role}`, {error: ''}));
  router.post(`/login/${role}`, async (req,res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const user = role === 'admin' ? await prisma.admin.findUnique({where: {username}}) : await prisma.nurse.findFirst({where: {OR: [{email: username}, {name: username}]}});
    const hashed = user?.password.startsWith('$2');
    const valid = user && password && (hashed ? await bcrypt.compare(password, user.password) : role === 'nurse' && password === user.password);
    if (!valid) return res.status(401).render(`login_${role}`, {error: 'Invalid username or password.'});
    if (!hashed) await prisma.nurse.update({where: {id: user.id}, data: {password: await bcrypt.hash(password, 12)}});
    await new Promise((resolve,reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    if (role === 'nurse') {
      // The partial unique database index also protects simultaneous logins.
      try {
        await prisma.$transaction(async tx => {
          const active = await tx.shift.findFirst({where: {nurseId: user.id, endTime: null}});
          if (!active) await tx.shift.create({data: {nurseId: user.id, nurseName: user.name, startTime: new Date()}});
        });
      } catch (error) {
        if (error.code !== 'P2002') throw error;
      }
      req.session.nurse = {id: user.id, name: user.name};
    } else req.session.admin = {id: user.id, username: user.username};
    res.redirect(role === 'admin' ? '/admin/dashboard' : '/nurse/dashboard');
  });
}
export default router;
