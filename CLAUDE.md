# ElectraScan — Claude Code Rules

## Production Branch
**`feat/electrascan-desktop-v2` is the production branch. Vercel deploys it.**

## Non-Negotiable: Ship Before You Stop
Every session MUST end with work merged or PR'd to `feat/electrascan-desktop-v2`.

Do not close a session with completed work sitting on a sub-branch. If you built it, it ships.

End-of-session checklist:
1. Commit all work
2. Merge or PR to `feat/electrascan-desktop-v2`
3. Confirm Vercel deployment is green before closing

## Branch Strategy
- Production: `feat/electrascan-desktop-v2` → deploys to electrascan-app.vercel.app
- Feature work: branch off `feat/electrascan-desktop-v2`, merge back before session ends
- Do NOT commit to `main` — it is stale and not monitored

## Supabase
- Project ref: `zxeznkuodpseijkvjwxa`
- URL: https://zxeznkuodpseijkvjwxa.supabase.co
- Migrations live in `supabase/migrations/` — run `npx supabase db push` after schema changes
- Anon key is in `.env` (do not commit)

## Tenant
- Vesh Electrical is the beta tenant
- Tenant ID constant: `VESH_TENANT_ID` in `lib/tenants.ts`

## Product Roadmap (priority order)
### Sprint 2 — Accounting Integration
- **Xero** (priority) + **MYOB** (secondary) — both dominant in AU trade businesses
- Xero API docs: https://developer.xero.com/
- Key flows:
  - Push accepted estimates → Xero quotes/invoices (one click)
  - Sync customer/contact records (no duplicate entry)
  - Pull actual job costs back for margin tracking
  - Generate purchase orders from material takeoffs
- Frame as: "your estimate becomes your invoice in one click"
- Strong paid conversion differentiator for AU electrical contractors
