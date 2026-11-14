# LedgerPay — how the payment system works (simple version)

## 1. The big idea in one line
Every rupee lives in a **ledger** (a notebook of CREDIT and DEBIT lines).
**Balance = total credits − total debits.** We never store or edit a balance number. We only add lines.

```
Asha pays Bharat ₹100   →   ledger gets 2 lines (never edited, never deleted)
   DEBIT   Asha's account    ₹100
   CREDIT  Bharat's account  ₹100
```

## 2. What every user gets (auto-generated at sign-up)
| Thing | Example | Made by |
|---|---|---|
| Account number | `501234567890` (12 digits) | `identifier.service.js` → random, checked unique |
| IFSC | `LDGR0001001` | fixed "branch code" of our app |
| UPI ID | `asha4821@ledger` | name + 4 random digits + `@ledger` |
| QR code | opens `/send?to=asha4821@ledger` | frontend (`qrcode.react`) |
| Payment PIN | 4 or 6 digits | user sets it, stored **hashed** (bcrypt) |

A user can also open a **MERCHANT** account (business name, own UPI ID like `meerabakery1234@ledger`).

## 3. The money flows

### A) Add money (real money comes IN) — Razorpay
```
Browser            Our server                 Razorpay
  | amount ₹500 ->  | create order  ---------->  |
  | <- orderId      |                            |
  | ---- opens Razorpay popup, pays by UPI/card ->|
  | <- {order_id, payment_id, signature}         |
  | -> /topup/verify| check signature (HMAC)     |
  |                 | ledger: SYSTEM → user ₹500 |
  |                 | <---- webhook (backup) ----|
```
- **Signature check** = proof the payment really happened (only Razorpay + our server know the secret).
- **Webhook** = Razorpay calls our server directly, so money is credited even if the user closes the tab.
- Both can arrive → idempotency key `topup:<orderId>` makes sure we credit **once**.
- No Razorpay keys? A **test gateway** screen is shown instead (disabled in production).

### B) Send money (user → user, or user → merchant)
1. Type UPI ID **or** account number + IFSC
2. `POST /api/payments/resolve` → server answers "Bharat Rao" (so you know who you're paying)
3. Enter amount + note, choose account
4. Enter PIN → `POST /api/payments/send`
5. Receipt with a 12-digit reference number

### C) Merchant collects money
- Dashboard: create a **payment request** (₹60 "2 masala chai") → QR + link `/pay/request/<id>`
- Customer scans → logs in → enters PIN → paid. The request turns **PAID** in the same DB transaction as the money move, so it can never be paid twice.
- **API**: merchant generates an API key and creates links from their own website:
  ```bash
  curl -X POST http://localhost:3000/api/v1/payment-links \
    -H "Authorization: Bearer lk_test_xxx" -H "Content-Type: application/json" \
    -d '{"amount":499,"note":"Order #42","reference":"ORDER-42"}'
  ```
  → returns `payUrl`. Check status with `GET /api/v1/payment-links/<id>`.

## 4. Safety rules (why money can't go wrong)
| Problem | How we stop it |
|---|---|
| Paying from someone else's account | server checks the account belongs to the logged-in user |
| Clicking "Pay" twice / network retry | **idempotency key**: same key = same payment, processed once |
| Two payments at the same instant spending the same balance | sender account is "locked" (`lockVersion` bump) inside a MongoDB transaction → one waits & re-checks |
| Half-finished payment (debit saved, credit not) | everything inside **one MongoDB transaction** — all or nothing |
| Someone edits history | ledger model blocks update/delete hooks |
| Guessing the PIN | 5 wrong tries → locked 15 minutes |
| Fake "payment success" from the browser | Razorpay signature + webhook signature verified on the server |
| Stolen API key in the DB | only a SHA-256 hash is stored; full key shown once |
| Token stolen by JS (XSS) | login token is in an `httpOnly` cookie |

## 5. All API routes
| Method | Route | What |
|---|---|---|
| POST | `/api/auth/register` `login` `logout` | auth (register also opens an account) |
| GET | `/api/auth/me` | current user + `hasPin` |
| POST | `/api/auth/pin` | set PIN `{password, pin}` |
| GET/POST | `/api/accounts` | list (with balance, UPI, acc no.) / open PERSONAL or MERCHANT |
| GET | `/api/accounts/balance/:id` | balance |
| POST | `/api/payments/resolve` | who owns this UPI ID / account no. |
| POST | `/api/payments/send` | pay `{fromAccountId,to,ifsc?,amount,note?,pin,idempotencyKey}` |
| GET | `/api/payments/requests/:id` | view a payment link (public) |
| POST | `/api/payments/requests/:id/pay` | pay a link `{fromAccountId,pin}` |
| GET | `/api/transactions` | history |
| GET | `/api/topup/config` | RAZORPAY or MOCK mode |
| POST | `/api/topup/order` → `/api/topup/verify` | add money |
| POST | `/api/topup/webhook` | Razorpay → us |
| POST/GET | `/api/merchant/requests` | create / list payment requests |
| POST | `/api/merchant/requests/:id/cancel` | cancel |
| POST/GET/DELETE | `/api/merchant/api-keys` | manage API keys |
| POST/GET | `/api/v1/payment-links` | **merchant public API** (API key) |

## 6. Files
```
src/services/ledger.service.js     ← the ONLY place money moves (transfer)
src/services/gateway.service.js    ← Razorpay / test gateway + signature checks
src/services/identifier.service.js ← account number + UPI ID generator
src/services/pin.service.js        ← PIN hash, verify, lockout
src/controllers/payment.controller.js   send, resolve, pay link
src/controllers/topup.controller.js     add money + webhook
src/controllers/merchant.controller.js  requests + API keys
src/controllers/publicApi.controller.js /api/v1
client/                             ← React (Vite) website
```

## 7. Run it
```bash
cp .env.example .env          # fill MONGO_URI + JWT_SECRET
npm install
npm run seed:system           # creates the SYSTEM account money "comes from"
npm run dev                   # backend  :3000
npm --prefix client install
npm run client                # website  :5173  (open this)
```
Production: `npm run build` then `npm start` — Express serves the built React app too.

## 8. Honest limits — what a REAL bank/UPI app needs extra
- **UPI IDs here only work inside this app.** `@ledger` is not a real bank handle. Real UPI IDs need an NPCI-licensed bank/PSP partner.
- **Money in** is real only through Razorpay (KYC'd Razorpay account, live keys).
- **Money out to a real bank account** (withdraw) needs a payouts product such as RazorpayX Payouts + KYC. Not built.
- Holding customers' money as a wallet in India needs an **RBI PPI licence** (or you act as a marketplace via a partner). Talk to your gateway before going live.
- Add before production: rate limiting, KYC, email/OTP verification, refunds, admin panel, audit logs, amounts in paise (integers).
