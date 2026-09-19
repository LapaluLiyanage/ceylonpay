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

Defaults to `localhost:5432`, database `ceylonpay`, user/password `postgres` — see `src/main/resources/application.properties`. The API starts on port `8080`.

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

## Known limitations

- Phone numbers accept either a `0` or `+94` prefix but aren't normalized at the database level, so the same real number entered both ways would register as two accounts.
- No rate limiting on login/register endpoints.
- CORS origins and the JWT secret are configured via environment variables but are not rotated or vaulted — fine for a demo deployment, not production-hardened.
