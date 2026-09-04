# Ontario Tech FBIT Tracker

Production-oriented React and Supabase implementation of the FBIT academic operations tracker. The original `prototype.tsx` remains in the repository as the visual reference.

## Run the UI

```bash
npm install
copy .env.example .env.local
npm run dev
```

`VITE_DEMO_MODE=true` uses fictional in-memory records. Set it to `false` and use the URL and publishable key printed by the Supabase CLI to exercise the full backend.

## Run Supabase locally

Docker Desktop must be running.

```bash
npm run supabase:start
npm run db:reset
npm run db:test
```

Local Studio is available at `http://127.0.0.1:55323`. This project uses the 5532x port range to avoid colliding with other local Supabase projects. Never expose the local stack to external traffic.

## Security and privacy

- The browser validates grade CSV files and sends only numeric grades to `submit_grade_upload`; student names, IDs, raw files, and original filenames are never persisted.
- Every exposed table has RLS. Role checks use server-controlled profile records and organizational scopes.
- The `manage-user` Edge Function is the only app path using the Supabase secret key and re-checks that the caller is an active Dean.
- Stage documents are private and restricted to PDF, DOC, and DOCX files up to 10 MB.

Before production use, configure hosted Supabase Auth URLs/SMTP, review institutional data-retention requirements, run database advisors, run all tests, and perform role-specific smoke tests.
