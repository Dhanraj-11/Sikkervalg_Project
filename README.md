# SikkerValg

**Sikker digital valggjennomføring** — a verifiable, tamper-evident election
platform for workplace elections (e.g. Norwegian *verneombud*/safety-rep or
board elections), built on Next.js and MongoDB.

SikkerValg runs the full election protocol end to end: a locked-down voter
roll, an independent three-person committee that must approve before voting
opens, anonymous weighted ballots recorded on an append-only hash chain, and
a digitally signed, court-ready *Valgprotokoll* (election record) once the
election closes.

## Why it's built this way

The core design problem in any digital election is that two things must
both be true and neither can undermine the other:

1. **Only eligible voters can vote, and only once.**
2. **No one — including the system operator — can ever tie a cast ballot
   back to the voter who cast it.**

SikkerValg's architecture is built specifically to keep those two
guarantees structurally separate:

- The `Voter` collection (identity) and `Ballot` collection (choice) share
  **no linking field** — a ballot row is structurally incapable of being
  joined back to whoever cast it.
- Voting writes token-consumption and ballot-creation in a single MongoDB
  **transaction**, so a request can never leave a voter "consumed" without a
  ballot existing, or vice versa.
- Votes land first in a staging collection and are periodically flushed into
  the real, publicly-verifiable ballot chain in **shuffled batches** by a
  cron job — so nobody watching the database in real time can correlate a
  voter-roll update with a new ballot by timestamp.
- Each ballot's hash chains from the previous ballot's hash
  (`hash = SHA256(prevHash + payload)`), forming an append-only ledger where
  tampering with any past ballot breaks every hash after it.
- Once an election closes, the tally is computed **exactly once** and
  frozen — no route ever exposes live/partial results while voting is open.
- The final result set (a signed PDF *Valgprotokoll*) is signed with an
  RSA-PSS keypair the moment it's first generated, and those exact bytes are
  stored and replayed forever after — the signature can never silently
  drift from what was first published, and anyone can verify it themselves
  via a public, unauthenticated endpoint.

## Election lifecycle

```
DRAFT ───────────────► ACTIVE ───────────────► CLOSED
 │                        │                        │
 │ HR creates election     │ voting links sent,      │ tally computed once,
 │ uploads voter roll      │ voters cast ballots      │ frozen forever
 │ adds candidates         │ (roll is now locked)     │ signed protocol PDF
 │ invites 3-person        │                          │ generated on request
 │ committee                │                          │
 │                          │                          │
 └─ needs ≥2 candidates,    └─ ends when HR closes     └─ voters can verify
    ≥1 voter, and 3/3          the election               their tracker ID
    committee approvals                                   was counted
    before it can activate
```

- **DRAFT** — HR sets up the org, election, candidates, and voter roll
  (CSV upload), and invites exactly three committee members (including HR)
  by email. Each invite is a single-use, high-entropy token — never the
  database `_id` — so HR itself cannot claim another member's seat.
- **ACTIVE** — flips automatically once all 3 committee members approve
  (and only once minimum candidate/voter counts are met). The voter roll is
  fingerprinted (`rollHash`) at this instant and fully locked. Voting links
  (single-use, time-boxed magic links) are then emailed to every voter.
- **CLOSED** — HR closes the election, which sweeps any ballots still in
  staging, computes the weighted tally exactly once, and freezes it. A
  signed PDF election record can then be generated and independently
  verified. Voters can look up their tracker ID from earlier to confirm
  their ballot is in the ledger — this lookup is intentionally disabled
  until close, so it can't be used to build a live running vote count.

## Feature highlights

- **Multi-sig committee approval** — an election can only go live once
  3 independently-invited committee members approve it.
- **Weighted, anonymous voting** — each voter has a statutory weight
  (0.5 or 1); ballots carry weight but never identity.
- **Hash-chained ballot ledger** — an insert-only, append-only chain
  (updates/deletes are rejected at the schema level).
- **De-anonymization guard** — a tally bucket of exactly one 0.5-weight
  ballot is trivially identifiable, so it's flagged and rounded rather than
  published as-is.
- **One-time voter tracker IDs** — shown once at vote time, verifiable
  after close via a public endpoint, without revealing anything else.
- **Signed, immutable Valgprotokoll** — an RSA-PSS-signed PDF election
  record with a publicly verifiable signature and hash.
- **Field-level email encryption** — voter emails are encrypted
  (AES-256-GCM) before they reach MongoDB, with a deterministic IV so
  duplicate-email checks still work without decrypting every row.
- **Automatic PII shredding** — a nightly cron job wipes voter PII (email,
  name, token) 30 days after an election closes, keeping only anonymous
  audit counts.
- **Rate limiting** — a Mongo-backed fixed-window limiter (serverless-safe;
  no shared in-process memory) on login, voting, committee joins, and
  tracker verification.
- **CSRF/cross-origin defense** — a middleware layer rejects any mutating
  request whose Origin/Referer doesn't exactly match the app's own origin.
- **Security headers** — strict CSP, HSTS, X-Frame-Options, and related
  headers are set on every response.
- **Honeypot field** on the public vote form to quietly drop bot/script
  submissions.

## Tech stack

- **Framework:** Next.js 14 (Pages Router)
- **Database:** MongoDB / Mongoose (requires a replica set — e.g. MongoDB
  Atlas — for multi-document transactions)
- **Auth:** JWT (with a `tokenVersion` field for instant "log out
  everywhere") + bcrypt password hashing
- **Email:** Resend (recommended for serverless) or SMTP/Nodemailer, with a
  console-log fallback in development
- **Validation:** Zod (for request payload and query schema safety)
- **PDF generation/signing:** PDFKit + Node's built-in `crypto` (RSA-PSS)
- **Scheduled jobs:** Vercel Cron (ballot flushing every 5 minutes, PII
  shredding nightly)

## Project structure

```
lib/            Core server logic: auth, crypto, field-level encryption,
                 rate limiting, ballot flushing, PDF signing, authorization
models/         Mongoose schemas (User, Organization, Election, Candidate,
                 Committee, Voter, Ballot, BallotStaging)
pages/api/      REST-style API routes (auth, org, election, committee,
                 voters, vote, verify, candidate, cron)
pages/          App pages: signup/login, dashboard, public vote flow,
                 committee join/approve, public tracker verification
components/     Shared UI components
middleware.js   Origin/CSRF enforcement for all /api/* mutating requests
```

## Getting started

### Prerequisites

- Node.js 18+
- A MongoDB **replica set** (MongoDB Atlas is the easiest option — it's a
  replica set by default; a bare standalone `mongod` will not support the
  transactions this app relies on)

### Setup

```bash
git clone <this-repo>
cd sikkervalg-final
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas (or other replica-set) connection string |
| `JWT_SECRET` | Long random string for signing auth tokens |
| `APP_URL` | Public origin of the app (used in emailed links and CORS enforcement) |
| `RESEND_API_KEY` / `RESEND_FROM` | Optional — email provider (omit in dev to log emails to the console instead) |
| `FIELD_ENCRYPTION_KEY` | `openssl rand -hex 32` — encrypts voter emails at rest |
| `PROTOCOL_SIGNING_PRIVATE_KEY_PEM` / `PROTOCOL_SIGNING_PUBLIC_KEY_PEM` | RSA keypair for signing the Valgprotokoll PDF — generate with `openssl genrsa 2048 \| tee private.pem \| openssl rsa -pubout -out public.pem`. In production these should come from a real key vault (KMS/Vault), not a plain env var. |
| `CRON_SECRET` | Shared bearer secret for the two `/api/cron/*` routes |

In development, omitting `RESEND_API_KEY`, `FIELD_ENCRYPTION_KEY`, or the
protocol signing keys falls back to insecure dev-only behavior (console-log
emails, a fixed dev encryption key, an ephemeral signing keypair) so the app
still runs locally. **In production, these are required** — the app will
refuse to start without them.

```bash
npm run dev
```

Visit `http://localhost:3000`.

### Deployment

The repo includes a `vercel.json` with two scheduled cron jobs
(`flush-ballots` every 5 minutes, `shred-pii` nightly at 03:00), so it's set
up to deploy directly to Vercel. Set all of the environment variables above
in your Vercel project settings, including `CRON_SECRET`, which Vercel Cron
will automatically attach as a bearer token when invoking the cron routes.

## Election committee

The committee is fixed at **3 people total**, one of whom should be HR,
plus 2 additional members — all 3 must approve before an election can go
live. See [`COMMITTEE.md`](./COMMITTEE.md) for details.

## Security notes

This project has had deliberate, extensive hardening applied — inline code
comments throughout `lib/` and `pages/api/` reference specific findings
(e.g. `BE-01`, `BE-14`, `FE-07`) with the reasoning behind each fix. A few
things worth knowing before deploying this for a real election:

- **Transactional Integrity:** The election close sequence (status update, sweeping staged votes, and computing tallies) runs within a single atomic transaction session to prevent race conditions and vote loss.
- **Limiter Concurrency Resilience:** The Mongo-backed rate limiter intercepts duplicate key insertion errors (code 11000) under concurrent loads and retries once to guarantee uptime.
- **Request Validation:** All mutating API routes validate bodies/queries with Zod schemas to block invalid data formats at the boundary.
- Multi-document transactions require a MongoDB **replica set**.
- Production **fails closed**: missing `FIELD_ENCRYPTION_KEY`,
  `PROTOCOL_SIGNING_*_PEM`, or an email provider will throw on startup
  rather than silently run insecurely.
- The signing/encryption keys should live in a real secrets manager (KMS,
  Vault) in production, not a plain `.env` file.
- Organization `verified` status is stored but not yet backed by a real
  Brønnøysundregistrene (Norwegian business registry) lookup — that
  integration is not wired up yet.
