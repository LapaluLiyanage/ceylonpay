# CeylonPay — Industry-Grade Rearchitecture

This document explains **what changed, why, and how to talk about it in an interview.**
It's written for you (Lapalu), not as a formal report — use it to build your own words
around each change rather than reading it out.

## The one-sentence pitch

> "CeylonPay worked correctly on the happy path, but like most student wallet
> projects it trusted a single mutable balance column and assumed requests
> never fail halfway. I rebuilt the transfer core around the patterns real
> payment systems use so it stays correct under retries, concurrency, and
> partial failure — not just when everything goes right."

---

## 1. Double-entry ledger (`LedgerEntry`, `LedgerEntryType`, `LedgerService`)

**Before:** `Wallet.balance` was the only record of how much money someone had.
Every transfer directly mutated it. If a bug (or a bad migration, or a race
condition) touched that number, there was no independent way to know what it
*should* have been.

**After:** Every transfer posts two immutable rows to `ledger_entries` — a
DEBIT on the sender, a CREDIT on the receiver — in the same database
transaction as the transfer itself. `Wallet.balance` is now explicitly
documented as a **cached read model**, not the source of truth. The true
balance is always re-derivable as `SUM(CREDIT) − SUM(DEBIT)` for that wallet.

Deposits go through the same mechanism: `WalletService.deposit()` no longer
just increments a number — it's modeled as a transfer *from* a system
"external funding source" wallet (`SystemAccountService`) *into* the user's
wallet, so even money entering the system has a traceable counterparty.

**Interview line:** *"I stopped trusting a single balance number and made
every money movement provable from an append-only ledger — the same
principle every real accounting system and bank core uses."*

## 2. Optimistic locking (`Wallet.version`)

**Before:** Two simultaneous transfers debiting the same wallet could race —
read balance, read balance, subtract, subtract, save, save — and one
update could silently overwrite the other, losing money.

**After:** `@Version` on `Wallet` means the second writer's UPDATE affects
zero rows and Hibernate throws `ObjectOptimisticLockingFailureException`
instead of corrupting the balance.

## 3. Automatic retry (`@Retryable` in `TransferService` / `WalletService`)

Losing the optimistic-lock race shouldn't mean the user's request just
fails. Both `transfer()` and `deposit()` are annotated with Spring Retry's
`@Retryable`, so a lost race automatically re-reads fresh data and retries
up to 3 times with backoff before giving up.

## 4. Idempotency keys (`IdempotencyKey`, `IdempotencyService`)

**Before:** A client retry (network blip, double-tapped button) on
`POST /api/transfer` would create a second, real transfer.

**After:** The client sends an `Idempotency-Key` header once per user
action. The first request processes normally and its result is cached;
any later request with the same key gets the cached result replayed
instead of moving money again. Same pattern Stripe's API uses.

## 5. Transactional outbox (`OutboxEvent`, `OutboxPublisher`)

**Before:** Notifying anything outside the transfer itself would have
meant an extra call inside the transaction — which either couples the
transfer to that external system's uptime, or risks "transfer succeeded,
notification silently lost" if it's done after commit without care.

**After:** An `OutboxEvent` row is written in the *same* transaction as the
transfer. A separate scheduled `OutboxPublisher` polls and delivers pending
events afterwards. The event can never exist without the transfer that
produced it, and vice versa.

## 6. Reconciliation job (`ReconciliationService`, `ReconciliationDiscrepancy`)

A nightly scheduled job (`@Scheduled(cron = ...)`, default 2am) recomputes
every wallet's balance from its ledger history and compares it to the
cached `Wallet.balance`. Any mismatch is recorded and logged — exactly what
a bank's back-office reconciliation process does. Exposed for a live demo
via `GET /api/admin/reconciliation` and `POST /api/admin/reconciliation/run`.

## 7. Rate limiting (`RateLimitFilter`)

A dependency-free, fixed-window limiter guarding `/api/auth/login`,
`/api/auth/register`, and `/api/transfer` — directly closing the "no rate
limiting" gap your own README already called out. Runs *before* JWT
validation in the filter chain, so a rate-limited client never even gets
its token checked.

---

## Honest limitations (say these out loud — it builds credibility, not doubt)

- **No RBAC on the admin endpoints yet.** `/api/admin/reconciliation` is
  reachable by any authenticated user right now. `User.role` already exists
  for exactly this; wiring it in is the natural next step.
- **The system/suspense wallet is a single point of contention.** Every
  deposit in the whole system updates one wallet's cached balance under
  the hood — fine for a demo, a real bottleneck at scale. A production
  system would shard it or avoid caching its balance entirely.
- **Rate limiting is in-memory**, so limits reset if the instance restarts
  and don't hold across multiple instances. Swapping the `ConcurrentHashMap`
  for Redis is a contained, drop-in change — the request logic doesn't move.
- **The outbox publisher "delivers" by logging**, since there's no real
  message broker wired up. The pattern (and the guarantee it provides) is
  real; the delivery target is simulated.

Naming these yourself in the interview is stronger than waiting to be asked —
it shows you know where the edges of your own design are.

---

## New endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/wallet/ledger` | Full double-entry history for the caller's wallet |
| GET | `/api/admin/reconciliation` | Unresolved balance discrepancies |
| POST | `/api/admin/reconciliation/run` | Trigger reconciliation immediately (demo) |
| POST | `/api/transfer` | Unchanged endpoint, now accepts an optional `Idempotency-Key` header |

## New dependencies (`pom.xml`)

- `org.springframework.retry:spring-retry`
- `org.springframework.boot:spring-boot-starter-aop` (required for `@Retryable` to work)

## Running it

No new setup — `ddl-auto=update` means Hibernate creates the new tables
(`ledger_entries`, `idempotency_keys`, `outbox_events`,
`reconciliation_discrepancies`) automatically on next startup. Nothing to
migrate by hand.
