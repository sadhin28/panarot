# Pan Arot Pro

বাংলা-ভিত্তিক পান আরত Business Management ERP-এর React + TypeScript + Supabase starter project.

## বর্তমান Build Status

এই project snapshot-এ রয়েছে:
- Responsive Bengali ERP shell: sidebar, header, dashboard, chart, recent transaction and balance overview.
- Buyer/Seller list, search and add form (demo state; Supabase insert enabled after configuration).
- Supabase email/password sign-in UI.
- PostgreSQL migration with core parties, purchase/sales, payments, stock, expense, income, profit share, ledger, closing, notifications and audit tables.
- Role-aware base schema and RLS policies.
- CSV export for Buyer/Seller list.

Dashboard summary/chart and recent transactions currently use sample/demo values. Purchase, sale, payment, stock reconciliation, accounting posting, Bengali PDF generation, staff permission UI and production reporting are not yet fully wired. Do not use demo figures for actual business bookkeeping. Continue the implementation before production use.

## Run locally

1. Install Node.js 20+ and npm.
2. Extract project zip and open its directory in terminal.
3. Run:

```bash
npm install
npm run dev
```

4. Visit the Vite URL shown in terminal.

## Connect Supabase

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/migrations/0001_pan_arot_schema.sql`.
3. Copy `.env.example` to `.env` and enter the Project URL and anon/public key:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. Create the owner account through Supabase Authentication (email/password).
5. Promote the first owner to admin from SQL Editor. Replace the account email:

```sql
update public.profiles
set role = 'admin', full_name = 'Arot Admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

6. Create employee users in Supabase Auth. Their profiles are created by trigger with `employee` role. Review and test all RLS policies before storing real customer/financial data.
7. Restart Vite after changing `.env`.

## Notes

- Never place the Supabase service-role key in `.env` variables prefixed with `VITE_` or in frontend code.
- Current application is a development starter, not a fully audited financial product.
- Verify accounting formulas and stock handling with the Arot owner before production deployment.
- Add scheduled Supabase backups and test restore procedures for long-term records.
