# Spendwise — MERN Expense Tracker

Spendwise is a full-stack expense tracker built with MongoDB, Express, React, and Node.js. Track income and expenses, categorize spending, set monthly budgets, and visualize your finances with charts.

## Features

- **Authentication** — JWT-based register/login, passwords hashed with bcrypt
- **Google OAuth (New)** — One-click "Sign in with Google" & "Sign up with Google" powered by Google Identity Services and backend token verification
- **Email (SMTP) Notifications for OTP (New)** — Real-time 6-digit verification codes sent via Gmail SMTP for:
  - Secure self-service password reset workflow ("Forgot password?")
  - Passwordless sign-in with email verification code
  - 10-minute auto-expiry TTL security in MongoDB
- **Transactions** — add, edit, delete, filter by month, type, category, or search text
- **Categories** — default categories shared across all users, plus custom per-user categories
- **Budgets** — set a monthly spending limit per category and track progress with a visual bar
- **Dashboard** — monthly income/expense/balance summary, a spending-by-category pie chart, a yearly income vs. expense trend chart, and a responsive SpendWise Split summary section
- **SpendWise Split (New)** — Friend-to-friend expense splitting inspired by Splitwise:
  - Friend management: Search users, send/accept/reject requests, view friends
  - Shared expenses: Equal splits with exact penny precision and custom share splits
  - Balance calculations: Live friend-to-friend net balances and overall totals without counting own share as debt
  - Settlements workflow: Record repayments, require recipient confirmation before adjusting balances, prevent repayments exceeding outstanding debt
  - Dashboard integration: Overview cards ("You are owed", "You owe"), pending settlement actions, recent splits, quick actions
- **Design** — a custom "ledger" visual identity: ink/paper palette, Fraunces + Inter + IBM Plex Mono type, dotted-leader transaction rows styled like a paper ledger

## Tech Stack

| Layer    | Technology                                                              |
| -------- | ----------------------------------------------------------------------- |
| Frontend | React (Vite), React Router, Tailwind CSS, Recharts, Axios, lucide-react |
| Backend  | Node.js, Express                                                        |
| Database | MongoDB (Mongoose)                                                      |
| Auth     | JWT, bcryptjs                                                           |

## Project Structure

```
spendwise/
├── SpendWise_Split.postman_collection.json # Ready-to-import Postman tests
├── server/                 # Express API
│   ├── config/db.js        # MongoDB connection
│   ├── models/             # User, Category, Transaction, Budget, Friendship, SharedExpense, Settlement
│   ├── controllers/        # Route handlers (auth, transaction, category, budget, friend, split)
│   ├── routes/             # Express routers (including friendRoutes, splitRoutes)
│   ├── middleware/         # auth, error handling, async wrapper
│   ├── tests/              # Automated test suite (splitApiTests.js)
│   ├── utils/               # JWT helper, category seed script
│   └── server.js           # App entry point
└── client/                 # React app
    └── src/
        ├── pages/          # Login, Register, Dashboard, Split, Transactions, Categories, Budgets
        ├── components/     # Layout, Split section, modals, forms, charts, etc.
        ├── context/         # AuthContext (JWT session state)
        ├── services/api.js # Axios instance with auth interceptor
        └── utils/format.js # Currency/date/month helpers
```

## Getting Started

### Prerequisites

- Node.js 18+
- A MongoDB instance — either local (`mongod`) or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster

### 1. Backend setup

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env` and set:

- `MONGODB_URI` — your MongoDB connection string (e.g. `mongodb+srv://.../spendwise?retryWrites=true&w=majority`)
- `JWT_SECRET` — your secret key
- `CLIENT_URL` — `http://localhost:5173` for local dev

Seed the default categories (Salary, Groceries, Rent, etc.) once:

```bash
npm run seed
```

Start the API server:

```bash
npm run dev
```

The API runs on `http://localhost:5000` by default. Visit `http://localhost:5000/api/health` to confirm it's up.

### 2. Frontend setup

In a new terminal:

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

The app runs on `http://localhost:5173`. Open it, register an account, and start splitting expenses and tracking finances.

### 3. Production build (frontend)

```bash
cd client
npm run build
```

This outputs static files to `client/dist`.

---

## Testing SpendWise Split

### Automated CLI Test Suite
Run the test suites:

```bash
cd server

# 1. Run all SpendWise Split tests (38 test cases)
npm test

# 2. Run Google OAuth & Email OTP verification tests (19 test cases)
npm run test:auth

# 3. Run all test suites together (57 test cases)
npm run test:all
```

Covers:
1. Friend requests (search, sending, self-request rejection, duplicate prevention, accept, reject)
2. Equal and custom splits (including penny-rounding precision)
3. Invalid amounts (<= 0), non-friend participants, and mismatched custom shares
4. Unauthorized access prevention (privacy checks on view/edit/delete)
5. Reliable balance calculations (ensuring user's own share is never counted as debt)
6. Settlements workflow (partial & full repayments; balances only update on confirmation)
7. Duplicate settlement and exceeding repayment prevention
8. Dynamic balance recalculation on shared expense update and deletion
9. Core app regression tests (auth, personal transactions, categories, analytics)
10. Google OAuth token validation & account auto-linking
11. Gmail SMTP live notification delivery, OTP lifecycle, and passwordless login

### Postman Collection
Import `SpendWise_Split.postman_collection.json` into Postman. It includes preconfigured test scripts and variables (`baseUrl`, tokens, and IDs) to execute tests across all feature endpoints.

---

## API Reference

All routes except public auth routes (`/api/auth/register`, `/api/auth/login`, `/api/auth/google`, `/api/auth/send-otp`, `/api/auth/verify-otp`, `/api/auth/reset-password`, `/api/auth/login-otp`) require an `Authorization: Bearer <token>` header.

```
Auth
POST   /api/auth/register        { name, email, password }
POST   /api/auth/login           { email, password }
POST   /api/auth/google          { credential }
POST   /api/auth/send-otp        { email, purpose }
POST   /api/auth/verify-otp      { email, otp, purpose }
POST   /api/auth/reset-password  { email, otp, newPassword }
POST   /api/auth/login-otp       { email, otp }
GET    /api/auth/me

Categories
GET    /api/categories
POST   /api/categories           { name, type, color }
PUT    /api/categories/:id
DELETE /api/categories/:id

Transactions
GET    /api/transactions         ?month=YYYY-MM&type=&category=&search=&page=&limit=
POST   /api/transactions         { amount, type, category, description, date }
PUT    /api/transactions/:id
DELETE /api/transactions/:id

Analytics
GET    /api/analytics/summary?month=YYYY-MM
GET    /api/analytics/by-category?month=YYYY-MM&type=expense
GET    /api/analytics/trend?year=YYYY

Budgets
GET    /api/budgets?month=YYYY-MM
POST   /api/budgets              { category, monthlyLimit, month }
DELETE /api/budgets/:id

Friends (SpendWise Split)
GET    /api/friends/search       ?query=name_or_email
GET    /api/friends              (list accepted friends)
GET    /api/friends/requests     (list incoming & outgoing pending requests)
POST   /api/friends/request      { recipientId }
PUT    /api/friends/requests/:id { action: "accept" | "reject" }
DELETE /api/friends/:id          (remove friend / cancel request)

SpendWise Split (Expenses & Settlements)
GET    /api/split/balances       (user totals & friend breakdown)
GET    /api/split/balances/:friendId
POST   /api/split/expenses       { description, amount, payer, splitType, participants, splits, category, date }
GET    /api/split/expenses       ?friendId=&page=&limit=
GET    /api/split/expenses/:id
PUT    /api/split/expenses/:id
DELETE /api/split/expenses/:id
POST   /api/split/settlements    { recipientId, amount, date, note }
GET    /api/split/settlements    (user's sent & received repayments)
PUT    /api/split/settlements/:id/confirm (recipient confirms repayment)
PUT    /api/split/settlements/:id/reject  (recipient rejects repayment)
DELETE /api/split/settlements/:id         (cancel pending repayment)
```

## License

This project was generated as a portfolio starter — use it freely as a base for your own work.

