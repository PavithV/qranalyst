<p align="center">
  <strong>Simple QR + Analytics</strong><br/>
  <sub>Trackable QR codes · Short-URL redirects · Analytics · Auth · Billing</sub>
</p>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /></a>
</p>

<p align="center">
  <a href="https://vercel.com/"><img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" /></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" /></a>
  <a href="https://stripe.com/"><img src="https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe" /></a>
  <a href="https://posthog.com/"><img src="https://img.shields.io/badge/PostHog-000000?style=for-the-badge&logo=posthog&logoColor=white" alt="PostHog" /></a>
</p>

<p align="center">
  <a href="https://zod.dev/"><img src="https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white" alt="Zod" /></a>
  <img src="https://img.shields.io/badge/shadcn%2Fui-000000?style=flat-square&logo=shadcnui&logoColor=white" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

---

## Overview

Full-stack MVP: users create QR codes that redirect via a short URL (`/q/[id]`). Each scan is logged; analytics and per-plan limits are supported.

## Core features

| Area | What’s included |
|------|-----------------|
| **Auth** | Sign up / sign in (Supabase) |
| **QR** | Create, list, detail, edit, delete |
| **API** | REST, including optional **API key** (`Bearer`) for e.g. `GET`/`POST /api/qrcodes` |
| **Redirects** | `GET /q/[id]` → 302 + scan event |
| **Analytics** | Aggregation per QR code |
| **Billing** | Stripe Checkout + webhook → `subscriptions` + limits |
| **Product analytics** | PostHog (client + server where wired) |

## Local development

```bash
npm install
cp .env.example .env.local   # if present; otherwise set variables manually
npx prisma generate
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## Environment variables

| Variable | Source / purpose |
|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Project Settings → API** → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same → `anon` **public** key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same → `service_role` (**secret**, server only) |
| `DATABASE_URL` | Supabase → **Project Settings → Database** → connection string (pooler recommended for serverless) |
| `DIRECT_URL` | Optional: direct Postgres port for migrations (see Prisma + Supabase docs) |
| `APP_URL` | Public app URL, e.g. `https://your-project.vercel.app` (Stripe redirects) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → Project → **Project API Key** |
| `NEXT_PUBLIC_POSTHOG_HOST` | e.g. `https://eu.posthog.com` or your self-hosted URL |

### Stripe (Checkout + webhook)

In the [Stripe Dashboard](https://dashboard.stripe.com/) (for testing, enable **Test mode**):

| Variable | Where to find it |
|----------|------------------|
| **`STRIPE_SECRET_KEY`** | **Developers → API keys** → **Secret key** (`sk_test_…` / `sk_live_…`) |
| **`STRIPE_WEBHOOK_SECRET`** | **Developers → Webhooks** → create endpoint → **Signing secret** (`whsec_…`) |
| **`STRIPE_PRICE_ID_STARTER`** | **Product catalog** → **Starter** product → create **Price** (subscription) → copy Price ID (`price_…`) |
| **`STRIPE_PRICE_ID_PRO`** | Same as above for **Pro** |

**Webhook URL (production):**

`https://<YOUR_DOMAIN>/api/stripe/webhook`

Recommended events (at minimum): `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

> **Note:** The codebase currently uses **`STRIPE_PRICE_ID_STARTER`** and **`STRIPE_PRICE_ID_PRO`**. The free plan does not use a Stripe price. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_PRICE_ID_FREE` from the project brief are **not required** for this MVP (Checkout runs server-side with the secret key).

Set all keys in **Vercel → Settings → Environment Variables** and redeploy.

## Key API routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET`/`POST` | `/api/qrcodes` | Session cookie or `Authorization: Bearer <API-Key>` |
| `GET`/`PATCH`/`DELETE` | `/api/qrcodes/[id]` | Authenticated (session) |
| `GET` | `/api/analytics/[id]` | Analytics |
| `POST` | `/api/billing/create-checkout-session` | Start Stripe Checkout |
| `POST` | `/api/stripe/webhook` | Stripe webhooks |
| `GET` | `/q/[id]` | Public redirect |

Manage API keys: dashboard **Developer** (`/dashboard/developer`). **One API key per account.**

### Plan limits (summary)

| Plan | API (`Bearer` on `/api/qrcodes`) | Scans / month (redirect logging) | Active QR codes |
|------|----------------------------------|----------------------------------|-----------------|
| **FREE** | 10 / calendar month | 1,000 | 10 |
| **STARTER** | 5,000 / month | 10,000 | 50 |
| **PRO** | 100,000 / month | 100,000 | 200 |

- **Monthly API quota** applies only to requests using **`Authorization: Bearer`** (not the logged-in browser session).
- **Scans per month:** each hit to `GET /q/[id]` counts toward **storing** a row in `scan_events` (analytics). If the user exceeds the monthly scan limit, the **redirect (302) still works** — new scan events are simply **not recorded** until the next month (analytics appear “frozen”).

Apply the SQL migration that creates `api_monthly_usage` (see `prisma/migrations/`) so monthly API usage can be persisted.

## Deployment

- **Vercel**: connect the repo, set env vars, deploy to production.
- **Database**: apply Supabase migrations / SQL as documented in `prisma/migrations/`.

## Roadmap (from project brief — nice-to-haves)

- [ ] Expand campaigns / grouping  
- [ ] Refine geo & device breakdowns  
- [ ] CSV export  
- [ ] Team accounts  
- [ ] Supabase **Storage** for QR images/logos (currently includes data-URL generation)  
- [ ] Optional API key for more routes (`PATCH`/`DELETE`/`analytics`)  
- [ ] PostHog: align all server events mentioned in the brief  

See `simple-qr-analytics-cursor-brief.md` for the full specification.

## License

Private / as defined in this repository.
