/*
  Warnings:

  - You are about to drop the column `shift` on the `Nurse` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Shift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nurseId" INTEGER,
    "endedAt" DATETIME NOT NULL,
    CONSTRAINT "Shift_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Nurse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Nurse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "adminId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Nurse_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Nurse" ("adminId", "createdAt", "email", "id", "name", "password", "phone") SELECT "adminId", "createdAt", "email", "id", "name", "password", "phone" FROM "Nurse";
DROP TABLE "Nurse";
ALTER TABLE "new_Nurse" RENAME TO "Nurse";
CREATE UNIQUE INDEX "Nurse_email_key" ON "Nurse"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
