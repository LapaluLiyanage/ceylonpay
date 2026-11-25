# CeylonPay

A wallet and peer-to-peer payment API built with Spring Boot, backed by PostgreSQL, with a React frontend. Users register, deposit money into a wallet, send money to other users by phone number, and view their transaction history — all behind JWT authentication.

**Live:** [ceylonpay.vercel.app](https://ceylonpay.vercel.app) (frontend) · [ceylonpay-api.onrender.com](https://ceylonpay-api.onrender.com) (API)

> The API runs on a free-tier host that spins down after periods of inactivity — the first request after a while may take 20–30 seconds to wake up.

## Features

- **Authentication** — register and log in with a Sri Lankan phone number and password; stateless JWT sessions.
- **Wallet** — every account gets a wallet on registration; check balance, deposit funds.
- **Peer-to-peer transfer** — send money to any other user by phone number, with balance and self-transfer validation, executed atomically.
- **Transaction history** — a combined, direction-aware view of everything sent and received.
- **React frontend** — a full UI (Login, Register, Dashboard, Deposit, Transfer, History) wired to the API.

## Tech stack

**Backend:** Java 21 · Spring Boot 4.1.1 · Spring Security · Spring Data JPA / Hibernate · PostgreSQL · JJWT · Maven

**Frontend:** React 19 · Vite · React Router · Context API · Vitest

**Infrastructure:** Docker (multi-stage build) · Render (API + Postgres) · Vercel (frontend)

## Project structure

```
CeylonPay/
├── src/main/java/lk/ceylonpay/
│   ├── controller/     REST endpoints
│   ├── service/        business logic (auth, wallet, transfer)
│   ├── entity/          JPA entities (User, Wallet, Transaction, AuditLog)
│   ├── repository/      Spring Data JPA repositories
│   ├── security/        JWT generation/validation, auth filter
│   ├── config/           Spring Security config, global exception handling
│   ├── dto/              request/response records
│   └── exception/        domain-specific exceptions
├── src/test/java/lk/ceylonpay/   unit + integration tests
├── frontend/                      React app (Vite)
├── Dockerfile                     multi-stage backend build
├── docker-compose.yml            backend + Postgres for local dev
└── pom.xml
```

## API overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account and wallet |
| POST | `/api/auth/login` | — | Log in, receive a JWT |
| GET | `/api/wallet/balance` | ✓ | Current wallet balance |
| POST | `/api/wallet/deposit` | ✓ | Deposit funds |
| POST | `/api/transfer` | ✓ | Send money to another user by phone |
| GET | `/api/transactions` | ✓ | Transaction history (sent + received) |

Authenticated requests need `Authorization: Bearer <token>`.

## Running locally

### Prerequisites

- Java 21
- Maven
- PostgreSQL (or Docker)
- Node.js 18+ (for the frontend)

### Backend

Create a local `ceylonpay` PostgreSQL database, then:

```bash
mvn spring-boot:run
```

The schema is managed by Flyway (`src/main/resources/db/migration`) and applied automatically at startup; Hibernate only validates it. Defaults to `localhost:5432`, database `ceylonpay`, user/password `postgres` — see `src/main/resources/application.properties`. The API starts on port `8080`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Starts on `http://localhost:5173` and expects the API at `http://localhost:8080` (override with a `VITE_API_BASE_URL` environment variable).

### With Docker Compose

```bash
docker-compose up
```

Runs the API and a PostgreSQL instance together. Requires a `JWT_SECRET` environment variable to be set.

## Running tests

```bash
mvn test              # backend — JUnit 5 + Mockito, unit and integration tests
cd frontend && npm test   # frontend — Vitest
```

## Design notes

- **Money** is always `BigDecimal`, never a floating-point type — precision matters when the numbers are currency.
- **Transfers are atomic** — `@Transactional` ensures a transfer either fully succeeds (both balances updated, transaction and audit log recorded) or fully rolls back on any failure.
- **Access control is resource-scoped** — a user's JWT identifies them; every wallet/transaction lookup is implicitly scoped to that identity rather than gated by a separate permission check.
- **Configuration is environment-driven** — the same jar runs locally, in Docker, and on Render, with only environment variables changing between them (database connection, JWT secret, allowed CORS origins).

## Scam protection

- **Name check** — before sending, the app shows who owns the number (`K. Perera`).
- **My Safety** — freeze your wallet, or set your own daily and night (22:00–06:00) limits.
- **Scam Shield** — every transfer gets a 0–100 risk score from transparent rules (first payment to this number, much larger than usual, almost all of your balance, brand-new receiving account, receiver collecting from many people, and more). Below 40 it goes through, 40–74 the sender must confirm the warnings, 75+ the transfer is **held**: no money moves until an admin approves it (`/api/admin/reviews`) or the sender cancels it. Rules live in `risk/RiskService.java`.

- **Report and recover** — a sender can press *Report scam* on a completed transfer. The receiving account's outgoing money is put on hold immediately (the user can't lift it). A reviewer on the **Review** page (admins only) either upholds the report, which pulls back what the receiver still has as a new ledger counter-transfer (history is never edited) and flags the account in future risk scores, or dismisses it and lifts the hold.

- **Mule detection** — the Review page lists accounts that received from 3+ different people in 24 hours *and* pass the money on, are new, or are already reported. An admin can hold such an account (it can still receive, not send) or release it. This is rule-based; a trained model needs real labelled data, and the upheld/dismissed scam reports are what will provide it.
- **Sinhala, Tamil and English warnings** — pick a language in the header. Risk reasons are returned as stable codes with their numbers, and the app shows fixed translations (`frontend/src/i18n/strings.js`). Have a fluent speaker review the Sinhala and Tamil before launch; the server's English text is the fallback for any unknown code.

## Sessions

Access tokens last 15 minutes. Login also returns a **refresh token** (30 days, stored only as a hash) that the app uses to renew the access token quietly. Refresh tokens rotate on every use; if an already-used token is presented again, the whole login session is revoked. `POST /api/auth/logout` revokes the session. Configure with `jwt.expiration-ms` and `jwt.refresh-expiration-days`.

## One-time codes (SMS)

Off by default, because codes are only useful once an SMS provider is connected. When `CEYLONPAY_OTP_ENABLED=true`: new accounts must verify their phone (a 6-digit code) before they can send money, and a transfer that carries a risk warning also needs a fresh code texted to the sender, valid only for that recipient and amount. Codes last 5 minutes, allow 5 wrong tries, and can be re-requested every 30 seconds. Existing accounts are treated as verified. Messages go through the `SmsSender` interface; the built-in implementation only logs them (development), so add one for your provider (Dialog, Mobitel or a bulk-SMS gateway) and set `ceylonpay.sms.provider` to its name. For local demos, `CEYLONPAY_SMS_DEV_CODE_IN_RESPONSE=true` returns the code in the API response and shows it in the UI. Never set that in production.

## Admin access

`/api/admin/**` requires the `ADMIN` role (carried as a claim in the JWT). Nobody can become an admin through the API. Register the account first, then set `CEYLONPAY_ADMIN_PHONE` to its phone number and restart; the account is promoted at startup.

Phone numbers are stored in one canonical form (`+947XXXXXXXX`); `0771234567` and `+94771234567` are the same account.

## Known limitations

- CORS origins and the JWT secret are configured via environment variables but are not rotated or vaulted — fine for a demo deployment, not production-hardened.
