import { prisma } from '../lib/db.js';
import bcrypt from 'bcryptjs';

const marker = '[DEMO]';
const email = 'demo.nurse@thryve.test';
const studentNames = [`${marker} Amara Okafor`, `${marker} Daniel Mensah`, `${marker} Leila Bello`, `${marker} Samuel Nwosu`, `${marker} Zara Adeyemi`];
const cleanup = process.argv.includes('--clear');
try {
  const nurse = await prisma.nurse.findUnique({where: {email}});
  const students = await prisma.student.findMany({where: {name: {in: studentNames}}, select: {id: true}});
  if (cleanup) {
    if (students.length) await prisma.complaint.deleteMany({where: {studentId: {in: students.map(s => s.id)}}});
    await prisma.student.deleteMany({where: {id: {in: students.map(s => s.id)}}});
    if (nurse) {
      await prisma.complaint.deleteMany({where: {nurseId: nurse.id}});
      await prisma.shift.deleteMany({where: {nurseId: nurse.id}});
      await prisma.nurse.delete({where: {id: nurse.id}});
    }
    console.log('Removed demo students, visits, shifts, and demo nurse.');
  } else {
    const admin = await prisma.admin.findFirst();
    if (!admin) throw new Error('Create a matron account before adding demo records.');
    const demoNurse = nurse || await prisma.nurse.create({data: {name: `${marker} Riley Morgan`, email, phone: '555-0100', password: await bcrypt.hash('DemoNurse123!', 10), adminId: admin.id}});
    const now = new Date();
    const profiles = [
      ['Amara Okafor','Grade 4',9,132,30], ['Daniel Mensah','Grade 5',10,140,34], ['Leila Bello','Grade 3',8,126,27], ['Samuel Nwosu','Grade 6',11,148,39], ['Zara Adeyemi','Grade 4',9,135,32]
    ];
    for (const [i,[name,klass,age,height,weight]] of profiles.entries()) {
      const student = await prisma.student.upsert({where: {id: students[i]?.id ?? -1000-i}, create: {name: `${marker} ${name}`, class: klass, age, height, weight}, update: {class: klass, age, height, weight}});
      const existing = await prisma.complaint.findFirst({where: {studentId: student.id, nurseId: demoNurse.id, complaintNotes: {startsWith: marker}}});
      if (!existing) {
        const started = new Date(now); started.setUTCDate(started.getUTCDate() - [0,2,5,11,18][i]); started.setUTCHours(10+i,0,0,0);
        await prisma.complaint.create({data: {studentId: student.id,nurseId: demoNurse.id,studentName: student.name,nurseName: demoNurse.name,complaintIdent: ['Headache','Cough','Stomach pain','Fever','Follow-up check'][i],complaintNotes: `${marker} Sample visit for preview only.`,medication:['Water and rest','None','Oral rehydration','Paracetamol','None'][i],severity:['mild','normal','mild','severe','mild'][i],frequency:1,duration:[1,2,1,3,0][i],started,...([0,2,3].includes(i)?{}:{ended:new Date(started.getTime()+3600000)}),sicknesses:{connectOrCreate:[{where:{name:['headache','cough','stomach ache','fever','follow-up'][i]},create:{name:['headache','cough','stomach ache','fever','follow-up'][i]}}]}}});
      }
    }
    const shiftStart = new Date(now.getTime()-4*3600000);
    await prisma.shift.upsert({where:{id:-987654},create:{nurseId:demoNurse.id,nurseName:demoNurse.name,startTime:shiftStart},update:{}}).catch(async()=>{
      if (!await prisma.shift.findFirst({where:{nurseId:demoNurse.id,endTime:null}})) await prisma.shift.create({data:{nurseId:demoNurse.id,nurseName:demoNurse.name,startTime:shiftStart}});
    });
    console.log(`Demo data ready. Nurse sign-in: ${email} / DemoNurse123! (demo records are marked [DEMO]). Clear with: npm run demo:clear`);
  }
} finally { await prisma.$disconnect(); }
