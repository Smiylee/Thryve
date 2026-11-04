
# Thryve HealthBay

A digital healthbay management system for schools.

## Features
- Role-based access (Admin, Nurse)
- Nurse shift tracking
- Student bio & health records
- Complaint logging
- Medication schedules & daily records
- Tetanus & Anti-malaria tracking

## Tech Stack
- Node.js
- Express
- Prisma
- SQLite
- EJS

## Why I Built This
I built Thryve to replace the paper-based healthbay system in my school...

## Running this version

Requires Node.js 20+ and npm. From the project directory:

```sh
npm ci
npm run db:setup
npm start
```

Open http://localhost:3000. The default database is `prisma/thryve.db`.
For a stable session across restarts, set `SESSION_SECRET` in your shell to a long random value.
You can also set `DATABASE_URL` and `PORT`; see `.env.example`. To load a `.env` file into the app with Node 20.6+, use `node --env-file=.env app.js` (plain `npm start` does not load it).

`db:setup` initializes an empty database or performs an additive upgrade of the supplied database. It creates a timestamped SQLite backup before changing an existing database, adds shift validation metadata, closes legacy duplicate open shifts at the next recorded login time, and installs a unique index allowing only one open shift per nurse. Run this before starting the updated app. Do not reset your existing database or replay the old historical migrations: those migrations do not match the supplied database's current schema. Use `db:setup` again after any `prisma db push` operation to ensure the partial unique index is present.

## Completed workflows

- **Shifts:** nurse login starts one shift, repeated logins reuse it, and clock-out ends it. The matron sees their team's active/completed shifts, can end a forgotten shift, and validates completed records. Validation stores the matron ID and time. Closing a tab or expiring a session does not end attendance; the matron must review forgotten shifts. An open shift is not proof that someone is currently online.
- **Students:** authenticated staff can search, create, and edit student profiles, including optional measurements and treatment dates. Nurses record health visits and mark cases resolved; history remains attached to the student.
- **Analytics:** 7/30/90-day views show visit counts, distinct students seen, open cases from the selected period, daily UTC trends, illness counts, severity, and recent visits. Multi-illness visits count once per illness. These are recorded complaints, not confirmed diagnoses or a population disease rate.
- **Access:** matron routes require an admin session; nurse visit authorship comes from the session. Password verification is awaited, new passwords are hashed, and legacy plaintext nurse passwords upgrade on successful login.

This application's existing student registry is shared across authenticated staff in a single school. Matron nurse and shift lists are scoped to their assigned team. It does not implement separate school tenants.

## Regression checks

```sh
npm test
```

The workflow test uses an isolated temporary database and checks authentication, duplicate logins, shift permissions, student creation/editing, visit authorship, page rendering, analytics, resolution, clock-out, and validation. It does not alter the school's database. `npm run test:unit` runs only pure validation and analytics tests.

Run these checks after future changes to catch missing features. A failed check reports the regression; it does not automatically rewrite production code or data.
