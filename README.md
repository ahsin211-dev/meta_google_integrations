# Meta & Google CRM Integrations

Production-oriented OAuth integrations for a multi-tenant CRM: Meta (Facebook Login, Pages, Instagram Business) and Google (Calendar, Meet, optional Gmail).

## Quick start

```bash
cp .env.example .env
# Fill Supabase, Meta, Google, and TOKEN_ENCRYPTION_KEY

npm install
npm run dev
```

Apply the database migration in `supabase/migrations/001_integration_tables.sql` to your Supabase project.

For local API testing without Supabase Auth:

```bash
INTEGRATION_DEV_AUTH=true
# Send headers: x-workspace-id, x-user-id
```

## Documentation

| Doc | Audience |
|-----|----------|
| [docs/integrations-audit.md](docs/integrations-audit.md) | Engineering audit & checklist |
| [docs/meta-integration-setup.md](docs/meta-integration-setup.md) | Operators |
| [docs/google-integration-setup.md](docs/google-integration-setup.md) | Operators |
| [docs/customer-connection-guide.md](docs/customer-connection-guide.md) | Customers |
| [docs/app-review-readiness.md](docs/app-review-readiness.md) | Compliance / review |

## Architecture

- **Next.js App Router** API routes — OAuth and webhooks only on server
- **Supabase** — connections metadata with RLS; tokens denied to client roles
- **AES-256-GCM** — encrypted token storage via `TOKEN_ENCRYPTION_KEY`
- **Sentry** — breadcrumbs and error capture (no token values)

## UI

- [/settings/integrations/meta](http://localhost:3000/settings/integrations/meta)
- [/settings/integrations/google](http://localhost:3000/settings/integrations/google)

## Tests

```bash
npm test
```
