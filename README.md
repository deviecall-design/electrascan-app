# ElectraScan

AI electrical takeoff and estimating for Australian contractors. Upload a PDF floor plan, review the symbols ElectraScan detects, price them from the rate library, and save a GST quote. Vesh Electrical is the beta tenant.

The app is a Vite + React single-page app. Production deploys from `main` to [electrascan-app.vercel.app](https://electrascan-app.vercel.app/).

## What a scan does

1. **Upload plan** — drop a PDF or PNG. Detection runs through `/api/detect`. The progress screen says ElectraScan is analysing. The browser key is used only when the server key is missing.
2. **Review takeoff** — each detected line is stored on the `scans` row and shown with a confidence badge. Confirm a line or flag it for a site check. The subtotal is the sum of priced lines.
3. **Price & send** — saving the quote writes an `estimates` row (`EST-YYMM-XXXX`, GST-inclusive `value`) and links it from the scan.
4. **Sign & order** — approvals sends that saved quote through DocuSign. It does not invent a sample job.

Dashboard, scans, estimates, variations, project reports, and approvals read those rows. Empty lists stay empty. They do not show sample clients.

A progress claim on a project report is marked invoiced-draft only after `milestone_claims` accepts the insert. A failed save leaves the milestone pending.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. With `AUTH_DISABLED` unset, the app opens in the Vesh Electrical workspace. No sign-in. Saving a scan or quote needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (the dev server serves `/api`).

```bash
npm test
npm run build
```

## Environment

Set these on the Vercel project `electrascan-app` (Production and Preview) and in `.env.local`.

| Name | Where it is read | Required for |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | All saved data. Already `https://zxeznkuodpseijkvjwxa.supabase.co`. |
| `VITE_SUPABASE_ANON_KEY` | Browser | All saved data. The publishable anon key. |
| `SUPABASE_URL` | `/api/detect`, `/api/estimates/create`, `/api/beta/*` | Server checks. Defaults to the project URL if unset. |
| `SUPABASE_ANON_KEY` | Signed-in API routes | Verifying the caller when login is on. Defaults to the publishable key in source if unset. |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/beta/*` only. **Not** `VITE_` prefixed. | Reading and writing the Vesh rate library, scans, and quotes while login is off. |
| `AUTH_DISABLED` | `/api/config` | Unset means the Vesh beta is on (no sign-in). Set to `false` and redeploy to require login. |
| `ANTHROPIC_API_KEY` | `/api/detect` only. **Not** `VITE_` prefixed. | Symbol detection without putting the key in the JS bundle. |
| `VITE_ANTHROPIC_API_KEY` | Browser fallback | Used only when the server key is missing. Remove it once `ANTHROPIC_API_KEY` is set. |
| `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_BASE_URI`, `DOCUSIGN_ACCESS_TOKEN` or `DOCUSIGN_PRIVATE_KEY` | DocuSign routes | Sending an envelope. Approvals still list real estimates when these are empty; Send will toast the API error. |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI` | `/api/xero/*` | Xero connect. Optional for the takeoff flow. |

`VITE_` variables are inlined into the public bundle. Do not put the detection secret, the service role key, or the DocuSign private key behind a `VITE_` name.

The product copy says ElectraScan AI. Provider and model names stay in server code and in the env var name above.

### Turn the Vesh beta on

No SQL. The rate library, scans, and quotes are still in Supabase. The anon key cannot see them (row-level security, and there is no `tenant_id` column on those tables yet), so an unsigned page looks empty. Nothing in this app deletes those rows.

1. Supabase Dashboard → project `zxeznkuodpseijkvjwxa` → Project Settings → API → copy the **service_role** secret. Direct page: `https://supabase.com/dashboard/project/zxeznkuodpseijkvjwxa/settings/api`
2. Vercel → project `electrascan-app` → Settings → Environment Variables. Add `SUPABASE_SERVICE_ROLE_KEY` for Production and Preview. Do not use a `VITE_` name.
3. Leave `AUTH_DISABLED` unset. Unset means login is off.
4. Redeploy. Open the app. It lands in Vesh Electrical. The rate library lists the saved rows. Upload a plan, review it, and save the quote. It shows under Estimates and on the dashboard.

To check which workspace a later login is in, after `AUTH_DISABLED=false`:

```sql
SELECT u.email, m.tenant_id, t.name, m.role
FROM public.tenant_memberships m
JOIN auth.users u ON u.id = m.user_id
JOIN public.tenants t ON t.id = m.tenant_id
WHERE u.email = 'you@example.com';
```

## Database

Do not run `20261027120000_scan_flow_and_claims.sql` or `20261027143000_tenant_invites.sql` for the beta. Those files are for when login is turned back on. The live database does not have `tenant_id` on `rate_library`, `scans`, or `estimates`, and it does not have `tenant_invites`. The beta routes work without them.

When you set `AUTH_DISABLED=false` and redeploy, apply the SQL in `supabase/migrations/`, including `20261027143000_tenant_invites.sql`:

```bash
npx supabase db push
```

Or paste the new file into the Supabase SQL editor for project `zxeznkuodpseijkvjwxa` after the earlier migrations.

Who can see which jobs:

- **Allowlist.** `tenant_invites` maps an email to one tenant and a role (`member` or `owner`). Only those emails join that tenant, and the role is the one on the row. It does not default to owner.
- **Everyone else** gets a private showcase workspace. A fictional Harbour & Co / Northbridge scan and quote are copied into that workspace so a demo is not empty. Those rows are stamped with the new tenant id. Row-level security (`tenant_id = get_tenant_id()`) hides them from Vesh and from every other login.
- A shared Demo tenant is not used. Every Lawrence & Hanson login would otherwise read every other visitor’s uploads.

Add a Vesh user in **Settings → Workspace access** while signed in as a Vesh owner, or in the SQL editor:

```sql
INSERT INTO public.tenant_invites (email, tenant_id, role)
VALUES (
  'name@veshelectrical.com.au',
  '00000000-0000-0000-0000-000000000001',
  'member'
)
ON CONFLICT (email) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      role = EXCLUDED.role;
```

Use `'owner'` only for someone who should manage that list. Do not put a Lawrence & Hanson address in Vesh’s list.

If an older `ensure_beta_membership()` already attached people to Vesh, remove them before the showcase. They keep that membership until you do, because provisioning does not move an existing member.

```sql
SELECT u.email, m.role, m.user_id
FROM public.tenant_memberships m
JOIN auth.users u ON u.id = m.user_id
WHERE m.tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM public.tenant_memberships
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND user_id = '<user uuid>';
```

`20261027120000_scan_flow_and_claims.sql` lets tenant members update scans, creates `milestone_claims`, and creates `approval_audit`. It does not grant Vesh access.

## Verify

1. Open the app with no sign-in. The sidebar says Vesh Electrical. The progress screen says “ElectraScan is analysing”, not a model name.
2. Rate library lists the saved Vesh rows. If the service role key is missing, the page says so and does not pretend the built-in catalogue is the uploaded library.
3. Dashboard shows those scans and quotes, or the empty states “No scans yet” / “No estimates yet”. It should not stay on “Loading your pipeline…”, and it should not list sample rows that were never saved.
4. New scan → upload a PDF. When detection finishes, the review table lists those symbols. Refresh the page: the same scan opens from `/detection/:id` with the same lines.
5. Build estimate → save. The quote appears under Estimates and in Pending value.
6. Project reports lists that quote. Submit claim. If the insert fails, the milestone stays Pending.
7. Variations stays empty until two saved quotes have line items, then diffs those lines.
8. After login is turned back on: sign in as an email that is not on `tenant_invites`. Dashboard shows the fictional Harbour & Co demo, not Vesh’s jobs.
