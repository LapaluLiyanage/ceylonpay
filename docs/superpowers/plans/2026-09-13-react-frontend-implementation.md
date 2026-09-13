# CeylonPay Part 6 (React Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CeylonPay React frontend (Register, Login, Dashboard, Deposit, Transfer, History) wired to the existing Spring Boot backend, matching the "CeylonPay payment prototype" Claude Design artifact exactly for visuals and copy.

**Architecture:** Two small backend additions first (a `GET /api/transactions` endpoint and CORS config), then a Vite + React + React Router + Context API frontend at `frontend/` in the repo root. Every screen calls thin `api/*.js` wrapper functions — never a raw `fetch()` in a component. State lives in `AuthContext` (token/user) and per-page `useState` (form/stage state) — no global state library.

**Tech Stack:** Java 21 / Spring Boot 4.1.1 (existing), React 18 + Vite + react-router-dom (new), Vitest for pure-logic unit tests.

**Spec:** `docs/superpowers/specs/2026-09-13-react-frontend-design.md`

## Global Constraints

- Phone numbers: stored as raw 9-digit local digits (no leading 0) in component state; displayed as `+94 7X XXX XXXX`; sent to the API as `+94` + digits.
- Money: every displayed amount goes through `formatMoney()` → `Rs. X,XXX.XX`. New balances always come verbatim from the API response — never computed client-side, except the Dashboard's "This month" Sent/Received summary, which is a display-only aggregate over already-fetched transactions.
- No component makes a raw `fetch()` call — everything goes through `src/api/*.js`.
- The transfer confirmation step (`form → confirm → sent/failed`) has no code path that skips `confirm`.
- Visual details (colors, spacing, fonts, copy) must match the prototype's extracted markup exactly — hex colors, font families, copy strings are given verbatim in each task below; do not paraphrase copy or invent new colors.
- Frontend directory is named `frontend/` at the repo root (not `ceylonpay-frontend/`) so Part 7's README "Getting started" commands (`cd frontend && npm install && npm run dev`) are accurate.

---

## Task 1: Backend — CORS configuration

**Files:**
- Modify: `src/main/java/lk/ceylonpay/config/SecurityConfig.java`

**Interfaces:**
- Produces: a `CorsConfigurationSource` bean wired into the existing `SecurityFilterChain` via `.cors(...)`.

This is a configuration change (no new business logic), so it's verified live rather than via a unit test, consistent with how `application-docker.properties` was handled in Part 5.

- [ ] **Step 1: Add the CORS bean and wire it into the filter chain**

Read the current file first, then apply this change:

```java
package lk.ceylonpay.config;

import jakarta.servlet.http.HttpServletResponse;
import lk.ceylonpay.security.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:5173"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, authException) ->
                        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized")))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

}
```

- [ ] **Step 2: Verify with a live CORS preflight check**

With the app running (`mvn spring-boot:run`), run:

```bash
curl -i -X OPTIONS http://localhost:8080/api/wallet/balance \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"
```

Expected: `200` response with an `Access-Control-Allow-Origin: http://localhost:5173` header present.

- [ ] **Step 3: Run the full backend test suite to confirm no regression**

Run: `mvn test`
Expected: all existing tests still pass (24 at time of writing).

- [ ] **Step 4: Commit**

```bash
git add src/main/java/lk/ceylonpay/config/SecurityConfig.java
git commit -m "Add CORS config so the frontend origin can reach the API"
```

---

## Task 2: Backend — `GET /api/transactions`

**Files:**
- Modify: `src/main/java/lk/ceylonpay/repository/TransactionRepository.java`
- Create: `src/main/java/lk/ceylonpay/dto/TransactionHistoryResponse.java`
- Modify: `src/main/java/lk/ceylonpay/service/TransferService.java`
- Create: `src/main/java/lk/ceylonpay/controller/TransactionController.java`
- Modify: `src/test/java/lk/ceylonpay/service/TransferServiceTest.java`

**Interfaces:**
- Consumes: `WalletRepository.findByUserId(String)` (exists), `Transaction.getSender()/getReceiver()` returning `Wallet` (exists), `Wallet.getUser()` returning `User` (exists).
- Produces: `TransferService.getHistory(String userId)` returning `List<TransactionHistoryResponse>`, used by `TransactionController`.

- [ ] **Step 1: Write the failing tests in `TransferServiceTest`**

Add these imports to the top of the existing file (alongside the existing ones):

```java
import lk.ceylonpay.dto.TransactionHistoryResponse;
import java.util.List;
```

Add these test methods inside the `TransferServiceTest` class:

```java
    @Test
    void getHistoryReturnsEmptyListWhenNoTransactions() {
        Wallet myWallet = walletWithBalance("wallet-mine", "user-mine", "100.0000");
        when(walletRepository.findByUserId("user-mine")).thenReturn(Optional.of(myWallet));
        when(transactionRepository.findBySender_IdOrReceiver_IdOrderByCreatedAtDesc("wallet-mine", "wallet-mine"))
                .thenReturn(List.of());

        List<TransactionHistoryResponse> history = transferService.getHistory("user-mine");

        assertThat(history).isEmpty();
    }

    @Test
    void getHistoryLabelsATransactionAsSentWhenMyWalletIsTheSender() {
        Wallet myWallet = walletWithBalance("wallet-mine", "user-mine", "100.0000");
        Wallet theirWallet = walletWithBalance("wallet-theirs", "user-theirs", "50.0000");
        theirWallet.getUser().setName("Recipient F");
        theirWallet.getUser().setPhone("0799999998");

        lk.ceylonpay.entity.Transaction txn = new lk.ceylonpay.entity.Transaction(
                myWallet, theirWallet, new BigDecimal("200.00"), "SUCCESS");
        txn.setId("txn-1");

        when(walletRepository.findByUserId("user-mine")).thenReturn(Optional.of(myWallet));
        when(transactionRepository.findBySender_IdOrReceiver_IdOrderByCreatedAtDesc("wallet-mine", "wallet-mine"))
                .thenReturn(List.of(txn));

        List<TransactionHistoryResponse> history = transferService.getHistory("user-mine");

        assertThat(history).hasSize(1);
        assertThat(history.get(0).direction()).isEqualTo("SENT");
        assertThat(history.get(0).counterpartyName()).isEqualTo("Recipient F");
        assertThat(history.get(0).counterpartyPhone()).isEqualTo("0799999998");
        assertThat(history.get(0).amount()).isEqualByComparingTo("200.00");
    }

    @Test
    void getHistoryLabelsATransactionAsReceivedWhenMyWalletIsTheReceiver() {
        Wallet myWallet = walletWithBalance("wallet-mine", "user-mine", "100.0000");
        Wallet theirWallet = walletWithBalance("wallet-theirs", "user-theirs", "50.0000");
        theirWallet.getUser().setName("Sender C");
        theirWallet.getUser().setPhone("0733333333");

        lk.ceylonpay.entity.Transaction txn = new lk.ceylonpay.entity.Transaction(
                theirWallet, myWallet, new BigDecimal("75.00"), "SUCCESS");
        txn.setId("txn-2");

        when(walletRepository.findByUserId("user-mine")).thenReturn(Optional.of(myWallet));
        when(transactionRepository.findBySender_IdOrReceiver_IdOrderByCreatedAtDesc("wallet-mine", "wallet-mine"))
                .thenReturn(List.of(txn));

        List<TransactionHistoryResponse> history = transferService.getHistory("user-mine");

        assertThat(history).hasSize(1);
        assertThat(history.get(0).direction()).isEqualTo("RECEIVED");
        assertThat(history.get(0).counterpartyName()).isEqualTo("Sender C");
        assertThat(history.get(0).counterpartyPhone()).isEqualTo("0733333333");
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from the repo root, with JDK 21 / Maven on PATH):

```
mvn test -Dtest=TransferServiceTest
```

Expected: compilation failure — `TransactionHistoryResponse` doesn't exist, `findBySender_IdOrReceiver_IdOrderByCreatedAtDesc` doesn't exist, `getHistory` doesn't exist.

- [ ] **Step 3: Create the DTO**

```java
package lk.ceylonpay.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TransactionHistoryResponse(
        String id,
        String direction,
        String counterpartyName,
        String counterpartyPhone,
        BigDecimal amount,
        LocalDateTime timestamp
) {
}
```

- [ ] **Step 4: Add the repository query method**

Read the current `TransactionRepository.java` first, then add the method inside the interface:

```java
package lk.ceylonpay.repository;

import lk.ceylonpay.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, String> {

    List<Transaction> findBySender_IdOrReceiver_IdOrderByCreatedAtDesc(String senderWalletId, String receiverWalletId);

}
```

- [ ] **Step 5: Add `getHistory` to `TransferService`**

Read the current `TransferService.java` first. Add this import:

```java
import lk.ceylonpay.dto.TransactionHistoryResponse;
import java.util.List;
```

Add this method to the class:

```java
    public List<TransactionHistoryResponse> getHistory(String userId) {
        Wallet myWallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new WalletNotFoundException("Wallet not found"));

        return transactionRepository
                .findBySender_IdOrReceiver_IdOrderByCreatedAtDesc(myWallet.getId(), myWallet.getId())
                .stream()
                .map(txn -> toHistoryResponse(txn, myWallet.getId()))
                .toList();
    }

    private TransactionHistoryResponse toHistoryResponse(Transaction txn, String myWalletId) {
        boolean sent = txn.getSender().getId().equals(myWalletId);
        Wallet counterpartyWallet = sent ? txn.getReceiver() : txn.getSender();
        return new TransactionHistoryResponse(
                txn.getId(),
                sent ? "SENT" : "RECEIVED",
                counterpartyWallet.getUser().getName(),
                counterpartyWallet.getUser().getPhone(),
                txn.getAmount(),
                txn.getCreatedAt()
        );
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `mvn test -Dtest=TransferServiceTest`
Expected: all tests pass, including the 3 new ones.

- [ ] **Step 7: Create the controller**

```java
package lk.ceylonpay.controller;

import lk.ceylonpay.dto.TransactionHistoryResponse;
import lk.ceylonpay.service.TransferService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransferService transferService;

    public TransactionController(TransferService transferService) {
        this.transferService = transferService;
    }

    @GetMapping
    public ResponseEntity<List<TransactionHistoryResponse>> getHistory(Authentication authentication) {
        return ResponseEntity.ok(transferService.getHistory(authentication.getName()));
    }

}
```

- [ ] **Step 8: Run the full test suite**

Run: `mvn clean test`
Expected: `BUILD SUCCESS`, all tests pass (27 total: 24 existing + 3 new).

- [ ] **Step 9: Commit**

```bash
git add src/main/java/lk/ceylonpay/dto/TransactionHistoryResponse.java \
        src/main/java/lk/ceylonpay/repository/TransactionRepository.java \
        src/main/java/lk/ceylonpay/service/TransferService.java \
        src/main/java/lk/ceylonpay/controller/TransactionController.java \
        src/test/java/lk/ceylonpay/service/TransferServiceTest.java
git commit -m "Add GET /api/transactions (transfer history, TDD)"
```

---

## Task 3: Frontend scaffold + global styles

**Files:**
- Create: `frontend/` (via `npm create vite@latest`)
- Modify: `frontend/index.html`
- Create: `frontend/src/index.css`
- Modify: `frontend/src/main.jsx`
- Modify: `.gitignore` (repo root) — confirm `node_modules/` is covered

**Interfaces:**
- Produces: base styles and fonts every later component relies on (`Space Grotesk`, `Manrope`, `cp-pulse`/`cp-rise` keyframes, dark body background).

- [ ] **Step 1: Scaffold the Vite project**

From the repo root:

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install react-router-dom
npm install -D vitest
cd ..
```

- [ ] **Step 2: Add Google Fonts to `frontend/index.html`**

Read the generated file first, then add these two lines inside `<head>`, before the existing `<title>` tag:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 3: Replace `frontend/src/index.css`**

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #0b0c0b;
  color: #f2f4ef;
  font-family: Manrope, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

a {
  color: #c9f24d;
  text-decoration: none;
}

a:hover {
  color: #dcff7a;
}

input {
  font-family: inherit;
}

input::placeholder {
  color: rgba(242, 244, 239, 0.3);
}

input:focus {
  outline: none;
}

button {
  font-family: inherit;
  cursor: pointer;
  border: 0;
}

@keyframes cp-pulse {
  0%,
  100% {
    opacity: 0.28;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes cp-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
```

- [ ] **Step 4: Simplify `frontend/src/main.jsx`**

Read the generated file first, then replace it with:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 5: Delete the Vite starter's default demo files**

Delete `frontend/src/App.css` and remove its unused SVG assets (`frontend/src/assets/react.svg`, `frontend/public/vite.svg` can stay — harmless, low priority to remove).

- [ ] **Step 6: Confirm `.gitignore` covers `node_modules`**

Read the repo root `.gitignore`. If `node_modules/` isn't already listed, add it (Vite's own scaffold also generates a `frontend/.gitignore` covering this locally, but confirm the repo-root one has it too since `frontend/` is a subdirectory of the same repo).

- [ ] **Step 7: Verify the dev server starts**

```bash
cd frontend
npm run dev
```

Expected: Vite prints a local URL (e.g. `http://localhost:5173/`); the default starter page loads with the dark background and correct fonts visible in devtools (even though `App.jsx` still has placeholder content at this point).

Stop the dev server (Ctrl+C) before continuing.

- [ ] **Step 8: Commit**

```bash
git add frontend .gitignore
git commit -m "Scaffold Vite React frontend with base styles and fonts"
```

---

## Task 4: `utils/money.js` (TDD)

**Files:**
- Create: `frontend/src/utils/money.js`
- Create: `frontend/src/utils/money.test.js`

**Interfaces:**
- Produces: `formatMoney(amount)`, `parseAmountInput(raw)` — used by every page that displays or accepts a money value.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest';
import { formatMoney, parseAmountInput } from './money';

describe('formatMoney', () => {
  it('formats a whole number with two decimals and the Rs. prefix', () => {
    expect(formatMoney(500)).toBe('Rs. 500.00');
  });

  it('adds thousands separators', () => {
    expect(formatMoney(48200.75)).toBe('Rs. 48,200.75');
  });

  it('accepts a numeric string from the API', () => {
    expect(formatMoney('300.0000')).toBe('Rs. 300.00');
  });

  it('formats zero correctly', () => {
    expect(formatMoney(0)).toBe('Rs. 0.00');
  });
});

describe('parseAmountInput', () => {
  it('rejects an empty value', () => {
    expect(parseAmountInput('')).toEqual({ error: 'Enter an amount.' });
  });

  it('rejects non-numeric input', () => {
    expect(parseAmountInput('abc')).toEqual({ error: 'Use numbers only, up to two decimals.' });
  });

  it('rejects an amount below the minimum', () => {
    expect(parseAmountInput('0.50')).toEqual({ error: 'The smallest amount is Rs. 1.00.' });
  });

  it('accepts a valid whole number amount', () => {
    expect(parseAmountInput('500')).toEqual({ value: 500 });
  });

  it('accepts a valid decimal amount', () => {
    expect(parseAmountInput('1250.75')).toEqual({ value: 1250.75 });
  });

  it('accepts the exact minimum amount', () => {
    expect(parseAmountInput('1.00')).toEqual({ value: 1 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd frontend
npx vitest run src/utils/money.test.js
```

Expected: FAIL — `money.js` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```js
export function formatMoney(amount) {
  const n = typeof amount === 'number' ? amount : parseFloat(amount);
  return 'Rs. ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseAmountInput(raw) {
  const s = String(raw || '').replace(/[,\s]/g, '');
  if (!s) return { error: 'Enter an amount.' };
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return { error: 'Use numbers only, up to two decimals.' };
  const value = Math.round(parseFloat(s) * 100) / 100;
  if (value < 1) return { error: 'The smallest amount is Rs. 1.00.' };
  return { value };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/utils/money.test.js
```

Expected: PASS, 10/10.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/money.js frontend/src/utils/money.test.js
git commit -m "Add money formatting and amount-parsing utilities (TDD)"
```

---

## Task 5: `utils/phone.js` (TDD)

**Files:**
- Create: `frontend/src/utils/phone.js`
- Create: `frontend/src/utils/phone.test.js`

**Interfaces:**
- Produces: `digitsOnly(raw)`, `groupPhone(digits)`, `toDisplayPhone(digits)`, `toApiPhone(digits)`, `phoneError(digits)`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest';
import { digitsOnly, groupPhone, toDisplayPhone, toApiPhone, phoneError } from './phone';

describe('digitsOnly', () => {
  it('strips non-digit characters', () => {
    expect(digitsOnly('77 123 4567')).toBe('771234567');
  });

  it('truncates to 9 digits', () => {
    expect(digitsOnly('12345678901')).toBe('123456789');
  });
});

describe('groupPhone', () => {
  it('groups digits as 2-3-4', () => {
    expect(groupPhone('771234567')).toBe('77 123 4567');
  });

  it('handles a partial number', () => {
    expect(groupPhone('771')).toBe('77 1');
  });
});

describe('toDisplayPhone', () => {
  it('prefixes +94 and groups the digits', () => {
    expect(toDisplayPhone('771234567')).toBe('+94 77 123 4567');
  });
});

describe('toApiPhone', () => {
  it('prefixes +94 with no spaces, for the backend', () => {
    expect(toApiPhone('771234567')).toBe('+94771234567');
  });
});

describe('phoneError', () => {
  it('rejects an empty number', () => {
    expect(phoneError('')).toBe('Enter a phone number.');
  });

  it('rejects a number shorter than 9 digits', () => {
    expect(phoneError('771234')).toBe('A Sri Lankan mobile number has 9 digits after +94.');
  });

  it('rejects a number not starting with 7', () => {
    expect(phoneError('812345678')).toBe('Mobile numbers start with 7 — for example 77 123 4567.');
  });

  it('accepts a valid 9-digit number starting with 7', () => {
    expect(phoneError('771234567')).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/utils/phone.test.js
```

Expected: FAIL — `phone.js` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```js
export function digitsOnly(raw) {
  return String(raw || '').replace(/\D/g, '').slice(0, 9);
}

export function groupPhone(raw) {
  const d = digitsOnly(raw);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(' ');
}

export function toDisplayPhone(raw) {
  return '+94 ' + groupPhone(raw);
}

export function toApiPhone(raw) {
  return '+94' + digitsOnly(raw);
}

export function phoneError(raw) {
  const d = digitsOnly(raw);
  if (!d) return 'Enter a phone number.';
  if (d.length < 9) return 'A Sri Lankan mobile number has 9 digits after +94.';
  if (d[0] !== '7') return 'Mobile numbers start with 7 — for example 77 123 4567.';
  return '';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/utils/phone.test.js
```

Expected: PASS, 10/10.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/phone.js frontend/src/utils/phone.test.js
git commit -m "Add phone formatting and validation utilities (TDD)"
```

---

## Task 6: `api/client.js` (TDD)

**Files:**
- Create: `frontend/src/api/client.js`
- Create: `frontend/src/api/client.test.js`

**Interfaces:**
- Produces: `request(path, options)`, `setAuthToken(token)`, `ApiError` (class with `.status` and `.message`) — every other `api/*.js` file and `AuthContext` depend on these exact names.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, setAuthToken, ApiError } from './client';

describe('request', () => {
  beforeEach(() => {
    setAuthToken(null);
    global.fetch = vi.fn();
  });

  it('attaches the Authorization header when a token is set', async () => {
    setAuthToken('abc123');
    global.fetch.mockResolvedValue({ ok: true, text: async () => '{"walletId":"w1"}' });

    await request('/api/wallet/balance');

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer abc123');
  });

  it('omits the Authorization header when no token is set', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => '{}' });

    await request('/api/auth/login');

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('resolves with the parsed JSON body on success', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => '{"balance":500}' });

    const result = await request('/api/wallet/balance');

    expect(result).toEqual({ balance: 500 });
  });

  it('throws an ApiError with the backend message and status on failure', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":"Phone number already registered"}',
    });

    await expect(request('/api/auth/register', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 400, message: 'Phone number already registered' });
    await expect(request('/api/auth/register', { method: 'POST', body: {} }))
      .rejects.toBeInstanceOf(ApiError);
  });

  it('falls back to a generic message when the error body has no message', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => '' });

    await expect(request('/api/wallet/balance'))
      .rejects.toMatchObject({ status: 500, message: 'Something went wrong. Please try again.' });
  });

  it('sends the request body as JSON', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => '{}' });

    await request('/api/wallet/deposit', { method: 'POST', body: { amount: 500 } });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.body).toBe(JSON.stringify({ amount: 500 }));
    expect(options.method).toBe('POST');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/api/client.test.js
```

Expected: FAIL — `client.js` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```js
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data && data.error) || 'Something went wrong. Please try again.';
    throw new ApiError(response.status, message);
  }

  return data;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/api/client.test.js
```

Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.js frontend/src/api/client.test.js
git commit -m "Add configured API client with auth header and error handling (TDD)"
```

---

## Task 7: `api/auth.js`, `api/wallet.js`, `api/transfer.js`

**Files:**
- Create: `frontend/src/api/auth.js`
- Create: `frontend/src/api/wallet.js`
- Create: `frontend/src/api/transfer.js`
- Create: `frontend/src/api/endpoints.test.js`

**Interfaces:**
- Consumes: `request(path, options)` from Task 6.
- Produces: `register(data)`, `login(data)`, `getBalance()`, `deposit(amount)`, `transfer(toPhone, amount)`, `getHistory()` — these exact names are what every page imports.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, vi } from 'vitest';

vi.mock('./client', () => ({ request: vi.fn().mockResolvedValue({}) }));

import { request } from './client';
import { register, login } from './auth';
import { getBalance, deposit } from './wallet';
import { transfer, getHistory } from './transfer';

describe('auth API', () => {
  it('register posts to /api/auth/register with the form fields', async () => {
    await register({ name: 'A', phone: '+94771234567', nic: '991234567V', password: 'pw' });
    expect(request).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      body: { name: 'A', phone: '+94771234567', nic: '991234567V', password: 'pw' },
    });
  });

  it('login posts to /api/auth/login with phone and password', async () => {
    await login({ phone: '+94771234567', password: 'pw' });
    expect(request).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: { phone: '+94771234567', password: 'pw' },
    });
  });
});

describe('wallet API', () => {
  it('getBalance gets /api/wallet/balance', async () => {
    await getBalance();
    expect(request).toHaveBeenCalledWith('/api/wallet/balance');
  });

  it('deposit posts the amount to /api/wallet/deposit', async () => {
    await deposit(500);
    expect(request).toHaveBeenCalledWith('/api/wallet/deposit', { method: 'POST', body: { amount: 500 } });
  });
});

describe('transfer API', () => {
  it('transfer posts toPhone and amount to /api/transfer', async () => {
    await transfer('+94799999998', 200);
    expect(request).toHaveBeenCalledWith('/api/transfer', {
      method: 'POST',
      body: { toPhone: '+94799999998', amount: 200 },
    });
  });

  it('getHistory gets /api/transactions', async () => {
    await getHistory();
    expect(request).toHaveBeenCalledWith('/api/transactions');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/api/endpoints.test.js
```

Expected: FAIL — `auth.js`, `wallet.js`, `transfer.js` don't exist yet.

- [ ] **Step 3: Write `frontend/src/api/auth.js`**

```js
import { request } from './client';

export function register({ name, phone, nic, password }) {
  return request('/api/auth/register', { method: 'POST', body: { name, phone, nic, password } });
}

export function login({ phone, password }) {
  return request('/api/auth/login', { method: 'POST', body: { phone, password } });
}
```

- [ ] **Step 4: Write `frontend/src/api/wallet.js`**

```js
import { request } from './client';

export function getBalance() {
  return request('/api/wallet/balance');
}

export function deposit(amount) {
  return request('/api/wallet/deposit', { method: 'POST', body: { amount } });
}
```

- [ ] **Step 5: Write `frontend/src/api/transfer.js`**

```js
import { request } from './client';

export function transfer(toPhone, amount) {
  return request('/api/transfer', { method: 'POST', body: { toPhone, amount } });
}

export function getHistory() {
  return request('/api/transactions');
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx vitest run src/api/endpoints.test.js
```

Expected: PASS, 6/6.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/auth.js frontend/src/api/wallet.js frontend/src/api/transfer.js frontend/src/api/endpoints.test.js
git commit -m "Add auth/wallet/transfer API wrapper functions (TDD)"
```

---

## Task 8: `AuthContext`

**Files:**
- Create: `frontend/src/context/AuthContext.jsx`

**Interfaces:**
- Consumes: `login`/`register` from `api/auth.js`, `getBalance` from `api/wallet.js`, `setAuthToken`/`ApiError` from `api/client.js`.
- Produces: `AuthProvider` (wraps the app), `useAuth()` returning `{ token, user, isReady, login(credentials), register(payload), logout() }`. `user` is `{ id, name, phone }`. `isReady` is `false` only during the initial on-load token validation.

No automated test for this file — it's a stateful React context whose correctness (token persistence across refresh, redirect on dead token) is exactly what manual verification steps 5 and 6 check live in a browser. Adding React Testing Library just for this one file would contradict the spec's stated testing boundary (Vitest for pure logic only).

- [ ] **Step 1: Write `frontend/src/context/AuthContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import { getBalance } from '../api/wallet';
import { setAuthToken, ApiError } from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'ceylonpay_token';
const USER_KEY = 'ceylonpay_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [isReady, setIsReady] = useState(false);

  const persistSession = useCallback((newToken, newUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const existingToken = localStorage.getItem(TOKEN_KEY);
    if (!existingToken) {
      setIsReady(true);
      return;
    }
    setAuthToken(existingToken);
    getBalance()
      .then(() => setIsReady(true))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
        }
        setIsReady(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login({ phone, password }) {
    const data = await apiLogin({ phone, password });
    persistSession(data.token, { id: data.userId, name: data.name, phone });
    return data;
  }

  async function register({ name, phone, nic, password }) {
    const data = await apiRegister({ name, phone, nic, password });
    persistSession(data.token, { id: data.userId, name: data.name, phone });
    return data;
  }

  function logout() {
    clearSession();
  }

  return (
    <AuthContext.Provider value={{ token, user, isReady, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

Note: `phone` passed into `login`/`register` here is the raw digit string the caller already has (from the form); `AuthContext` stores it as-is in `user.phone` for display purposes (the backend's `AuthResponse` doesn't return phone, so the frontend must carry it through from what the user typed).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/context/AuthContext.jsx
git commit -m "Add AuthContext: token persistence, login/register/logout, on-load validation"
```

---

## Task 9: Shared UI components

**Files:**
- Create: `frontend/src/components/Button.jsx`
- Create: `frontend/src/components/FormFields.jsx`
- Create: `frontend/src/components/AuthErrorBanner.jsx`
- Create: `frontend/src/components/AuthSplitLayout.jsx`
- Create: `frontend/src/components/AppShell.jsx`
- Create: `frontend/src/components/Activity.jsx`
- Create: `frontend/src/components/ProtectedRoute.jsx`

**Interfaces:**
- Produces every shared visual primitive later pages import: `Button`, `FieldLabel`/`TextField`/`FieldError`/`PhoneField`, `AuthErrorBanner`, `AuthSplitLayout`, `AppShell`, `SkeletonRows`/`ActivityErrorState`/`ActivityEmptyState`/`TransactionRow`, `ProtectedRoute`.
- Consumes: `useAuth()` from Task 8 (in `AppShell` and `ProtectedRoute`).

No automated tests — these are pure presentational components; their correctness is what the live browser verification in Task 16 checks.

- [ ] **Step 1: Write `frontend/src/components/Button.jsx`**

```jsx
const VARIANTS = {
  primary: { background: '#c9f24d', color: '#131707' },
  dark: { background: '#14170f', color: '#f3f4ef', fontWeight: 600 },
  outlineLight: { background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(242,244,239,.7)' },
  outlineDark: { background: 'transparent', border: '1px solid rgba(20,23,15,.2)', color: '#14170f', fontWeight: 600 },
};

export function Button({ variant = 'primary', style, children, ...props }) {
  const base = { height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700, padding: '0 20px' };
  return (
    <button style={{ ...base, ...VARIANTS[variant], ...style }} {...props}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Write `frontend/src/components/FormFields.jsx`**

```jsx
export function FieldLabel({ children }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 12,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: 'rgba(242,244,239,.45)',
        marginBottom: 8,
      }}
    >
      {children}
    </label>
  );
}

export function TextField({ value, onChange, type = 'text', placeholder, height = 50 }) {
  return (
    <input
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      style={{
        width: '100%',
        height,
        padding: '0 14px',
        borderRadius: 12,
        background: '#141614',
        border: '1px solid rgba(255,255,255,.09)',
        color: '#f2f4ef',
        fontSize: 16,
      }}
    />
  );
}

export function FieldError({ children }) {
  if (!children) return null;
  return <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ff9b85' }}>{children}</p>;
}

export function PhoneField({ value, onChange, height = 50 }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        height,
        borderRadius: 12,
        background: '#141614',
        border: '1px solid rgba(255,255,255,.09)',
      }}
    >
      <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, color: 'rgba(242,244,239,.5)' }}>+94</span>
      <input
        value={value}
        onChange={onChange}
        inputMode="numeric"
        placeholder="77 123 4567"
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          background: 'transparent',
          border: 0,
          color: '#f2f4ef',
          fontFamily: "'Space Grotesk',sans-serif",
          fontSize: 16,
          letterSpacing: '.02em',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Write `frontend/src/components/AuthErrorBanner.jsx`**

```jsx
export function AuthErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(255,122,92,.1)',
        border: '1px solid rgba(255,122,92,.3)',
        marginBottom: 18,
      }}
    >
      <span style={{ color: '#ff7a5c', fontWeight: 700, lineHeight: 1.4 }}>!</span>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: '#ffb8a6' }}>{message}</span>
    </div>
  );
}
```

- [ ] **Step 4: Write `frontend/src/components/AuthSplitLayout.jsx`**

```jsx
const BULLETS = [
  'Transfers by phone number, in seconds',
  'Every rupee logged and auditable',
  'LKR only — no conversion surprises',
];

export function AuthSplitLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', background: '#0b0c0b' }}>
      <div
        style={{
          flex: '1 1 360px',
          minWidth: 'min(100%, 320px)',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 48,
          background: '#101210',
          borderRight: '1px solid rgba(255,255,255,.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: '#c9f24d' }} />
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: '-.01em' }}>
            CeylonPay
          </span>
        </div>
        <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 'clamp(32px,4.4vw,50px)',
              lineHeight: 1.04,
              fontWeight: 500,
              letterSpacing: '-.03em',
            }}
          >
            Send money to a phone number.
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'rgba(242,244,239,.55)', maxWidth: 340 }}>
            A wallet in rupees. Deposit, send, and see every transaction — no card numbers, no branch visits.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'rgba(242,244,239,.45)', marginTop: 8 }}>
            {BULLETS.map((line) => (
              <div key={line} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#c9f24d' }} />
                {line}
              </div>
            ))}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(242,244,239,.3)' }}>Licensed demo build · Colombo, Sri Lanka</p>
      </div>

      <div style={{ flex: '1 1 420px', minWidth: 'min(100%, 320px)', padding: '48px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 420, animation: 'cp-rise .4s ease both' }}>{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `frontend/src/components/AppShell.jsx`**

```jsx
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Home' },
  { path: '/deposit', label: 'Deposit' },
  { path: '/transfer', label: 'Send' },
  { path: '/history', label: 'Activity' },
];

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initials = (user?.name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div style={{ minHeight: '100vh', padding: '20px 20px 64px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderRadius: 18,
            background: '#101210',
            border: '1px solid rgba(255,255,255,.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, background: '#c9f24d' }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600 }}>CeylonPay</span>
          </div>
          <nav style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: '#181b18', border: '1px solid rgba(255,255,255,.05)' }}>
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    background: active ? '#c9f24d' : 'transparent',
                    color: active ? '#131707' : 'rgba(242,244,239,.6)',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, color: 'rgba(242,244,239,.45)' }}>
                {user?.phone}
              </div>
            </div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#1f231f',
                border: '1px solid rgba(255,255,255,.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: '#c9f24d',
              }}
            >
              {initials}
            </div>
            <button
              onClick={logout}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,.1)',
                color: 'rgba(242,244,239,.6)',
                fontSize: 12,
              }}
            >
              Log out
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `frontend/src/components/Activity.jsx`**

```jsx
export function SkeletonRows({ count = 3, height = 62 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{ height, borderRadius: 14, background: '#e4e6dd', animation: `cp-pulse 1.4s ease-in-out ${i * 0.12}s infinite` }}
        />
      ))}
    </div>
  );
}

export function ActivityErrorState({ onRetry }) {
  return (
    <div style={{ padding: 22, borderRadius: 16, background: '#fff', border: '1px solid rgba(20,23,15,.1)' }}>
      <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>Activity didn&apos;t load</p>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'rgba(20,23,15,.6)' }}>
        The server didn&apos;t answer. Nothing has changed in your wallet.
      </p>
      <button
        onClick={onRetry}
        style={{ padding: '10px 14px', borderRadius: 10, background: '#14170f', color: '#f3f4ef', fontSize: 13, fontWeight: 600 }}
      >
        Try again
      </button>
    </div>
  );
}

export function ActivityEmptyState({ onDeposit }) {
  return (
    <div style={{ padding: '30px 24px', borderRadius: 16, background: '#fff', border: '1px dashed rgba(20,23,15,.2)', textAlign: 'center' }}>
      <p style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 600 }}>No money has moved yet</p>
      <p style={{ margin: '0 auto 18px', maxWidth: 340, fontSize: 13, lineHeight: 1.6, color: 'rgba(20,23,15,.6)' }}>
        Put your first rupees in the wallet — then you can send to any CeylonPay phone number.
      </p>
      <button
        onClick={onDeposit}
        style={{ padding: '12px 20px', borderRadius: 12, background: '#c9f24d', color: '#131707', fontSize: 14, fontWeight: 700 }}
      >
        Make your first deposit
      </button>
    </div>
  );
}

export function TransactionRow({ direction, title, subtitle, amountText, stateLabel }) {
  const isOut = direction === 'SENT';
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 14,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderRadius: 14,
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            flex: 'none',
            background: isOut ? '#14170f' : '#c9f24d',
            color: isOut ? '#f3f4ef' : '#131707',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          {isOut ? '↑' : '↓'}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600 }}>{title}</p>
          <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, color: 'rgba(20,23,15,.5)' }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            padding: '5px 10px',
            borderRadius: 999,
            background: '#eef0e8',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            color: 'rgba(20,23,15,.65)',
          }}
        >
          {stateLabel}
        </span>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>
          {amountText}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write `frontend/src/components/ProtectedRoute.jsx`**

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }) {
  const { token, isReady } = useAuth();

  if (!isReady) return null;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components
git commit -m "Add shared UI primitives: Button, form fields, layout shells, activity states"
```

---

## Task 10: `App.jsx` routing

**Files:**
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `AuthProvider` (Task 8), `ProtectedRoute` (Task 9), all six page components (Tasks 11–16 — these won't exist until those tasks run, so this task's dev-server check will show import errors until then; that's expected and resolves once every page file exists).

- [ ] **Step 1: Replace `frontend/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Deposit from './pages/Deposit';
import Transfer from './pages/Transfer';
import History from './pages/History';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deposit"
            element={
              <ProtectedRoute>
                <Deposit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfer"
            element={
              <ProtectedRoute>
                <Transfer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "Wire up React Router with protected routes"
```

(Do not run the dev server yet — it will fail until Tasks 11–16 create the page files it imports. This is expected.)

---

## Task 11: `pages/Login.jsx`

**Files:**
- Create: `frontend/src/pages/Login.jsx`

**Interfaces:**
- Consumes: `useAuth()`, `ApiError`, `digitsOnly`/`groupPhone`/`phoneError`, `FieldLabel`/`TextField`/`FieldError`/`PhoneField`, `AuthErrorBanner`, `Button`, `AuthSplitLayout`.

- [ ] **Step 1: Write `frontend/src/pages/Login.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { digitsOnly, groupPhone, phoneError } from '../utils/phone';
import { FieldLabel, TextField, FieldError, PhoneField } from '../components/FormFields';
import { AuthErrorBanner } from '../components/AuthErrorBanner';
import { Button } from '../components/Button';
import { AuthSplitLayout } from '../components/AuthSplitLayout';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const errors = {};
    const pe = phoneError(phone);
    if (pe) errors.phone = pe;
    if (!password) errors.password = 'Enter your password.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setAuthError('');
      return;
    }

    setFieldErrors({});
    setAuthError('');
    setBusy(true);
    try {
      await login({ phone: digitsOnly(phone), password });
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthError('Wrong phone number or password. Try again.');
      } else {
        setAuthError("Couldn't reach CeylonPay. Check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout>
      <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 26, fontWeight: 500, letterSpacing: '-.02em' }}>
        Log in
      </h2>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(242,244,239,.5)' }}>Use the phone number on your wallet.</p>

      <AuthErrorBanner message={authError} />

      <form onSubmit={handleSubmit}>
        <FieldLabel>Phone number</FieldLabel>
        <PhoneField value={groupPhone(phone)} onChange={(e) => setPhone(digitsOnly(e.target.value))} />
        <FieldError>{fieldErrors.phone}</FieldError>

        <div style={{ marginTop: 18 }}>
          <FieldLabel>Password</FieldLabel>
          <TextField type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          <FieldError>{fieldErrors.password}</FieldError>
        </div>

        <Button type="submit" variant="primary" style={{ width: '100%', marginTop: 24 }}>
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p style={{ margin: '20px 0 0', fontSize: 14, color: 'rgba(242,244,239,.5)', textAlign: 'center' }}>
        New to CeylonPay? <Link to="/register">Create an account</Link>
      </p>
    </AuthSplitLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Login.jsx
git commit -m "Add Login page"
```

---

## Task 12: `pages/Register.jsx`

**Files:**
- Create: `frontend/src/pages/Register.jsx`

**Interfaces:**
- Same imports as Login, plus a local `NIC_PATTERN` regex.

- [ ] **Step 1: Write `frontend/src/pages/Register.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { digitsOnly, groupPhone, phoneError } from '../utils/phone';
import { FieldLabel, TextField, FieldError, PhoneField } from '../components/FormFields';
import { AuthErrorBanner } from '../components/AuthErrorBanner';
import { Button } from '../components/Button';
import { AuthSplitLayout } from '../components/AuthSplitLayout';

const NIC_PATTERN = /^(\d{12}|\d{9}[VX])$/;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nic, setNic] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const errors = {};
    if (!name.trim()) errors.name = 'Enter your full name, as on your NIC.';
    const pe = phoneError(phone);
    if (pe) errors.phone = pe;
    const nicValue = nic.trim().toUpperCase();
    if (!nicValue) errors.nic = 'Enter your NIC number.';
    else if (!NIC_PATTERN.test(nicValue)) errors.nic = 'NIC is 12 digits, or 9 digits ending in V.';
    if (password.length < 6) errors.password = 'Use at least 6 characters for your password.';
    else if (password !== confirmPassword) errors.password = 'The two passwords do not match.';

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setAuthError('');
      return;
    }

    setFieldErrors({});
    setAuthError('');
    setBusy(true);
    try {
      await register({ name: name.trim(), phone: digitsOnly(phone), nic: nicValue, password });
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setAuthError(err.message);
      } else {
        setAuthError("Couldn't reach CeylonPay. Your account was not created — try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitLayout>
      <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 26, fontWeight: 500, letterSpacing: '-.02em' }}>
        Create your wallet
      </h2>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(242,244,239,.5)' }}>
        Your NIC keeps the wallet in your name. It is never shown to anyone you pay.
      </p>

      <AuthErrorBanner message={authError} />

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <FieldLabel>Full name</FieldLabel>
            <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="Nimali Perera" />
            <FieldError>{fieldErrors.name}</FieldError>
          </div>
          <div>
            <FieldLabel>Phone number</FieldLabel>
            <PhoneField value={groupPhone(phone)} onChange={(e) => setPhone(digitsOnly(e.target.value))} />
            <FieldError>{fieldErrors.phone}</FieldError>
          </div>
          <div>
            <FieldLabel>NIC number</FieldLabel>
            <TextField value={nic} onChange={(e) => setNic(e.target.value.toUpperCase().slice(0, 12))} placeholder="200145601234" />
            <FieldError>{fieldErrors.nic}</FieldError>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 150px', minWidth: 0 }}>
              <FieldLabel>Password</FieldLabel>
              <TextField type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div style={{ flex: '1 1 150px', minWidth: 0 }}>
              <FieldLabel>Confirm</FieldLabel>
              <TextField type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <FieldError>{fieldErrors.password}</FieldError>
        </div>

        <Button type="submit" variant="primary" style={{ width: '100%', marginTop: 24 }}>
          {busy ? 'Creating wallet…' : 'Create wallet'}
        </Button>
      </form>

      <p style={{ margin: '20px 0 0', fontSize: 14, color: 'rgba(242,244,239,.5)', textAlign: 'center' }}>
        Already have a wallet? <Link to="/login">Log in</Link>
      </p>
    </AuthSplitLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Register.jsx
git commit -m "Add Register page"
```

---

## Task 13: `pages/Dashboard.jsx`

**Files:**
- Create: `frontend/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `getBalance()`, `getHistory()`, `formatMoney()`, `toDisplayPhone()`, `AppShell`, `SkeletonRows`/`ActivityErrorState`/`ActivityEmptyState`/`TransactionRow`, `Button`.
- The backend's `TransactionHistoryResponse.counterpartyPhone` is already in `+94XXXXXXXXX` form (it's `User.phone`, stored in whatever format registration used — for users registered through this same frontend, that's `+94XXXXXXXXX`). `toDisplayPhone` expects raw digits, so strip a leading `+94` before calling it.

- [ ] **Step 1: Write `frontend/src/pages/Dashboard.jsx`**

```jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { getBalance } from '../api/wallet';
import { getHistory } from '../api/transfer';
import { formatMoney } from '../utils/money';
import { toDisplayPhone } from '../utils/phone';
import { SkeletonRows, ActivityErrorState, ActivityEmptyState, TransactionRow } from '../components/Activity';
import { Button } from '../components/Button';

function timestampLabel(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

function rowFor(tx) {
  const isOut = tx.direction === 'SENT';
  return {
    id: tx.id,
    direction: tx.direction,
    stateLabel: isOut ? 'Sent' : 'Received',
    title: isOut ? `To ${tx.counterpartyName}` : `From ${tx.counterpartyName}`,
    subtitle: `${toDisplayPhone(tx.counterpartyPhone.replace(/^\+94/, ''))} · ${timestampLabel(tx.timestamp)}`,
    amountText: (isOut ? '− ' : '+ ') + formatMoney(tx.amount),
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState(false);
  const [txs, setTxs] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState(false);

  const loadBalance = useCallback(() => {
    setBalanceLoading(true);
    setBalanceError(false);
    getBalance()
      .then((data) => setBalance(data.balance))
      .catch(() => setBalanceError(true))
      .finally(() => setBalanceLoading(false));
  }, []);

  const loadHistory = useCallback(() => {
    setTxLoading(true);
    setTxError(false);
    getHistory()
      .then((data) => setTxs(data))
      .catch(() => setTxError(true))
      .finally(() => setTxLoading(false));
  }, []);

  useEffect(() => {
    loadBalance();
    loadHistory();
  }, [loadBalance, loadHistory]);

  const sentTotal = txs.filter((t) => t.direction === 'SENT').reduce((a, t) => a + Number(t.amount), 0);
  const receivedTotal = txs.filter((t) => t.direction === 'RECEIVED').reduce((a, t) => a + Number(t.amount), 0);
  const ready = !txLoading && !txError;
  const isEmpty = ready && txs.length === 0;

  return (
    <AppShell>
      <main style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20, animation: 'cp-rise .35s ease both' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          <section
            style={{
              flex: '1 1 420px',
              minWidth: 'min(100%,300px)',
              padding: 28,
              borderRadius: 22,
              background: '#141614',
              border: '1px solid rgba(255,255,255,.07)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <p style={{ margin: '0 0 14px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(242,244,239,.45)' }}>
                  Wallet balance
                </p>
                {balanceLoading && (
                  <div style={{ width: 230, height: 52, borderRadius: 12, background: '#22261f', animation: 'cp-pulse 1.4s ease-in-out infinite' }} />
                )}
                {!balanceLoading && balanceError && (
                  <div>
                    <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 34, fontWeight: 500, color: 'rgba(242,244,239,.3)' }}>
                      Rs. ——
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: '#ffb8a6' }}>Couldn&apos;t reach the server. Your balance is unchanged.</p>
                    <button
                      onClick={loadBalance}
                      style={{ marginTop: 12, padding: '9px 14px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,.18)', color: '#f2f4ef', fontSize: 13, fontWeight: 600 }}
                    >
                      Try again
                    </button>
                  </div>
                )}
                {!balanceLoading && !balanceError && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 400, color: 'rgba(242,244,239,.5)' }}>Rs.</span>
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 'clamp(38px,6vw,56px)', fontWeight: 500, letterSpacing: '-.03em', lineHeight: 1 }}>
                      {Number(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, background: '#1b1f1b', border: '1px solid rgba(255,255,255,.06)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c9f24d' }} />
                <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(242,244,239,.55)' }}>Active</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
              <Button variant="primary" style={{ flex: '1 1 160px', minWidth: 0 }} onClick={() => navigate('/transfer')}>
                Send money
              </Button>
              <Button variant="dark" style={{ flex: '1 1 160px', minWidth: 0 }} onClick={() => navigate('/deposit')}>
                Deposit
              </Button>
            </div>
          </section>

          <section
            style={{
              flex: '1 1 240px',
              minWidth: 'min(100%,240px)',
              padding: 24,
              borderRadius: 22,
              background: '#101210',
              border: '1px solid rgba(255,255,255,.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <p style={{ margin: 0, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(242,244,239,.45)' }}>This month</p>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(242,244,239,.5)' }}>Sent</p>
              <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 500, letterSpacing: '-.02em' }}>
                {formatMoney(sentTotal)}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(242,244,239,.5)' }}>Received</p>
              <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 500, letterSpacing: '-.02em', color: '#c9f24d' }}>
                {formatMoney(receivedTotal)}
              </p>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'rgba(242,244,239,.35)' }}>
                {txs.length ? `${txs.length} transactions on record, all auditable.` : 'No transactions on record yet.'}
              </p>
            </div>
          </section>
        </div>

        <section style={{ padding: 24, borderRadius: 22, background: '#f3f4ef', color: '#14170f' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: '-.01em' }}>Recent activity</h3>
            <button
              onClick={() => navigate('/history')}
              style={{ padding: '8px 14px', borderRadius: 999, background: '#14170f', color: '#f3f4ef', fontSize: 12, fontWeight: 600 }}
            >
              See all
            </button>
          </div>

          {txLoading && <SkeletonRows count={3} height={62} />}
          {!txLoading && txError && <ActivityErrorState onRetry={loadHistory} />}
          {isEmpty && <ActivityEmptyState onDeposit={() => navigate('/deposit')} />}
          {ready && txs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {txs.slice(0, 4).map((tx) => (
                <TransactionRow key={tx.id} {...rowFor(tx)} />
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx
git commit -m "Add Dashboard page"
```

---

## Task 14: `pages/Deposit.jsx`

**Files:**
- Create: `frontend/src/pages/Deposit.jsx`

**Interfaces:**
- Consumes: `deposit()`, `formatMoney()`/`parseAmountInput()`, `AppShell`, `Button`, `FieldLabel`/`FieldError`.

- [ ] **Step 1: Write `frontend/src/pages/Deposit.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { deposit } from '../api/wallet';
import { formatMoney, parseAmountInput } from '../utils/money';
import { Button } from '../components/Button';
import { FieldLabel, FieldError } from '../components/FormFields';

export default function Deposit() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [netError, setNetError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('form');
  const [newBalance, setNewBalance] = useState(null);
  const [depositedAmount, setDepositedAmount] = useState(0);

  function pick(value) {
    setAmount(String(value));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const parsed = parseAmountInput(amount);
    if (parsed.error) {
      setError(parsed.error);
      setNetError(false);
      return;
    }

    setError('');
    setNetError(false);
    setBusy(true);
    try {
      const data = await deposit(parsed.value);
      setNewBalance(data.balance);
      setDepositedAmount(parsed.value);
      setStage('done');
      setAmount('');
    } catch {
      setNetError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main style={{ marginTop: 20, display: 'flex', justifyContent: 'center', animation: 'cp-rise .35s ease both' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          {stage === 'form' && (
            <section style={{ padding: 28, borderRadius: 22, background: '#141614', border: '1px solid rgba(255,255,255,.07)' }}>
              <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 500, letterSpacing: '-.02em' }}>
                Deposit
              </h2>
              <p style={{ margin: '0 0 26px', fontSize: 14, color: 'rgba(242,244,239,.5)' }}>Money lands in your wallet right away.</p>

              <form onSubmit={handleSubmit}>
                <FieldLabel>Amount</FieldLabel>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '0 18px',
                    height: 72,
                    borderRadius: 16,
                    background: '#0f110f',
                    border: '1px solid rgba(255,255,255,.1)',
                  }}
                >
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, color: 'rgba(242,244,239,.45)' }}>Rs.</span>
                  <input
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError('');
                    }}
                    inputMode="decimal"
                    placeholder="0.00"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: '100%',
                      background: 'transparent',
                      border: 0,
                      color: '#f2f4ef',
                      fontFamily: "'Space Grotesk',sans-serif",
                      fontSize: 34,
                      fontWeight: 500,
                      letterSpacing: '-.02em',
                    }}
                  />
                </div>
                <FieldError>{error}</FieldError>
                {!error && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'rgba(242,244,239,.4)' }}>Minimum Rs. 1.00</p>}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                  {[500, 1000, 5000].map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => pick(v)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 999,
                        background: '#1f231f',
                        border: '1px solid rgba(255,255,255,.09)',
                        color: '#f2f4ef',
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontSize: 14,
                      }}
                    >
                      Rs. {v.toLocaleString('en-US')}
                    </button>
                  ))}
                </div>

                {netError && (
                  <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: 'rgba(255,122,92,.1)', border: '1px solid rgba(255,122,92,.3)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#ffb8a6' }}>Deposit didn&apos;t go through</p>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'rgba(255,184,166,.8)' }}>
                      The server didn&apos;t respond. No money left or entered your wallet — press Add money to try again.
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
                  <Button type="button" variant="outlineLight" style={{ flex: '0 1 120px' }} onClick={() => navigate('/dashboard')}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" style={{ flex: '1 1 180px', minWidth: 0 }}>
                    {busy ? 'Adding…' : 'Add money'}
                  </Button>
                </div>
              </form>
            </section>
          )}

          {stage === 'done' && (
            <section style={{ padding: '32px 28px', borderRadius: 22, background: '#f3f4ef', color: '#14170f', textAlign: 'center', animation: 'cp-rise .3s ease both' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  margin: '0 auto 20px',
                  borderRadius: 16,
                  background: '#c9f24d',
                  color: '#131707',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                }}
              >
                ✓
              </div>
              <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>
                Added {formatMoney(depositedAmount)}
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(20,23,15,.6)' }}>
                {new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
              <div style={{ padding: 20, borderRadius: 16, background: '#fff', marginBottom: 24 }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(20,23,15,.5)' }}>New balance</p>
                <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 34, fontWeight: 600, letterSpacing: '-.02em' }}>
                  {formatMoney(newBalance)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="dark" style={{ flex: '1 1 140px', minWidth: 0 }} onClick={() => navigate('/transfer')}>
                  Send money
                </Button>
                <Button variant="outlineDark" style={{ flex: '1 1 140px', minWidth: 0 }} onClick={() => navigate('/dashboard')}>
                  Back to wallet
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>
    </AppShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Deposit.jsx
git commit -m "Add Deposit page"
```

---

## Task 15: `pages/Transfer.jsx`

**Files:**
- Create: `frontend/src/pages/Transfer.jsx`

**Interfaces:**
- Consumes: `getBalance()`, `transfer()`, `ApiError`, `formatMoney()`/`parseAmountInput()`, `digitsOnly`/`groupPhone`/`phoneError`/`toApiPhone`/`toDisplayPhone`, `AppShell`, `Button`, `FieldLabel`/`FieldError`/`PhoneField`.

**Note on a deliberate deviation from the prototype:** the prototype's mock has an in-memory phone→name directory, so its confirm screen shows the recipient's real name before sending. The real backend has no such lookup endpoint (and arguably shouldn't — leaking "is this phone registered, and as whom" before a transfer executes is itself a minor information disclosure). This implementation's confirm screen shows the phone number instead of a name in that slot, dropping the prototype's redundant "To"/"Phone" double-row down to one "Phone" row.

- [ ] **Step 1: Write `frontend/src/pages/Transfer.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { getBalance } from '../api/wallet';
import { transfer } from '../api/transfer';
import { ApiError } from '../api/client';
import { formatMoney, parseAmountInput } from '../utils/money';
import { digitsOnly, groupPhone, phoneError, toApiPhone, toDisplayPhone } from '../utils/phone';
import { Button } from '../components/Button';
import { FieldLabel, FieldError, PhoneField } from '../components/FormFields';

const FAIL_COPY = {
  network: { title: "Transfer didn't go through", label: 'Try again' },
  notfound: { title: 'No wallet on that number', label: 'Change the number' },
  balance: { title: 'Not enough balance', label: 'Deposit money' },
};

export default function Transfer() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [amountErr, setAmountErr] = useState('');
  const [stage, setStage] = useState('form');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failKind, setFailKind] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getBalance()
      .then((data) => setBalance(data.balance))
      .catch(() => {});
  }, []);

  function reviewTransfer(e) {
    e.preventDefault();
    const pe = phoneError(phone);
    const parsed = parseAmountInput(amount);
    if (pe || parsed.error) {
      setPhoneErr(pe);
      setAmountErr(parsed.error || '');
      return;
    }
    setPhoneErr('');
    setAmountErr('');
    setDraft({ phoneDigits: phone, amountValue: parsed.value });
    setStage('confirm');
  }

  async function confirmTransfer() {
    if (busy) return;
    setBusy(true);
    try {
      const data = await transfer(toApiPhone(draft.phoneDigits), draft.amountValue);
      setResult(data);
      setBalance(data.newBalance);
      setStage('sent');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setFailKind('notfound');
      else if (err instanceof ApiError && err.status === 400) setFailKind('balance');
      else setFailKind('network');
      setStage('failed');
    } finally {
      setBusy(false);
    }
  }

  const balanceAfter = draft ? balance - draft.amountValue : balance;
  const fail = failKind ? FAIL_COPY[failKind] : null;
  const failBody =
    failKind === 'notfound'
      ? `${toDisplayPhone(draft?.phoneDigits)} isn't registered with CeylonPay. Check the number, or ask them to sign up first.`
      : failKind === 'balance'
        ? `You need ${formatMoney((draft?.amountValue || 0) - balance)} more to send ${formatMoney(draft?.amountValue || 0)}. Deposit first, then send.`
        : "We couldn't reach the server, so the transfer was never sent. Try again in a moment.";

  function failPrimaryAction() {
    if (failKind === 'balance') navigate('/deposit');
    else if (failKind === 'notfound') setStage('form');
    else confirmTransfer();
  }

  return (
    <AppShell>
      <main style={{ marginTop: 20, display: 'flex', justifyContent: 'center', animation: 'cp-rise .35s ease both' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          {stage === 'form' && (
            <section style={{ padding: 28, borderRadius: 22, background: '#141614', border: '1px solid rgba(255,255,255,.07)' }}>
              <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 500, letterSpacing: '-.02em' }}>
                Send money
              </h2>
              <p style={{ margin: '0 0 26px', fontSize: 14, color: 'rgba(242,244,239,.5)' }}>
                You&apos;ll review everything before it leaves your wallet.
              </p>

              <form onSubmit={reviewTransfer}>
                <FieldLabel>Send to</FieldLabel>
                <PhoneField
                  value={groupPhone(phone)}
                  onChange={(e) => {
                    setPhone(digitsOnly(e.target.value));
                    setPhoneErr('');
                  }}
                  height={56}
                />
                <FieldError>{phoneErr}</FieldError>

                <div style={{ marginTop: 20 }}>
                  <FieldLabel>Amount</FieldLabel>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '0 16px',
                      height: 72,
                      borderRadius: 16,
                      background: '#0f110f',
                      border: '1px solid rgba(255,255,255,.1)',
                    }}
                  >
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, color: 'rgba(242,244,239,.45)' }}>Rs.</span>
                    <input
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setAmountErr('');
                      }}
                      inputMode="decimal"
                      placeholder="0.00"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: '100%',
                        background: 'transparent',
                        border: 0,
                        color: '#f2f4ef',
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontSize: 34,
                        fontWeight: 500,
                        letterSpacing: '-.02em',
                      }}
                    />
                  </div>
                  <FieldError>{amountErr}</FieldError>
                </div>

                <p style={{ margin: '16px 0 0', fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: 'rgba(242,244,239,.4)' }}>
                  Available {formatMoney(balance)}
                </p>

                <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
                  <Button type="button" variant="outlineLight" style={{ flex: '0 1 120px' }} onClick={() => navigate('/dashboard')}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" style={{ flex: '1 1 180px', minWidth: 0 }}>
                    Review transfer
                  </Button>
                </div>
              </form>
            </section>
          )}

          {stage === 'confirm' && draft && (
            <section style={{ padding: 28, borderRadius: 22, background: '#f3f4ef', color: '#14170f', animation: 'cp-rise .3s ease both' }}>
              <p style={{ margin: '0 0 20px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(20,23,15,.5)' }}>
                Step 2 of 2 · Confirm
              </p>
              <p style={{ margin: '0 0 4px', fontSize: 14, color: 'rgba(20,23,15,.6)' }}>You&apos;re sending</p>
              <p
                style={{
                  margin: '0 0 24px',
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: 'clamp(34px,6vw,44px)',
                  fontWeight: 600,
                  letterSpacing: '-.03em',
                  lineHeight: 1,
                }}
              >
                {formatMoney(draft.amountValue)}
              </p>

              <div style={{ borderRadius: 16, background: '#fff', overflow: 'hidden', marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16, borderBottom: '1px solid rgba(20,23,15,.08)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(20,23,15,.55)' }}>Phone</span>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 500 }}>{toDisplayPhone(draft.phoneDigits)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16, borderBottom: '1px solid rgba(20,23,15,.08)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(20,23,15,.55)' }}>Fee</span>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 500 }}>Rs. 0.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16 }}>
                  <span style={{ fontSize: 13, color: 'rgba(20,23,15,.55)' }}>Balance after</span>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600 }}>{formatMoney(balanceAfter)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 12, background: '#f6edd3', border: '1px solid rgba(190,150,40,.3)', marginBottom: 22 }}>
                <span style={{ color: '#8a6a12', fontWeight: 700, lineHeight: 1.4 }}>!</span>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#6b530c' }}>
                  Once sent, this transfer can&apos;t be reversed. Check the number belongs to the person you mean to pay.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="outlineDark" style={{ flex: '0 1 130px' }} onClick={() => setStage('form')}>
                  Edit
                </Button>
                <Button variant="dark" style={{ flex: '1 1 180px', minWidth: 0 }} onClick={confirmTransfer}>
                  {busy ? 'Sending…' : `Send ${formatMoney(draft.amountValue)}`}
                </Button>
              </div>
            </section>
          )}

          {stage === 'sent' && result && draft && (
            <section style={{ padding: '32px 28px', borderRadius: 22, background: '#f3f4ef', color: '#14170f', textAlign: 'center', animation: 'cp-rise .3s ease both' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  margin: '0 auto 20px',
                  borderRadius: 16,
                  background: '#c9f24d',
                  color: '#131707',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                }}
              >
                ✓
              </div>
              <h2 style={{ margin: '0 0 6px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>
                Sent {formatMoney(result.amount)}
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(20,23,15,.6)' }}>
                to {toDisplayPhone(draft.phoneDigits)} ·{' '}
                {new Date(result.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
              <div style={{ borderRadius: 16, background: '#fff', overflow: 'hidden', textAlign: 'left', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16, borderBottom: '1px solid rgba(20,23,15,.08)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(20,23,15,.55)' }}>Reference</span>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 500 }}>{result.transactionId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16 }}>
                  <span style={{ fontSize: 13, color: 'rgba(20,23,15,.55)' }}>New balance</span>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600 }}>{formatMoney(result.newBalance)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="dark" style={{ flex: '1 1 140px', minWidth: 0 }} onClick={() => navigate('/history')}>
                  See activity
                </Button>
                <Button variant="outlineDark" style={{ flex: '1 1 140px', minWidth: 0 }} onClick={() => navigate('/dashboard')}>
                  Back to wallet
                </Button>
              </div>
            </section>
          )}

          {stage === 'failed' && fail && (
            <section style={{ padding: '32px 28px', borderRadius: 22, background: '#141614', border: '1px solid rgba(255,122,92,.28)', animation: 'cp-rise .3s ease both' }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  marginBottom: 20,
                  borderRadius: 15,
                  background: 'rgba(255,122,92,.14)',
                  color: '#ff7a5c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                !
              </div>
              <h2 style={{ margin: '0 0 8px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 23, fontWeight: 500, letterSpacing: '-.02em' }}>
                {fail.title}
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, color: 'rgba(242,244,239,.6)' }}>{failBody}</p>
              <p style={{ margin: '0 0 24px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: 'rgba(242,244,239,.4)' }}>
                Nothing left your wallet. Balance {formatMoney(balance)}
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="primary" style={{ flex: '1 1 170px', minWidth: 0 }} onClick={failPrimaryAction}>
                  {fail.label}
                </Button>
                <Button variant="outlineLight" style={{ flex: '1 1 140px', minWidth: 0 }} onClick={() => navigate('/dashboard')}>
                  Back to wallet
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>
    </AppShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Transfer.jsx
git commit -m "Add Transfer page (two-stage confirm, three distinct failure states)"
```

---

## Task 16: `pages/History.jsx`

**Files:**
- Create: `frontend/src/pages/History.jsx`

**Interfaces:**
- Consumes: `getHistory()`, `formatMoney()`, `toDisplayPhone()`, `AppShell`, `SkeletonRows`/`ActivityErrorState`/`ActivityEmptyState`/`TransactionRow`.

- [ ] **Step 1: Write `frontend/src/pages/History.jsx`**

```jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { getHistory } from '../api/transfer';
import { formatMoney } from '../utils/money';
import { toDisplayPhone } from '../utils/phone';
import { SkeletonRows, ActivityErrorState, ActivityEmptyState, TransactionRow } from '../components/Activity';

function timestampLabel(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

function rowFor(tx) {
  const isOut = tx.direction === 'SENT';
  return {
    id: tx.id,
    direction: tx.direction,
    stateLabel: isOut ? 'Sent' : 'Received',
    title: isOut ? `To ${tx.counterpartyName}` : `From ${tx.counterpartyName}`,
    subtitle: `${toDisplayPhone(tx.counterpartyPhone.replace(/^\+94/, ''))} · ${timestampLabel(tx.timestamp)} · ${tx.id}`,
    amountText: (isOut ? '− ' : '+ ') + formatMoney(tx.amount),
  };
}

export default function History() {
  const navigate = useNavigate();
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getHistory()
      .then((data) => setTxs(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ready = !loading && !error;
  const hasAny = ready && txs.length > 0;
  const filtered =
    filter === 'sent' ? txs.filter((t) => t.direction === 'SENT') : filter === 'received' ? txs.filter((t) => t.direction === 'RECEIVED') : txs;
  const filterEmpty = hasAny && filtered.length === 0;

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'received', label: 'Received' },
  ];

  return (
    <AppShell>
      <main style={{ marginTop: 20, animation: 'cp-rise .35s ease both' }}>
        <section style={{ padding: 24, borderRadius: 22, background: '#f3f4ef', color: '#14170f' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: '-.02em' }}>
                Activity
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(20,23,15,.55)' }}>
                {hasAny ? `${filtered.length} of ${txs.length} transactions` : 'Every transaction on this wallet'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: '#e6e8de' }}>
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    background: filter === f.key ? '#14170f' : 'transparent',
                    color: filter === f.key ? '#f3f4ef' : 'rgba(20,23,15,.6)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading && <SkeletonRows count={4} height={66} />}
          {!loading && error && <ActivityErrorState onRetry={load} />}
          {ready && txs.length === 0 && <ActivityEmptyState onDeposit={() => navigate('/deposit')} />}
          {filterEmpty && (
            <div style={{ padding: '30px 24px', borderRadius: 16, background: '#fff', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(20,23,15,.6)' }}>No {filter} transactions yet.</p>
            </div>
          )}
          {hasAny && filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((tx) => (
                <TransactionRow key={tx.id} {...rowFor(tx)} />
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/History.jsx
git commit -m "Add History page"
```

---

## Task 17: Full-suite check + live browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run every frontend unit test**

```bash
cd frontend
npx vitest run
```

Expected: all tests pass (money: 10, phone: 10, client: 6, endpoints: 6 — 32 total).

- [ ] **Step 2: Run the backend test suite one more time**

```bash
cd ..
mvn clean test
```

Expected: `BUILD SUCCESS`, 27 tests pass.

- [ ] **Step 3: Start the backend**

```bash
mvn spring-boot:run
```

(Ensure Postgres is running and reachable at `localhost:5432/ceylonpay` first, per Part 1's setup.)

- [ ] **Step 4: Start the frontend dev server**

```bash
cd frontend
npm run dev
```

- [ ] **Step 5: Walk through the 6 manual verification steps in an actual browser**

1. Register a new user through the UI → land on Dashboard with balance Rs. 0.00
2. Deposit Rs. 500 through the UI → balance updates to Rs. 500.00 without a full page reload
3. Open a second browser/incognito window, register a second user, transfer Rs. 100 from the first user to the second → refresh both dashboards, confirm balances are correct (first: 400.00, second: 100.00)
4. Attempt a transfer larger than the current balance → confirm the "Not enough balance" message appears, not a generic error
5. Open browser devtools, clear `localStorage` (`localStorage.clear()`), navigate to `/dashboard` directly by URL → confirm it redirects to `/login`
6. Log back in, refresh the page → confirm you're still on the Dashboard, still logged in

Fix anything that doesn't match before proceeding — do not report this task complete on code review alone.

- [ ] **Step 6: Stop both dev servers**

Ctrl+C in both terminals.

- [ ] **Step 7: Final commit if any fixes were needed during Step 5**

```bash
git add -A
git commit -m "Fix issues found during live browser verification"
```

(Skip this step if Step 5 required no code changes.)
