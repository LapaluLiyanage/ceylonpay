# CeylonPay Part 6 — React Frontend: Design Spec

## Goal

Build the CeylonPay web frontend (Vite + React + React Router + Context API) against the existing, fully-tested Spring Boot backend (Parts 1–5), matching the "CeylonPay payment prototype" Claude Design artifact exactly for visuals and copy. This spec is the source of truth for structure, data flow, and API wiring; the prototype (read and extracted in full below) is the source of truth for every visual and copy detail.

## Backend additions required

The frontend cannot function against the current backend as-is. Two small backend changes are required first:

### 1. `GET /api/transactions` (new)

Part 4 built `Transaction`/`AuditLog` for transfers only; there is no read endpoint yet. Add:

- `TransactionRepository.findBySender_IdOrReceiver_IdOrderByCreatedAtDesc(String senderId, String receiverId)` — derived query, nested property traversal into `Wallet.id`.
- `TransferService.getHistory(String userId)`:
  1. Resolve the caller's wallet via `walletRepository.findByUserId(userId)`.
  2. Fetch transactions via the repository method above, passing the wallet's id as both sender and receiver id.
  3. Map each `Transaction` to a `TransactionHistoryResponse`: `direction` is `"SENT"` if `transaction.getSender().getId().equals(myWalletId)`, else `"RECEIVED"`; `counterpartyName`/`counterpartyPhone` come from the *other* wallet's `User` (receiver's user if SENT, sender's user if RECEIVED).
- `dto/TransactionHistoryResponse.java`: `record TransactionHistoryResponse(String id, String direction, String counterpartyName, String counterpartyPhone, BigDecimal amount, LocalDateTime timestamp)`.
- `controller/TransactionController.java`: `GET /api/transactions`, `@RequestMapping("/api/transactions")`, userId from `Authentication`, calls `transferService.getHistory(...)`.
- **Deposits do not appear in this history** (per the "transfers only" decision) — a documented, deliberate deviation from the prototype's mock data, which mixes in deposit rows.
- Unit tests in `TransferServiceTest`: empty history, one sent transaction (direction=SENT, counterparty=receiver's user), one received transaction (direction=RECEIVED, counterparty=sender's user), correct ordering passthrough.

### 2. CORS configuration (new)

`SecurityConfig` has no CORS configuration; Spring Security blocks cross-origin requests by default. The Vite dev server runs on a different origin (`http://localhost:5173`) than the backend (`http://localhost:8080`), so every frontend API call will fail without this. Add a `CorsConfigurationSource` bean permitting origin `http://localhost:5173`, methods `GET/POST`, headers `Authorization/Content-Type`, and wire it via `.cors(cors -> cors.configurationSource(...))` in the security filter chain.

## Frontend project structure

```
ceylonpay-frontend/
├── src/
│   ├── api/
│   │   ├── client.js       ← fetch wrapper, base URL, attaches Authorization header
│   │   ├── auth.js         ← register(data), login(data)
│   │   ├── wallet.js       ← getBalance(), deposit(amount)
│   │   └── transfer.js     ← transfer(toPhone, amount), getHistory()
│   ├── context/
│   │   └── AuthContext.jsx ← token, user, login(), logout(), validates token on mount
│   ├── components/
│   │   ├── ProtectedRoute.jsx
│   │   ├── Button.jsx, Input.jsx, PhoneInput.jsx
│   │   ├── BalanceCard.jsx, TransactionRow.jsx
│   │   └── LoadingSkeleton.jsx, EmptyState.jsx, ErrorState.jsx
│   ├── pages/
│   │   ├── Register.jsx, Login.jsx
│   │   ├── Dashboard.jsx, Deposit.jsx, Transfer.jsx, History.jsx
│   ├── utils/
│   │   ├── money.js        ← formatMoney(amount) → "Rs. 1,250.00" (display only)
│   │   └── phone.js        ← digitsOnly(), groupPhone(), toApiPhone(), phoneError()
│   └── App.jsx
```

No component makes a raw `fetch()` call — every screen calls a function from `api/`.

## Conventions (binding across all screens)

- **Phone numbers**: stored in component/context state as raw digits, local 9-digit form (e.g. `771234567`, no leading 0). Displayed as `+94 77 123 4567` (`groupPhone` + `+94 ` prefix). Sent to the backend as `+94771234567` (matches the backend's `^(0|\+94)7\d{8}$` validation).
- **Money**: every amount displayed goes through `formatMoney()` → `Rs. X,XXX.XX`. The number itself is *never* computed client-side from other displayed numbers for anything balance-related — new balances always come from the API response body. The Dashboard's "This month / Sent / Received" summary is the one exception: it's a display-only aggregate computed by summing the already-fetched transaction list, not a source of truth for the wallet balance itself.
- **Auth check on load**: `AuthContext` reads a token from `localStorage` on mount and immediately calls `getBalance()`. A `401` clears the token and redirects to `/login`; any other response confirms the token is live. This exists because a token in `localStorage` could be expired, revoked, or simply stale from a previous session — trusting its mere presence would show an authenticated shell that then fails on the first real request. Validating it up front means the redirect-to-login happens once, cleanly, instead of as a confusing mid-render failure.
- **Route protection**: `ProtectedRoute` wraps every route except `/login` and `/register`; it reads `AuthContext` and redirects to `/login` if there's no valid token.

## Design tokens (from the prototype, verbatim)

- Fonts: `Space Grotesk` (headings/numbers/phone digits), `Manrope` (body), loaded via `@font-face` (self-hosted per the prototype, or Google Fonts equivalent — same two families).
- Base: `body{background:#0b0c0b;color:#f2f4ef;font-family:Manrope,system-ui,sans-serif}`. Links `#c9f24d`, hover `#dcff7a`.
- Two animations: `cp-pulse` (loading skeletons: opacity .28↔.7, 1.4s ease-in-out infinite) and `cp-rise` (screen entrance: translateY(10px)+opacity 0 → none+1, .3–.4s ease).
- Full color and copy inventory: see the extracted prototype markup (read in full during brainstorming; the implementer should re-read the artifact at `https://claude.ai/code/artifact/ca35c87f-776f-42f2-b479-977fc0d7ab1a` directly — decode its `__bundler/template` script as a JSON string to get the literal HTML/CSS/copy for every screen and state).

## Per-screen behavior summary

**Login / Register** — split layout: left panel is static marketing copy ("Send money to a phone number.", three bullet points, "Licensed demo build · Colombo, Sri Lanka"), right panel is the active form. Inline field errors (red `#ff9b85`) appear under each input on blur/submit, not as a toast. A top-level `authError` banner (coral background) is reserved for server-level failures (wrong credentials, phone already registered, network failure) — never used for field-level validation. Register validates: name required, phone (9 digits, starts with 7), NIC (`^(\d{12}|\d{9}[VX])$`), password ≥6 chars and matches confirm. Login validates: phone format, password non-empty. On `401` from login, show "Wrong phone number or password. Try again." — never reveal which field was wrong. On `400` from register (phone/NIC taken), show the backend's actual message inline in the `authError` banner.

**Dashboard** — balance card (loading skeleton → number or error-with-retry), "Active" status pill, Send/Deposit quick actions, a "This month" side card (Sent/Received totals + transaction count, computed from fetched history), and a "Recent activity" section (last 4, loading skeleton / error-with-retry / empty-with-CTA / rows) with a "See all" link to History.

**Deposit** — single amount field (large, `Rs.` prefix), three quick-pick chips (Rs. 500/1,000/5,000), "Minimum Rs. 1.00" hint that becomes a red validation message on error, a distinct network-error banner ("Deposit didn't go through... No money left or entered your wallet") separate from validation errors, and a success screen showing the new balance with "Send money" / "Back to wallet" actions.

**Transfer** — two-stage: form (phone + amount, "Available Rs. X" hint) → confirm (recipient name-or-"Unregistered number", phone, a zero "Fee" line, "Balance after", an irreversibility warning banner, Edit/Confirm actions) → result. Three distinct failure screens sharing one layout but different copy, matching backend error codes: `400` insufficient balance → "Not enough balance" + shortfall amount + "Deposit money" CTA; `404` recipient not found → "No wallet on that number" + "Change the number" CTA (returns to form); network/`5xx` → "Transfer didn't go through" + "Try again" CTA (retries the same confirmed transfer). The confirm step cannot be skipped — there is no code path from the form directly to the API call.

**History** — All/Sent/Received filter pills, same loading/error/empty states as Dashboard's activity list plus a distinct "no {filter} transactions yet" state when a filter yields zero rows despite the account having transactions overall. Each row: direction icon (↑ dark on sent, ↓ lime on received — icon *and* label, never color alone), counterparty name + phone + timestamp + reference id, state label pill, signed amount (`− Rs. X` / `+ Rs. X`).

## Testing approach

- Backend: TDD as established in Parts 1–5 (JUnit/Mockito for the new `getHistory` logic).
- Frontend: Vitest for pure logic (`money.js`, `phone.js` formatting/validation functions) — these are exactly the kind of pure functions that deserve real unit tests. No component-level test framework is being introduced for this part; screen correctness is verified live in a running browser (see Manual verification), matching how every prior part in this project was verified against the real running system rather than asserted from code alone.

## Manual verification (from the Part 6 spec, unchanged)

1. Register a new user through the UI → land on Dashboard with balance Rs. 0.00
2. Deposit Rs. 500 through the UI → balance updates to Rs. 500.00 without a full page reload
3. Second browser/incognito, register a second user, transfer Rs. 100 from the first → confirm both balances update correctly after a refresh
4. Attempt a transfer larger than the current balance → specific insufficient-balance message, not generic
5. Clear `localStorage`'s token, visit `/dashboard` directly → redirects to `/login`
6. Refresh while logged in → still logged in

## Acceptance criteria (unchanged from the Part 6 spec)

- All 6 manual verification steps pass
- No screen makes a raw `fetch()` call directly inside a component
- The transfer confirmation step cannot be bypassed
- Visual details match the Claude Design file, not an ad-hoc interpretation
- Can explain why the JWT is checked on app load instead of trusting `localStorage`
