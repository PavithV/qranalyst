<p align="center">
  <strong>Simple QR + Analytics</strong><br/>
  <sub>Trackbare QR-Codes · Short-URL-Redirects · Analytics · Auth · Billing</sub>
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

## Überblick

Full-Stack-MVP: Nutzer:innen erstellen QR-Codes, die über eine kurze URL (`/q/[id]`) weiterleiten. Jeder Scan wird geloggt; Analytics und Limits pro Plan sind vorgesehen.

## Kernfunktionen

| Bereich | Inhalt |
|--------|--------|
| **Auth** | Signup / Login (Supabase) |
| **QR** | Erstellen, Liste, Detail, Bearbeiten, Löschen |
| **API** | REST inkl. optional **API-Key** (`Bearer`) für u. a. `GET`/`POST /api/qrcodes` |
| **Redirects** | `GET /q/[id]` → 302 + Scan-Event |
| **Analytics** | Aggregation pro QR-Code |
| **Billing** | Stripe Checkout + Webhook → `subscriptions` + Limits |
| **Product Analytics** | PostHog (Client + Server wo angebunden) |

## Lokale Entwicklung

```bash
npm install
cp .env.example .env.local   # falls vorhanden; sonst Variablen manuell setzen
npx prisma generate
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## Environment-Variablen

| Variable | Woher / Zweck |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Project Settings → API** → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dasselbe → `anon` **public** key |
| `SUPABASE_SERVICE_ROLE_KEY` | Dasselbe → `service_role` (**geheim**, nur Server) |
| `DATABASE_URL` | Supabase → **Project Settings → Database** → Connection string (Pooler empfohlen für Serverless) |
| `DIRECT_URL` | Optional: direkter Postgres-Port für Migrationen (siehe Prisma + Supabase-Docs) |
| `APP_URL` | Öffentliche App-URL, z. B. `https://dein-projekt.vercel.app` (Stripe Redirects) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → Project → **Project API Key** |
| `NEXT_PUBLIC_POSTHOG_HOST` | z. B. `https://eu.posthog.com` oder Self-Host-URL |

### Stripe (Checkout + Webhook)

Im [Stripe Dashboard](https://dashboard.stripe.com/) (für Tests: **Testmodus** einschalten):

| Variable | Woher |
|----------|--------|
| **`STRIPE_SECRET_KEY`** | **Developers → API keys** → **Secret key** (`sk_test_…` / `sk_live_…`) |
| **`STRIPE_WEBHOOK_SECRET`** | **Developers → Webhooks** → Endpoint anlegen → **Signing secret** (`whsec_…`) |
| **`STRIPE_PRICE_ID_STARTER`** | **Product catalog** → Produkt **Starter** → **Price** anlegen (Subscription) → Price-ID kopieren (`price_…`) |
| **`STRIPE_PRICE_ID_PRO`** | Wie oben für **Pro** |

**Webhook-URL (Production):**

`https://<DEINE_DOMAIN>/api/stripe/webhook`

Empfohlene Events (mindestens): `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

> **Hinweis:** Im Code werden aktuell **`STRIPE_PRICE_ID_STARTER`** und **`STRIPE_PRICE_ID_PRO`** genutzt. Der Free-Plan läuft ohne Stripe-Preis. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` und `STRIPE_PRICE_ID_FREE` aus dem Projekt-Brief sind für dieses MVP **nicht zwingend** verdrahtet (Checkout läuft serverseitig per Secret Key).

Alle genannten Keys in **Vercel → Settings → Environment Variables** setzen und neu deployen.

## Wichtige API-Routen

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| `GET` | `/api/health` | Healthcheck |
| `GET`/`POST` | `/api/qrcodes` | Session-Cookie oder `Authorization: Bearer <API-Key>` |
| `GET`/`PATCH`/`DELETE` | `/api/qrcodes/[id]` | Authentifiziert (Session) |
| `GET` | `/api/analytics/[id]` | Analytics |
| `POST` | `/api/billing/create-checkout-session` | Stripe Checkout starten |
| `POST` | `/api/stripe/webhook` | Stripe Webhooks |
| `GET` | `/q/[id]` | Öffentlicher Redirect |

API-Keys verwalten: Dashboard **Entwickler** (`/dashboard/developer`).

## Deployment

- **Vercel**: Repo verbinden, Env-Variablen setzen, Production-Deploy.
- **Datenbank**: Supabase-Migrationen / SQL wie in `prisma/migrations/` dokumentiert anwenden.

## Roadmap (aus Projekt-Brief – was noch „nice“ wäre)

- [ ] Kampagne / Gruppierung ausbauen  
- [ ] Geo- & Geräte-Breakdown verfeinern  
- [ ] CSV-Export  
- [ ] Team-Accounts  
- [ ] Supabase **Storage** für QR-Bilder/Logos (aktuell u. a. Data-URL-Generierung)  
- [ ] API-Key optional für weitere Routen (`PATCH`/`DELETE`/`analytics`)  
- [ ] PostHog: alle im Brief genannten Server-Events konsistent prüfen  

Siehe auch `simple-qr-analytics-cursor-brief.md` für die vollständige Spezifikation.

## Lizenz

Private / wie im Repository festgelegt.
