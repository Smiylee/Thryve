import { PrismaClient } from '@prisma/client';
process.env.DATABASE_URL ||= 'file:./thryve.db';
export const prisma = new PrismaClient();
