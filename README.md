# Thryve

Thryve helps a school health office keep student health records, visit notes, and nurse shifts in one place. It is designed for the school nurse and the person managing the health office.

## What you can do

- Find a student or add and update their record.
- Record a visit, including the complaint, notes, medication, and severity.
- See past visits and mark a case as resolved.
- Clock in and out, and review shift records.
- View a summary of visits, open cases, and common illnesses.

## Opening Thryve

Someone responsible for the school's computer will need to install and start Thryve first. Once it is running:

1. Open a web browser such as Chrome or Safari.
2. Go to **http://localhost:3000** if you are on the same computer as Thryve. If it is running on another school computer, ask your administrator for its web address.
3. Choose the **Nurse** or **Matron** sign-in page.
4. Enter the username or email and password your administrator gave you.

There is no shared starter password. If you cannot sign in, ask your administrator to check your account or reset your access.

## Everyday use

**Find a student:** Choose **Student records**, then search by the student's name or class. Open the student record to see their details and visit history.

**Add a student:** Choose **Add student**, enter the details you have, and save. Height, weight, and treatment dates can be left blank if you do not have them.

**Record a visit:** Open the student's record and complete **Record a health visit**. Add the main complaint and your notes. You can include illness names separated by commas. Save the visit to add it to the student's history and the dashboard.

**Close a case:** From the visit in the student's history, choose **Mark resolved** when the case is resolved. The visit remains in the student's record.

**Track a shift:** Nurses can open **My shifts** and use **Clock in** or **Clock out**. Signing out ends an open shift. If you close the browser without signing out, ask the matron to review the shift.

**Review activity:** The overview shows recent visits and open cases. Choose **Analytics** to change the date range and see visit counts and trends. These reports summarize recorded visits; they are not diagnoses.

## Installing or updating Thryve

These steps are for the person who manages the computer. They require Node.js 20 or newer and npm. Open Terminal (Mac) or Command Prompt (Windows), go to the Thryve project folder, then run:

```sh
npm ci
npm run db:setup
npm start
```

Keep that window open while the website is in use. On that computer, open **http://localhost:3000** in a browser. To stop Thryve, return to the Terminal or Command Prompt and press **Ctrl+C**.

The database is stored in `prisma/thryve.db`. Before setup changes an existing database, it makes a dated backup beside the database. Keep that database and its backups safe; they contain student records. Do not delete the database or run database reset commands to troubleshoot a problem.

For a stable sign-in session between restarts, the administrator can set a private `SESSION_SECRET`. Optional settings are listed in `.env.example`. A `.env` file is not loaded automatically by `npm start`; with Node.js 20.6 or newer, start with `node --env-file=.env app.js` to load it.

## Sample data

To preview the screens with clearly marked sample students and visits, an administrator account must already exist. Run:

```sh
npm run demo:seed
```

The sample nurse sign-in is `demo.nurse@thryve.test` with password `DemoNurse123!`. Sample records are labeled `[DEMO]`. Remove only the sample records with:

```sh
npm run demo:clear
```

## Checks for developers

Run `npm test` to check the main sign-in, student, visit, shift, and reporting workflows. The tests use a temporary database and do not change the school's records.
