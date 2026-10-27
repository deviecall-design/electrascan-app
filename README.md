# ElectraScan

AI electrical takeoff and estimating for Australian contractors. Upload a PDF floor plan, review the symbols ElectraScan detects, price them from the rate library, and save a GST quote. Vesh Electrical is the beta tenant.

The app is a Vite + React single-page app. Production deploys from `main` to [electrascan-app.vercel.app](https://electrascan-app.vercel.app/).

## What a scan does

1. **Upload plan** — drop a PDF or PNG. Detection runs through `/api/detect` (Claude) and falls back to the browser key only when the server key is missing.
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

Open http://localhost:3000. Sign in with a Supabase user (`/login`). Without a session you can look around, but scans and quotes will not save.

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
| `SUPABASE_URL` | `/api/detect`, `/api/estimates/create` | Server checks. Defaults to the project URL if unset. |
| `SUPABASE_ANON_KEY` | Those API routes | Verifying the caller. Defaults to the publishable key in source if unset. |
| `ANTHROPIC_API_KEY` | `/api/detect` only. **Not** `VITE_` prefixed. | Symbol detection without putting the key in the JS bundle. **Not set in production today** — `/api/detect` returns 500 and the app falls back to `VITE_ANTHROPIC_API_KEY`. |
| `VITE_ANTHROPIC_API_KEY` | Browser fallback | Keep until `ANTHROPIC_API_KEY` is set, then remove it so the key is not shipped to clients. |
| `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_BASE_URI`, `DOCUSIGN_ACCESS_TOKEN` or `DOCUSIGN_PRIVATE_KEY` | DocuSign routes | Sending an envelope. Approvals still list real estimates when these are empty; Send will toast the API error. |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI` | `/api/xero/*` | Xero connect. Optional for the takeoff flow. |

`VITE_` variables are inlined into the public bundle. Do not put the Anthropic secret or the DocuSign private key behind a `VITE_` name.

## Database

Apply the SQL in `supabase/migrations/`, including `20261027143000_tenant_invites.sql`:

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

1. Sign in at `/login`.
2. Dashboard shows real counts or the empty states “No scans yet” / “No estimates yet”. It should not stay on “Loading your pipeline…”, and it should not list Mark Arnesen, Bondi, or Toorak sample rows.
3. New scan → upload a PDF. When detection finishes, the review table lists those symbols. Refresh the page: the same scan opens from `/detection/:id` with the same lines.
4. Build estimate → save. The quote appears under Estimates and in Pending value.
5. Project reports lists that quote. Submit claim. If the insert fails, the milestone stays Pending.
6. Variations stays empty until two saved quotes have line items, then diffs those lines.
7. Sign in as an email that is not on `tenant_invites`. Dashboard shows the fictional Harbour & Co demo, not Vesh’s jobs. Settings → Workspace access does not list Vesh’s invites.
