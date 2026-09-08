# Ontario Tech FBIT Tracker

Production-oriented React and Supabase implementation of the FBIT academic operations tracker. The original `prototype.tsx` remains in the repository as the visual reference.

## Run the UI

```bash
npm install
copy .env.example .env.local
npm run dev
```

`VITE_DEMO_MODE=true` uses fictional in-memory records. Set it to `false` and use the URL and publishable key printed by the Supabase CLI to exercise the full backend.

The public home page at `/` lets assigned faculty submit final grades without signing in. The authenticated operations dashboard is at `/dashboard`; staff authentication begins at `/login`.

Authenticated users can create personal tracker templates under `/settings`. Deans can also publish faculty templates for every active user and upload or edit an academic year's important dates. Template stages store day offsets from an anchor date, so applying a template creates the same workflow with a newly calculated schedule.

## Run Supabase locally

Docker Desktop must be running.

```bash
npm run supabase:start
npm run db:reset
npm run db:test
```

Local Studio is available at `http://127.0.0.1:55323`. This project uses the 5532x port range to avoid colliding with other local Supabase projects. Never expose the local stack to external traffic.

## Security and privacy

- The browser validates grade CSV and Excel files and sends only numeric grades; student names, IDs, raw files, and original filenames are never transmitted or persisted.
- Public submissions use the narrowly scoped `submit_public_grade_upload` RPC. Direct anonymous table access is revoked. Existing courses require an active instructor assignment; genuinely new course codes require an exact active faculty name/email match before the course and assignment are created. Each course/email is limited to five replacement submissions per hour.
- Every exposed table has RLS. Role checks use server-controlled profile records and organizational scopes.
- The `manage-user` Edge Function is the only app path using the Supabase secret key and re-checks that the caller is an active Dean.
- Stage documents are private and restricted to PDF, DOC, and DOCX files up to 10 MB.
- Each tracker stage can also hold multiple named HTTP/HTTPS links. Links open directly from the detailed checklist and can be removed individually by users who can manage the tracker.

Grade uploads accept `.csv` files and the first worksheet of `.xlsx` files. The instructor workbook uses these headers: `Semester ID`, `Course Code`, `Last Name`, `First Name`, `Student ID`, `Final Grade (%)`, `Final Letter Grade`. CSV exports that use `Section` instead of `First Name` are also accepted. The file's semester selects the destination term and accepts labels such as `W26`, `W2026`, `Winter 2026`, `F26`, `F2026`, and `Fall 2026` (plus equivalent Spring/Summer labels and official numeric semester IDs). Grade Analytics provides a CSV template pre-filled with the selected term, lets deans and academic directors create terms, and lets authorized course submitters delete a selected course's upload history and derived analytics for the selected term without removing its course assignment.

Course codes are inferred as four letters, four numbers, and an optional `U` or `G`. Spacing is ignored and an omitted suffix defaults to undergraduate, so `BUSI1100`, `BUSI 1100`, `BUSI1100U`, and `BUSI 1100U` resolve to the same course. If the canonical code is absent, an authorized upload adds the course and current-term assignment. Identical grade data for that course and term is treated as a duplicate and does not create another upload version.

Important-date imports accept the first worksheet of an `.xlsx` file. `Fall semester`, `Winter semester`, and `Spring/Summer semester` rows switch the active semester. Each description becomes a separately managed event; a blank date cell inherits the last explicit date or date range, and the importer generates an editable representative short name.

Because the public flow intentionally has no authentication, matching a name and email to a course assignment does not cryptographically prove the submitter's identity. Before an Internet-facing launch, pair the existing controls with an institution-approved verification step such as an emailed one-time link and bot protection.

Before production use, configure hosted Supabase Auth URLs/SMTP, review institutional data-retention requirements, run database advisors, run all tests, and perform role-specific smoke tests.
