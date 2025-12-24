/*
  Warnings:

  - You are about to drop the `StudentRecord` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `role` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `adminId` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Nurse` table. All the data in the column will be lost.
  - You are about to drop the column `endedAt` on the `Shift` table. All the data in the column will be lost.
  - Added the required column `adminCode` to the `Admin` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `Admin` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `studentId` to the `Complaint` table without a default value. This is not possible if the table is not empty.
  - Made the column `nurseId` on table `Complaint` required. This step will fail if there are existing NULL values in that column.
  - Made the column `adminId` on table `Nurse` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `startTime` to the `Shift` table without a default value. This is not possible if the table is not empty.
  - Made the column `nurseId` on table `Shift` required. This step will fail if there are existing NULL values in that column.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StudentRecord";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Student" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "height" REAL,
    "weight" REAL,
    "lastTetanus" DATETIME,
    "lastAntiMalaria" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Admin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "adminCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Admin" ("createdAt", "email", "id", "name", "password") SELECT "createdAt", "email", "id", "name", "password" FROM "Admin";
DROP TABLE "Admin";
ALTER TABLE "new_Admin" RENAME TO "Admin";
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
CREATE UNIQUE INDEX "Admin_adminCode_key" ON "Admin"("adminCode");
CREATE TABLE "new_Complaint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "nurseId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Complaint_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Complaint_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Nurse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Complaint" ("createdAt", "description", "id", "nurseId") SELECT "createdAt", "description", "id", "nurseId" FROM "Complaint";
DROP TABLE "Complaint";
ALTER TABLE "new_Complaint" RENAME TO "Complaint";
CREATE TABLE "new_Nurse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Nurse_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Nurse" ("adminId", "createdAt", "email", "id", "name", "password") SELECT "adminId", "createdAt", "email", "id", "name", "password" FROM "Nurse";
DROP TABLE "Nurse";
ALTER TABLE "new_Nurse" RENAME TO "Nurse";
CREATE UNIQUE INDEX "Nurse_email_key" ON "Nurse"("email");
CREATE TABLE "new_Shift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nurseId" INTEGER NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shift_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Nurse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Shift" ("createdAt", "id", "nurseId") SELECT "createdAt", "id", "nurseId" FROM "Shift";
DROP TABLE "Shift";
ALTER TABLE "new_Shift" RENAME TO "Shift";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
