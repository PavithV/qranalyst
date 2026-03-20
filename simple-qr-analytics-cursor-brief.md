# Cursor Project Brief — Simple QR + Analytics

## Goal

Build a minimal, production-ready SaaS/API for generating **trackable QR codes** and viewing basic analytics.

The app must support:
- QR code creation via API
- Redirect + scan tracking
- Simple analytics per QR code and campaign
- Basic auth / ownership
- Billing via Stripe
- Product + usage tracking via PostHog
- Deployment on Vercel
- Database on Supabase Postgres

## Recommended stack

- **Framework:** Next.js (App Router) + TypeScript
- **Hosting:** Vercel
- **Database:** Supabase Postgres
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage for QR images and optional logos
- **Billing:** Stripe Checkout + webhooks
- **Product analytics:** PostHog
- **UI:** Tailwind + shadcn/ui
- **QR generation:** server-side QR library
- **Validation:** Zod
- **ORM / DB access:** Prisma or Drizzle (pick one and use consistently)

## Product idea

Businesses create QR codes that always point to a short URL like:

`https://your-domain.com/q/abc123`

When scanned:
1. The redirect endpoint logs the event
2. The request is redirected to the final target URL
3. Analytics are aggregated from scan events

## MVP scope

### Must-have
- Sign up / sign in
- Create QR code
- Store QR code metadata in DB
- Generate QR image
- Redirect endpoint
- Log scan events
- Analytics endpoint + simple dashboard
- Stripe subscription
- PostHog tracking for product usage

### Nice-to-have later
- Campaign grouping
- Editable target URL
- Custom colors / logo overlay
- Geo and device breakdown
- CSV export
- Team accounts

---

## Core user flows

### 1) Create QR code
Input:
- `target_url`
- `label` optional
- `campaign` optional
- `color` optional
- `logo_url` optional

Backend:
- create short ID
- store record
- generate QR image that encodes short URL
- return QR image URL + short URL + record ID

### 2) Scan / redirect
Route:
- `GET /q/[id]`

Behavior:
- look up QR code by ID
- log a scan event with timestamp, IP, user agent, referrer if available
- redirect with HTTP 302 to target URL

### 3) View analytics
Route:
- `GET /api/analytics/:id`

Return:
- total scans
- scans by day
- scans by country
- scans by device
- unique scanners (approximate)

### 4) Billing
- Free tier with strict limits
- Paid subscription via Stripe Checkout
- Stripe webhook updates subscription status in DB

---

## Database schema

Use Postgres tables like this:

### `profiles`
- `id` uuid primary key
- `email` text
- `created_at` timestamptz

### `projects`
- `id` uuid primary key
- `user_id` uuid references profiles(id)
- `name` text
- `created_at` timestamptz

### `qr_codes`
- `id` text primary key
- `user_id` uuid references profiles(id)
- `project_id` uuid nullable
- `target_url` text not null
- `label` text nullable
- `campaign` text nullable
- `color` text nullable
- `logo_url` text nullable
- `is_active` boolean default true
- `created_at` timestamptz
- `updated_at` timestamptz

### `scan_events`
- `id` uuid primary key
- `qr_code_id` text references qr_codes(id)
- `user_agent` text nullable
- `referrer` text nullable
- `ip_hash` text nullable
- `country_code` text nullable
- `device_type` text nullable
- `os_name` text nullable
- `created_at` timestamptz

### `subscriptions`
- `id` uuid primary key
- `user_id` uuid references profiles(id)
- `stripe_customer_id` text nullable
- `stripe_subscription_id` text nullable
- `plan` text
- `status` text
- `current_period_end` timestamptz nullable
- `created_at` timestamptz
- `updated_at` timestamptz

### `usage_limits`
- `user_id` uuid primary key
- `qr_code_limit` int
- `monthly_scan_limit` int
- `analytics_retention_days` int

---

## API routes

### Public
- `GET /q/[id]` → redirect endpoint
- `POST /api/stripe/webhook` → Stripe webhook

### Authenticated
- `POST /api/qrcodes`
- `GET /api/qrcodes`
- `GET /api/qrcodes/[id]`
- `PATCH /api/qrcodes/[id]`
- `DELETE /api/qrcodes/[id]`
- `GET /api/analytics/[id]`
- `GET /api/account`
- `POST /api/billing/create-checkout-session`

### Health / internal
- `GET /api/health`

---

## Required environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_ID_FREE=
STRIPE_PRICE_ID_STARTER=
STRIPE_PRICE_ID_PRO=

NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=

APP_URL=
```

---

## PostHog requirements

Track both product usage and important business events.

### Client-side events
- `page_view`
- `signup_started`
- `signup_completed`
- `qrcode_create_clicked`
- `qrcode_created`
- `billing_started`
- `billing_completed`

### Server-side events
- `scan_redirected`
- `analytics_viewed`
- `stripe_checkout_completed`
- `subscription_upgraded`
- `subscription_canceled`

### Event properties
Include at least:
- `user_id`
- `project_id`
- `qr_code_id`
- `campaign`
- `plan`
- `source`
- `environment`

### Implementation note
Use PostHog in Next.js for client tracking and server tracking separately.
Do not rely only on client tracking for business-critical events.

---

## Stripe requirements

Use Stripe Checkout for subscriptions.

### Flow
1. User clicks upgrade
2. Create Checkout Session
3. Redirect to Stripe
4. Stripe sends webhook on success / update / cancel
5. Update `subscriptions` table

### Important events to handle
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### Billing logic
- Free plan: low limits
- Starter: moderate limits
- Pro: higher limits
- Enforce limits in the API layer

---

## Supabase requirements

Use Supabase for:
- Auth
- Postgres
- Storage for QR images
- Row Level Security

### Rules
- Users can only read/write their own QR codes
- Public redirect endpoint can read only the QR code needed for a redirect
- Scan events are inserted server-side only
- Stripe webhook uses service role key
- Never expose service role key to client code

---

## App structure suggestion

```txt
app/
  (marketing)/
    page.tsx
    pricing/page.tsx
  (auth)/
    login/page.tsx
    signup/page.tsx
  dashboard/
    page.tsx
    qrcodes/page.tsx
    qrcodes/[id]/page.tsx
    billing/page.tsx
  api/
    qrcodes/route.ts
    qrcodes/[id]/route.ts
    analytics/[id]/route.ts
    billing/create-checkout-session/route.ts
    stripe/webhook/route.ts
    health/route.ts
  q/[id]/route.ts

lib/
  supabase/
  stripe/
  posthog/
  qr/
  analytics/
  validation/
  rate-limit/

components/
  dashboard/
  qrcode/
  billing/
```

---

## Implementation rules for Cursor

- Prefer small, incremental changes
- Keep everything TypeScript
- Use server components where appropriate
- Use route handlers for API endpoints
- Validate all inputs with Zod
- Keep the redirect endpoint extremely fast
- Never block redirects on slow analytics work
- Insert scan events asynchronously if possible
- Add error handling and typed helpers
- Write clean, copy-paste-ready code
- Avoid unnecessary abstraction in MVP

---

## Acceptance criteria

The project is done for v1 when:

- a user can sign up and log in
- a user can create a QR code
- the QR code redirects to the correct target URL
- scan events are stored in the database
- analytics can be viewed for a code
- Stripe subscription works
- PostHog shows product events
- the app is deployed on Vercel

---

## Suggested build order

1. Bootstrap Next.js app
2. Add Supabase Auth
3. Add DB schema
4. Build QR create endpoint
5. Build redirect endpoint
6. Log scan events
7. Add analytics aggregation
8. Add dashboard UI
9. Add Stripe checkout + webhook
10. Add PostHog tracking
11. Deploy to Vercel

---

## Prompt for Cursor

You are working on a SaaS called **Simple QR + Analytics**.

Build a full-stack MVP using:
- Next.js App Router
- TypeScript
- Supabase Postgres + Auth + Storage
- Stripe subscriptions
- PostHog analytics
- Tailwind + shadcn/ui

The app should let authenticated users create dynamic QR codes that redirect through a short URL and log every scan before redirecting to the final destination. Store scan events in Postgres and display a minimal analytics dashboard.

Important requirements:
- Use route handlers for API logic
- Use Zod validation everywhere
- Use RLS in Supabase
- Use Stripe Checkout + webhook handling
- Track product usage in PostHog
- Keep the redirect endpoint fast
- Produce production-ready code
- Make the code easy to understand and iterate on

Start by scaffolding the app and implementing the database schema, auth, QR creation flow, redirect flow, analytics aggregation, billing integration, and PostHog tracking.

When in doubt:
- choose the simplest working solution
- avoid unnecessary abstractions
- keep the code minimal but production-minded
- preserve security boundaries between public routes, authenticated routes, and server-only secrets
