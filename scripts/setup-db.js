// Additive upgrade for existing installations; never resets or drops their data.
import { prisma } from '../lib/db.js';
import { spawnSync } from 'node:child_process';
import sqlite3 from 'sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name='Shift'");
  if (!tables.length) {
    await prisma.$disconnect();
    const result = spawnSync(process.execPath, [path.join(root,'node_modules/prisma/build/index.js'), 'db', 'push'], {cwd: root, stdio: 'inherit', env: process.env});
    if (result.status !== 0) throw new Error('Could not initialize database.');
  } else {
    const database = await prisma.$queryRawUnsafe('PRAGMA database_list');
    const filename = database.find(d => d.name === 'main').file;
    const backupPath = `${filename}.backup-${Date.now()}`;
    await new Promise((resolve,reject) => {
      const db = new sqlite3.Database(filename, sqlite3.OPEN_READONLY, error => {
        if (error) return reject(error);
        const backup = db.backup(backupPath);
        backup.step(-1, error => backup.finish(finishError => db.close(() => error || finishError ? reject(error || finishError) : resolve())));
      });
    });
    console.log(`Database backup saved to ${backupPath}`);
    const columns = await prisma.$queryRawUnsafe('PRAGMA table_info("Shift")');
    if (!columns.some(c => c.name === 'validatedAt')) await prisma.$executeRawUnsafe('ALTER TABLE "Shift" ADD COLUMN "validatedAt" DATETIME');
    if (!columns.some(c => c.name === 'validatedBy')) await prisma.$executeRawUnsafe('ALTER TABLE "Shift" ADD COLUMN "validatedBy" INTEGER');
  }
  // Preserve the newest open shift; end older duplicate records at the next login.
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`UPDATE "Shift" AS old SET "endTime" = (SELECT MIN(newer."startTime") FROM "Shift" AS newer WHERE newer."nurseId" = old."nurseId" AND newer."endTime" IS NULL AND (newer."startTime" > old."startTime" OR (newer."startTime" = old."startTime" AND newer."id" > old."id"))) WHERE old."endTime" IS NULL AND EXISTS (SELECT 1 FROM "Shift" AS newer WHERE newer."nurseId" = old."nurseId" AND newer."endTime" IS NULL AND (newer."startTime" > old."startTime" OR (newer."startTime" = old."startTime" AND newer."id" > old."id")))`);
    await tx.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Shift_one_open_per_nurse" ON "Shift"("nurseId") WHERE "endTime" IS NULL');
  });
  console.log('Database ready. Shift validation and duplicate-login protection installed.');
} finally { await prisma.$disconnect(); }
