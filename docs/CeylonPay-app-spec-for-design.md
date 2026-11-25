# CeylonPay — Product Function and Flow Specification

This document describes **what the app does and how a person moves through it**. It deliberately contains no visual direction (no colours, typography, layout style, imagery or mood). Visual design is left entirely to the designer.

---

## 1. What the product is

CeylonPay is a mobile-phone-number wallet for Sri Lanka. A person registers, puts money in a wallet, and sends money to anyone else who has a CeylonPay wallet by typing their phone number or scanning their QR code. Every payment is protected by a scam-safety layer that checks who is being paid, warns the sender when something looks risky, can hold a suspicious payment for human review, and lets a victim report a scam and get money back.

- Currency: Sri Lankan rupees (LKR), shown as `Rs. 1,250.00` (always two decimals, thousands separated by commas).
- Phone numbers: Sri Lankan mobiles only. Entered as the 9 digits after +94, shown as `+94 77 123 4567`. The first digit after +94 must be 7.
- Languages: English, Sinhala (සිංහල), Tamil (தமிழ்). A language switcher is always visible once signed in. Scam-warning text is available in all three; most other text is English only today.
- Fees: none. Every transfer shows `Fee Rs. 0.00`.
- The app is a web app that must work on a phone-sized screen first.

## 2. People who use it

| Role | What they can do |
|---|---|
| **Customer** | Register, sign in, deposit, send, receive, view activity, set personal safety limits, freeze their own wallet, report a scam, cancel a held payment. |
| **Reviewer (Admin)** | Everything a customer can do, plus the Review screen: approve or reject held payments, uphold or dismiss scam reports, place or release holds on suspected mule accounts. |

An admin cannot be created inside the app. Admin status is granted by the operator outside the app. Signing out and in again is needed for a role change to take effect.

## 3. Screen inventory

Signed-out screens: **Register**, **Sign in**.

Signed-in screens: **Home**, **Deposit**, **Send** (with its sub-steps), **Receive**, **Activity**, **Safety**, **Verify phone**, and for admins **Review**.

Main navigation (signed in): Home · Deposit · Send · Receive · Activity · Safety, plus **Review** for admins. The header also holds: the language switcher, the signed-in person's name and phone number, and a **Log out** control.

Any unknown address sends the person to Home (or to Sign in if signed out).

---

## 4. Global behaviours

### 4.1 Session
- Signing in or registering starts a session. The session renews itself silently in the background, so the person is not asked to sign in again during normal use (a session lasts up to 30 days).
- If the session can no longer be renewed (for example it was revoked), the person is returned to Sign in.
- **Log out** ends the session on the server as well as on the device.
- Opening a protected address while signed out sends the person to Sign in. After signing in they land back on the address they originally wanted (this is what makes a scanned pay link work for a signed-out person). Only addresses inside the app are honoured.

### 4.2 Verification banner
- When the operator has switched on phone verification, a person whose phone is not yet verified sees a persistent banner in the header area pointing to **Verify phone**. They cannot send money until verified. Existing accounts created before verification existed count as verified.

### 4.3 Request protection
Some actions are rate limited (sign in, register, requesting codes, name lookups, transfers). When the limit is hit the person sees: "Too many requests. Please try again in a minute."

### 4.4 Loading, empty and error states
Every data screen needs three states in addition to the normal one:
- **Loading** while data is fetched.
- **Empty** when there is nothing yet (copy given per screen below).
- **Could not reach the server** with a clear way to retry (usually refreshing). Where a balance is involved, the message states that **the balance is unchanged**.

---

## 5. Signed-out screens

### 5.1 Register
**Purpose:** create a wallet.

**Fields (all required):**
| Field | Rule | Error text |
|---|---|---|
| Full name | not blank; should match the NIC | "Enter your full name, as on your NIC." |
| Phone number | 9 digits after +94, starts with 7 | "Enter a phone number." / "A Sri Lankan mobile number has 9 digits after +94." / "Mobile numbers start with 7 — for example 77 123 4567." |
| NIC number | 12 digits, or 9 digits followed by V or X | "Enter your NIC number." / "NIC is 12 digits, or 9 digits ending in V." |
| Password | at least 6 characters | "Use at least 6 characters for your password." |
| Confirm password | must equal password | "The two passwords do not match." |

**Supporting copy:** "Your NIC keeps the wallet in your name. It is never shown to anyone you pay."

**Placeholders used as examples:** name "Nimali Perera", phone "77 123 4567", NIC "200145601234".

**Actions:** *Create wallet* (submit); link *Log in* for people who already have a wallet.

**Outcomes:**
- Success: wallet is created with a balance of Rs. 0.00, the person is signed in and lands on **Home**. If phone verification is on, they are guided to **Verify phone**.
- The same phone number cannot register twice, even if written as `0771234567` or `+94771234567` (they are the same number). The same NIC cannot register twice. A clear error is shown for each case.
- Errors from the server are shown near the form as a banner; field errors appear under their field.

### 5.2 Sign in
**Fields:** phone number (same rules and format as above), password.

**Errors:** "Enter your password." (blank) · "Wrong phone number or password. Try again." · "Couldn't reach CeylonPay. Check your connection and try again."

**Actions:** *Log in*; link *Create an account*.

**Outcome:** on success the person goes to **Home**, or back to the address they were originally trying to open.

---

## 6. Signed-in screens

### 6.1 Home
**Purpose:** show the current position at a glance and the way to the two main actions.

**Shows:**
- **Wallet balance** (large, in rupees) and a **wallet status** indicator: *Active*, or *Frozen* when the person has frozen their own wallet.
- Two primary actions: **Send money** and **Deposit**.
- **This month** summary: total **Sent** and total **Received** this calendar month, with an explanatory note beneath. When there is no activity: "No transactions on record yet."
- **Recent activity**: the latest transactions, with a **See all** action to Activity. Each row is described in 6.6.
  - Empty state: "No money has moved yet" with the supporting line "Put your first rupees in the wallet — then you can send to any CeylonPay phone number." and a button **Make your first deposit**.

**Error state:** "Couldn't reach the server. Your balance is unchanged."

### 6.2 Deposit
**Purpose:** add money to the wallet. (In this build deposits come from a simulated "External Funding Source"; no real card or bank is involved.)

**Step 1 — Enter amount**
- Heading: "Deposit"; supporting line: "Money lands in your wallet right away."
- One amount field (Rs.). Helper text under it: "Minimum Rs. 1.00".
- Rules: numbers only, up to two decimals, at least Rs. 1.00, up to 9 digits before the decimal point. Commas and spaces are ignored. Errors: "Enter an amount." · "Use numbers only, up to two decimals." · "The smallest amount is Rs. 1.00."
- Actions: confirm deposit; cancel (returns to Home).
- If the server fails: a message titled "Deposit didn't go through" with an explanation and a way to try again. Nothing is added when this happens.

**Step 2 — Success**
- Confirms the deposit and shows the **new balance**, with actions to go to Home or make another deposit.

### 6.3 Send
**Purpose:** pay another CeylonPay wallet. This is the most important flow. It has two steps on one screen, then a result.

**Entry points:** the Send navigation item, the *Send money* button on Home, or a **pay link** (see 6.4 and 7.4) which opens Send with the recipient number, and optionally the amount, already filled in.

**Step 1 — Details**
- Heading: "Send money"; supporting line: "You'll review everything before it leaves your wallet."
- **Send to:** phone number field (+94 prefix fixed, 9 digits, grouped as the person types).
- **Scan a QR code:** a control that opens the device camera and reads a CeylonPay QR code, filling in the number (and amount if the code contains one). Shown only on browsers that can scan; hidden otherwise. If the camera cannot be opened: "Could not open the camera. Allow camera access, or type the number instead." If the code is not a CeylonPay code: "That code isn't a CeylonPay payment code." A *Close camera* control is always available while scanning.
- **Amount:** same rules as Deposit.
- Shows **Available** balance. If the balance could not be loaded: "Couldn't load your balance — refresh the page to try again." and sending is disabled.
- Actions: **Review transfer**, **Cancel** (returns to Home).

**What happens on *Review transfer*** (button shows "Checking number…" meanwhile):
1. The phone and amount are validated (same messages as above).
2. **Name check:** the app looks up whose number it is and returns a shortened name, such as "K. Perera". If nobody has that number: "Nobody on CeylonPay has this number. Check it and try again." If the lookup fails: "Couldn't check that number. Try again in a moment."
3. **Risk check:** the app assesses how risky this payment looks (section 8).
4. The person moves to Step 2.

**Step 2 — Confirm** ("Step 2 of 2 · Confirm")
Shows a summary:
- You're sending: the amount.
- **Paying:** the recipient's shortened name (this is the key safety information).
- **Phone:** the recipient's number.
- **Fee:** Rs. 0.00.
- **Balance after:** balance minus the amount.

Below the summary, depending on the risk result:

| Risk result | What the person sees | What they must do |
|---|---|---|
| **Allow** (low risk) | A short notice: check the name above is the person you mean to pay; if it turns out to be a scam, report it from Activity straight away; money can only be recovered while it is still in the recipient's wallet. | Press **Send**. |
| **Warn** | A warning panel titled "This transfer looks risky" listing each reason as a plain sentence (see section 8.2), the same notice as above, and a checkbox "I understand the risk and want to send anyway". | Tick the checkbox. If phone codes are switched on, a one-time code is requested at that moment and a 6-digit code field appears (with *Resend code*); the person types the code. Then press **Send**. Send stays disabled until the checkbox is ticked and, where required, a 6-digit code is entered. |
| **Hold** (very high risk) | A panel titled "We need to review this transfer first" listing the reasons, with the line "No money leaves your wallet until a reviewer approves it. You can cancel any time before then." and the notice "Check the name above is the person you mean to pay." | The primary button reads **Submit for review** instead of Send. Pressing it does **not** move money; the payment is placed in review (see 8.3). |

Actions in Step 2: **Edit** (return to Step 1 keeping the values) and **Send Rs. X.XX**.

**If a code is required and wrong or expired:** the person stays on this step and sees the message under the code field. A code is valid for 5 minutes, allows 5 wrong tries, can be requested again every 30 seconds, and only works for this recipient and amount.

**If the situation changed between review and send** (for example the risk is now higher): the person stays on Step 2, the panel updates with the new reasons, the checkbox is cleared and must be ticked again.

**Step 3 — Result**

*Sent:* "Sent Rs. X.XX" with "to {Name} · {phone} · {date and time}", a **Reference** (the transaction id), the **New balance**, and two actions: **See activity** and **Back to wallet**.

*Held:* titled "Held for review {amount}" with the text "Nothing has left your wallet yet. We'll move the money once a reviewer approves it. You can cancel it from Activity." Shows the reference and the same actions as a sent payment.

*Failed* — one of these, each with a clear primary action:
| Failure | Title | Body | Primary action |
|---|---|---|---|
| Server unreachable | "Transfer didn't go through" | "We couldn't reach the server, so the transfer was never sent. Try again in a moment." | Try again |
| Number not registered | "No wallet on that number" | "{number} isn't registered with CeylonPay. Check the number, or ask them to sign up first." | Change the number |
| Blocked by the sender's own safety settings | "Blocked by your safety settings" | The specific reason (frozen wallet, daily limit, night limit, account on hold) | Open Safety |
| Not enough balance | "Not enough balance" | "You need Rs. X more to send Rs. Y. Deposit first, then send." | Deposit money |

Rules that apply to every transfer: you cannot send to your own number; the amount must be at least Rs. 1.00; the sender must have a verified phone when verification is switched on.

### 6.4 Receive ("Get paid")
**Purpose:** let someone pay this person by showing a code.

**Shows:**
- Heading "Get paid" with the explanation: whoever scans the code lands on the Send page with this person's number (and the amount, if set) filled in, and still checks the name before paying.
- **Amount (optional)** field, placeholder "Any amount". Leaving it empty makes a code that accepts any amount. Entering an amount updates the code immediately.
- A **QR code** that updates as the amount changes.
- The person's **name and phone number** under the code.
- A **Copy link** action that copies the same pay link as text (the label briefly confirms with "Copied").

The QR code contains a link of the form `…/transfer?to=<9-digit number>&amount=<optional amount>`. A normal phone camera can open it. Invalid or non-positive amounts are ignored (the code then has no amount).

### 6.5 Verify phone
**Shown only when the operator has switched on phone verification and the person's phone is unverified.**

- Heading "Verify your phone" with a short explanation that a 6-digit code is texted to the registered number and is needed before sending money.
- Action to **send the code**; a field for the **6-digit code**; **Resend** (not more than once every 30 seconds); **Verify**.
- Rules: code valid for 5 minutes; 5 wrong tries then a new code is needed.
- Success: the banner disappears and the person can send money. A wrong or expired code shows an error under the field.
- In a development setup the code may be shown on screen; in real use it only arrives by text.

### 6.6 Activity
**Purpose:** the full list of the person's transactions.

**Shows:**
- Heading "Activity" with a count line ("N of N transactions").
- A filter: **All · Sent · Received**.
- A list of transactions, newest first. Each row shows:
  - Direction (sent or received), counterparty name ("To K. Perera" / "From …"; deposits show "From External Funding Source"), the counterparty's phone, date and time, and the transaction reference.
  - A **status** label: *Sent*, *Received*, or for special cases *Held for review*, *Rejected*, *Cancelled*, *Reversed*, *Refund*.
  - The signed amount (negative for money out, positive for money in).
  - A row action where relevant:
    - **Cancel** on a payment that is held for review (sent by this person).
    - **Report scam** on a completed payment this person sent. (Only payments less than 30 days old can be reported. After a report is sent, the action disappears for that payment.)
- Receivers never see a payment that was held, rejected or cancelled — only completed payments (and reversals) appear in a receiver's list.

**Report scam flow:**
1. Pressing **Report scam** opens a panel above the list: "Report this transfer as a scam?" with the amount and the recipient, and the line "We'll put their outgoing money on hold and a reviewer will try to get yours back."
2. An optional free-text box: "What happened? (optional)".
3. Actions: **Send report** and **Never mind**.
4. After sending, a confirmation message replaces the panel: "Reported. The receiving account is on hold while we review it." If the report cannot be accepted (for example it was already reported, the payment is too old, or it is not a completed payment) the reason is shown instead.

**Cancel flow:** pressing **Cancel** on a held payment cancels it immediately; no money was ever taken, and the row's status changes to *Cancelled*.

**Empty state:** a short message that no money has moved yet.

### 6.7 Safety
**Purpose:** let a person protect their own wallet.

**Block 1 — Freeze wallet**
- Heading "Freeze wallet"; text: "Think someone has your phone or password? Freeze sending instantly. You can still receive money."
- A single toggle-style action: **Freeze wallet** / **Unfreeze**. While frozen, Home shows the status *Frozen* and every send is refused with the reason.

**Block 2 — Your own limits** ("Limits you set on yourself. Leave a box empty for no limit.")
- **Daily limit** (Rs.): the most this person can send in one day. Empty means no limit.
- **Night limit** (Rs.): the most they can send between 22:00 and 06:00 Sri Lanka time. Empty means no limit. A note states "Sri Lanka time."
- Action: **Save limits**, followed by a status message confirming the save.
- When a send would exceed a limit, it is refused and the Send flow shows "Blocked by your safety settings" with the exact reason.

**Another safety state the person may meet:** if a reviewer places a **review hold** on the person's account (see 6.8), sending out is blocked (receiving still works) and the Send failure message says so.

**Error state:** "Couldn't load your safety settings. Refresh to try again."

### 6.8 Review (admins only)
Three sections on one screen, each with a count in its heading and the empty message "Nothing waiting." (or for mules, "Nobody looks suspicious right now.").

**A. Held transfers** — "Stopped by the scam check. No money has moved yet."
Each item shows: amount, sender, recipient, the risk score and the list of reasons, and when it was held.
Actions: **Approve** (the payment is sent; balance and frozen state are checked again at that moment, and it fails with a clear message if the sender no longer has enough money or is frozen) and **Reject** (the payment is cancelled, nothing moves).

**B. Scam reports** — "The reported account's outgoing money is on hold. Upholding pulls back what they still have."
Each item shows: amount, who reported it, the receiver and how much money the receiver **still holds now**, the date, and the reporter's note.
Actions:
- **Uphold & recover** — takes back from the receiver as much as they still hold (up to the reported amount) and returns it to the reporter; confirmation reads "Report upheld. Money recovered where possible." Upholding also makes future payments to that receiver show a stronger warning.
- **Dismiss** — closes the report with no money moved and lifts the hold.

**C. Suspected mule accounts** — "Received from 3 or more people in the last 24 hours, and also pass money on, are new, or have been reported. Holding an account stops it sending money; it can still receive."
Each item shows: name, phone, number of different senders, amount received, amount passed on, account age, flags explaining why it was listed, and whether it is already on hold.
Actions: **Hold** (stops the account sending out) and **Release**.

---

## 7. End-to-end flows

### 7.1 First time
Register → (Verify phone, if switched on) → Home (empty state) → Deposit → Home (balance shown) → Send.

### 7.2 Send money (normal)
Send → enter number and amount → Review transfer → see recipient's shortened name and the summary → Send → Sent screen → See activity or Back to wallet.

### 7.3 Send money (risky)
Send → enter details → Review transfer → Confirm step shows the warning with reasons → tick "I understand…" → (code entered if required) → Send → Sent screen.

### 7.4 Pay by scanning
Receiver opens **Receive**, optionally types an amount, and shows the code → payer scans it (phone camera, or **Scan a QR code** inside Send) → Send opens with number (and amount) filled in → the normal Send flow continues from Review transfer. If the payer is signed out they are taken to Sign in first and then returned to the same filled-in Send page.

### 7.5 Held payment
Send → Review shows a "held" outcome → payment is placed in review, no money moves → it appears in the sender's Activity with *Held for review* and a **Cancel** action → an admin sees it in Review → **Approve** (money moves, status becomes completed) or **Reject** (cancelled) → the sender sees the final status in Activity. The sender may cancel it themselves at any time before a decision.

### 7.6 Scam report and recovery
Activity → **Report scam** on a completed payment → optional note → **Send report** → the receiver's outgoing money is held immediately → admin sees the report in Review → **Uphold & recover** (money moves back, reporter sees a *Refund* entry; the receiver sees a *Reversed* entry) or **Dismiss** (hold lifted).

### 7.7 Protecting your own wallet
Safety → **Freeze wallet** (sending refused, receiving unaffected, Home shows *Frozen*) → later **Unfreeze**. Or set a daily and/or night limit and save.

### 7.8 Signing out and back in
Log out → Sign in. A session that cannot be renewed also ends at Sign in.

---

## 8. Scam-safety rules (what drives the warnings)

### 8.1 How a payment is scored
Each payment gets a score from 0 to 100 made of the reasons below. **Below 40: allowed.** **40 to 74: warning** (sender must confirm). **75 and above: held for review** (no money moves).

### 8.2 The reasons a sender can be shown
Each is shown as one plain sentence (translated into Sinhala and Tamil). The `{…}` parts are filled in by the app.

| Code | Sentence (English) | Points |
|---|---|---|
| FIRST_PAYMENT | You have never paid this number before. | 25 |
| UNUSUAL_AMOUNT | This is much more than you usually send (about Rs. {usual}). *(more than 5× the usual, after at least 3 earlier payments)* | 25 |
| LARGER_THAN_USUAL | This is more than you usually send (about Rs. {usual}). *(more than 3× the usual)* | 15 |
| MOST_OF_BALANCE | This sends almost all of your balance. *(90% or more)* | 20 |
| HALF_OF_BALANCE | This sends more than half of your balance. | 10 |
| RAPID_PAYMENTS | You have made several payments in the last few minutes. *(3 or more in 10 minutes)* | 15 |
| LATE_NIGHT | It is the middle of the night, when scams are common. *(before 05:00 Sri Lanka time)* | 10 |
| NEW_RECEIVER | This account was opened very recently. *(under 3 days)* | 25 |
| YOUNG_RECEIVER | This account is less than two weeks old. | 10 |
| REPORTED_SCAM | Other people have reported this account for taking their money in a scam. *(an upheld report)* | 45 |
| REPORT_PENDING | Someone has reported this account and it is being reviewed. | 25 |
| MANY_SENDERS | This account received money from {count} different people today. *(5 or more)* | 20 |
| SEVERAL_SENDERS | This account received money from {count} different people today. *(3 or 4)* | 10 |
| PASS_THROUGH | Money sent to this account is being passed on straight away. | 15 |

### 8.3 What "held" means
A held payment has not left the sender's wallet. It is visible to the sender (with **Cancel**) and to admins (with **Approve / Reject**). Nothing is reserved while it waits: the sender can still spend that money elsewhere, and approval re-checks the balance.

### 8.4 Report and recovery rules
- Only a **completed** payment can be reported, only by its sender, only within **30 days**, and only once.
- Reporting immediately places the receiver's account under a review hold (they can still receive, but not send).
- An admin resolves the report: uphold (recover what the receiver still holds, up to the reported amount) or dismiss.

### 8.5 Mule detection (admin list)
An account is listed when it has received from **3 or more different people in 24 hours** and also passes on 80% or more of it, or is **under 14 days old**, or has been **reported**.

---

## 9. Phone codes (when switched on by the operator)

- **At registration:** the phone must be verified before money can be sent (Verify phone, 6.5).
- **On a warned payment:** a fresh code is required in addition to ticking the checkbox (6.3).
- Codes are 6 digits, last 5 minutes, allow 5 wrong tries, can be resent every 30 seconds, work once, and (for payments) only for the specific recipient and amount.
- When codes are switched off the code field never appears and nothing changes in the flow except that no code is requested.

---

## 10. Data the app shows about a transaction

Reference (id) · direction · counterparty shortened name · counterparty phone · amount · date and time · status (completed, held for review, rejected, cancelled, reversed, refund) · for held items: risk score and reasons.

Names of other people are always **shortened** to initial plus family name (for example "K. Perera") everywhere another person's identity appears. The NIC is never shown to anyone but its owner (and is not shown on any screen after registration).

---

## 11. Content and state checklist for the designer

For every screen above provide: the normal state, loading, empty (where applicable), error ("could not reach the server" and specific failures), success, and the disabled state of primary actions while input is incomplete or a request is in progress.

Special components the flows rely on:
- Phone input with a fixed +94 prefix and automatic digit grouping.
- Money input with rupee prefix.
- 6-digit code input with a resend control.
- QR code display and a camera scanner (scanner only where supported).
- Warning panel with a bulleted list of reasons, an acknowledgement checkbox and an optional code step.
- Status labels for transactions.
- Persistent banner for unverified phone.
- Language switcher (English / සිංහල / தமிழ்) that changes the warning text immediately.
- Confirmation messages that appear without leaving the page (report sent, limits saved, report upheld).

## 12. Out of scope today

Real money in or out (cards, bank transfers), paying shops or merchants, interbank QR (LankaQR), fees, currency other than LKR, push notifications, and editing profile details after registration.
