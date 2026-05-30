# meta_google_integrations

Multi-tenant CRM SaaS integrations for **Meta** (Facebook Pages, Instagram Business) and **Google** (Calendar, Meet, optional Gmail).

## Stack

- Next.js 15 (App Router) + TypeScript
- Supabase PostgreSQL + Auth
- Sentry
- Encrypted server-side OAuth tokens

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Apply Supabase migrations from `supabase/migrations/`.

See `docs/integrations-audit.md` for architecture and `docs/meta-integration-setup.md` / `docs/google-integration-setup.md` for provider setup.
