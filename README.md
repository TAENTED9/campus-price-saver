# UNILAG Price Saver (Campify)

**Crowdsource · Compare · Save** — A full-stack campus marketplace and price intelligence platform for the University of Lagos community

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [User Roles & Features](#user-roles--features)
- [Frontend Pages](#frontend-pages)
- [Backend API](#backend-api)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Security](#security)

---

## Overview

**UNILAG Price Saver** is a comprehensive peer-to-peer marketplace and price comparison platform built for the University of Lagos student community. Students can buy and sell items, crowdsource real-time prices across campus stores, track savings, and earn loyalty rewards.

### Problems Solved

- No transparent pricing across campus stores
- No platform for peer-to-peer student commerce
- No way to discover verified sellers or compare deals
- No community-driven price intelligence

### Core Capabilities

- Real-time price discovery across campus stores
- Peer-to-peer marketplace (buy, sell, negotiate)
- Smart price comparison factoring travel distance and cost
- Seller storefronts with trust tiers and verification
- Loyalty points, flash sales, and featured listings
- ML-powered price predictions and heatmaps
- Role-based dashboards for buyers, sellers, and admins

---

## Tech Stack

### Backend

| Component       | Technology                              |
| --------------- | --------------------------------------- |
| Framework       | FastAPI 0.109+                          |
| Database        | SQLite + SQLAlchemy ORM                 |
| Auth            | JWT (python-jose) + Argon2/bcrypt       |
| Image Hosting   | Cloudinary                              |
| Maps            | Google Maps API                         |
| Payments        | Squad API                               |
| Rate Limiting   | SlowAPI                                 |
| Server          | Uvicorn (ASGI)                          |

### Frontend

| Component       | Technology                              |
| --------------- | --------------------------------------- |
| Framework       | Next.js 16 (App Router)                 |
| Language        | TypeScript 5.9                          |
| Styling         | Tailwind CSS v4                         |
| Charts          | ApexCharts (react-apexcharts)           |
| Icons           | Lucide React                            |
| Auth Guard      | jose (JWT verification in middleware)   |
| Calendar        | FullCalendar 6                          |
| File Upload     | React Dropzone                          |
| Drag & Drop     | React DnD                               |

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│              Next.js 16 Frontend (App Router)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Buyer   │  │  Seller  │  │  Admin   │  │  Public  │    │
│  │Dashboard │  │Dashboard │  │Dashboard │  │Storefront│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│           JWT Middleware (role-based route guards)          │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                   FastAPI Backend                            │
│  auth · items · prices · seller · storefront · admin        │
│  reviews · wishlist · notifications · flash-sales           │
│  compare · stores · maps · ml · uploads · payments          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Services & Integrations                        │
│  Price Engine · Heatmap Engine · Cloudinary · Squad · Maps  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    SQLite Database                           │
│  21+ tables: users, prices, categories, stores, reviews,    │
│  wishlists, notifications, points, disputes, verifications  │
└─────────────────────────────────────────────────────────────┘
```

---

## User Roles & Features

### Buyer

- Browse and search listings by category, price range, location, condition
- View seller storefronts with trust tier badges and response metrics
- Message sellers directly via listing inquiries
- Save listings to wishlist
- Set price alerts with configurable thresholds
- Track price drops and get in-app notifications
- Net savings calculator (factors distance + travel cost before comparing)
- Leave reviews and star ratings after purchases
- Loyalty points earned on confirmed purchases
- Follow favourite sellers
- Report or block other users
- View purchase history and order tracking

### Seller

- Create and manage listings (draft → pending → active → sold/expired)
- Listing options: condition (New/Fairly Used/Used), delivery method, negotiable pricing, duration (7/14/30 days)
- Up to 5 Cloudinary-hosted photos per listing
- Duplicate existing listings
- Pause, activate, or delete listings
- Flash sales: time-limited discounts on active listings
- Seller verification workflow (student ID + business details)
- Analytics dashboard: monthly views, inquiries, sales breakdown
- Inbox for buyer inquiries with labels (Pending/Completed/Spam)
- Quick-reply templates and auto-reply / vacation mode
- Seller points (karma) system:
  - Earned for profile completion, 5-star reviews, confirmed sales
  - Spent to boost/feature listings (₦50 for 7 days, ₦150 for 30 days)
- Trust tier progression: `new_seller` → `rising` → `trusted` → `top_seller`
- Response rate and completion rate tracking
- Storefront customization (bio, banner, avatar)

### Admin

- User management: suspend, ban, restore accounts
- Listing moderation: approve, reject, flag, delete
- Seller verification queue: review and approve/reject applications
- Report management: resolve user complaints
- Dispute resolution: manage buyer-seller conflicts
- Platform-wide announcements (system banners)
- Category management
- Platform analytics and metrics
- Full audit log of all admin actions

---

## Frontend Pages

### Public / Storefront

| Route               | Page                                                    |
| ------------------- | ------------------------------------------------------- |
| `/`                 | Homepage — browse listings, featured deals, categories  |
| `/search`           | Search and filter marketplace listings                  |
| `/listing/[id]`     | Listing detail — photos, seller info, similar items     |
| `/store/[username]` | Public seller storefront                                |

### Auth

| Route     | Page                                    |
| --------- | --------------------------------------- |
| `/signin` | Login (redirects to dashboard by role)  |
| `/signup` | Register new account                    |

### Buyer Dashboard (`/dashboard`)

| Route                     | Page                              |
| ------------------------- | --------------------------------- |
| `/dashboard`              | Overview — stats, recent activity |
| `/dashboard/wishlist`     | Saved listings                    |
| `/dashboard/alerts`       | Price alert management            |
| `/dashboard/messages`     | Inbox — seller replies            |
| `/dashboard/orders`       | Purchase history                  |
| `/dashboard/points`       | Loyalty points and history        |
| `/dashboard/submissions`  | Price submissions tracker         |
| `/dashboard/settings`     | Account settings                  |

### Seller Dashboard (`/seller`)

| Route                       | Page                                         |
| --------------------------- | -------------------------------------------- |
| `/seller`                   | Overview — stats, quick actions              |
| `/seller/listings`          | Manage all listings (card layout)            |
| `/seller/listings/new`      | Create new listing                           |
| `/seller/analytics`         | Sales analytics — bar chart, funnel, gauge   |
| `/seller/inbox`             | Buyer inquiries inbox                        |
| `/seller/promotions`        | Flash sales and featured boosts              |
| `/seller/profile`           | Storefront customization                     |
| `/seller/verification`      | Verification status and application          |
| `/seller/points`            | Seller points and rewards                    |
| `/seller/settings`          | Account settings                             |

### Admin Dashboard (`/admin`)

| Route                            | Page                           |
| -------------------------------- | ------------------------------ |
| `/admin`                         | Platform overview              |
| `/admin/users/buyers`            | Buyer management               |
| `/admin/users/sellers`           | Seller management              |
| `/admin/listings`                | All listings moderation        |
| `/admin/listings/flagged`        | Flagged listings               |
| `/admin/seller`                  | Seller verifications (tabbed)  |
| `/admin/reports`                 | User reports queue             |
| `/admin/disputes`                | Buyer-seller disputes          |
| `/admin/announcements`           | System announcements           |
| `/admin/categories`              | Category management            |
| `/admin/analytics`               | Platform analytics             |
| `/admin/audit-log`               | Admin action history           |

---

## Backend API

### Auth — `/api/auth`

```http
POST   /register              Create account
POST   /login                 JWT login
GET    /me                    Current user info
PUT    /me                    Update profile
POST   /validate-token        Verify token
POST   /logout                Logout
POST   /send-otp              Send OTP email
POST   /verify-otp            Confirm OTP
POST   /change-password       Change password
GET    /sessions              List active sessions
DELETE /sessions/{id}         Revoke session
```

### Items & Categories — `/api/items`

```http
GET    /categories/all        All categories
POST   /categories/           Create category (admin)
GET    /prices/all            All approved listings
GET    /prices/new            Recent arrivals
GET    /prices/trending       High-view listings
GET    /prices/{id}           Single listing detail
```

### Prices / Marketplace — `/api/prices`

```http
POST   /                      Create listing
POST   /draft                 Save as draft
GET    /compare/{item_id}     Compare prices across sellers
GET    /admin/drafts          Pending approvals (admin)
POST   /admin/drafts/{id}/approve
POST   /admin/drafts/{id}/reject
WS     /ws/prices             Real-time price broadcast
```

### Seller Dashboard — `/api/seller`

```http
GET    /stats                              Dashboard overview
GET    /listings                           Seller's listings
POST   /listings                           Create listing
PATCH  /listings/{id}                      Update listing
DELETE /listings/{id}                      Delete listing
PATCH  /listings/{id}/listing-status       Pause/activate
POST   /listings/{id}/duplicate            Clone listing
GET    /analytics                          Monthly/daily analytics
GET    /verification                       Verification status
GET    /inquiries                          Buyer messages
PATCH  /inquiries/{id}/read                Mark read
PATCH  /inquiries/{id}/label               Label inquiry
PATCH  /profile                            Update storefront profile
GET    /quick-replies                      Reply templates
PUT    /quick-replies                      Save templates
GET    /auto-reply                         Away message
PUT    /auto-reply                         Set away message
GET    /scorecard                          Response and completion rates
POST   /vacation                           Toggle vacation mode
POST   /karma/profile-complete             Award setup points
```

### Storefront — `/api/storefront`

```http
GET    /stats                       Storefront overview
GET    /listing/{id}                Listing and seller info
GET    /listing/{id}/similar        Similar listings
GET    /store/{username}            Seller public profile
POST   /follow/{seller_id}          Follow seller
GET    /follow/{seller_id}/status   Follow check
POST   /listing/{id}/inquiry        Contact seller
POST   /listing/{id}/report         Report listing
POST   /user/{id}/report            Report seller
POST   /user/{id}/block             Block user
GET    /user/{id}/block-status      Block check
GET    /buyer/inbox                 Buyer messages
```

### Flash Sales — `/api/flash-sales`

```http
GET    /active        Active flash sales (public)
POST   /              Create flash sale (seller)
DELETE /{id}          Cancel flash sale
```

### Reviews — `/api/reviews`

```http
POST   /listing/{id}          Submit review
GET    /listing/{id}          Listing reviews
PATCH  /{id}/response         Seller reply to review
GET    /seller/{id}           Seller review summary
```

### Wishlist — `/api/wishlist`

```http
POST   /        Add to wishlist
GET    /        User's wishlist
DELETE /{id}    Remove from wishlist
```

### Notifications — `/api/notifications`

```http
GET    /                  All notifications
GET    /unread-count      Unread count
PATCH  /{id}/read         Mark read
POST   /mark-all-read     Mark all read
DELETE /{id}              Delete notification
DELETE /                  Clear all
```

### Admin — `/api/admin`

```http
GET    /users                        All users
PATCH  /users/{id}/suspend           Suspend user
PATCH  /users/{id}/ban               Ban user
PATCH  /users/{id}/restore           Restore user
GET    /listings                     All listings
PATCH  /listings/{id}/approve        Approve
PATCH  /listings/{id}/reject         Reject
DELETE /listings/{id}                Delete
PATCH  /listings/{id}/flag           Flag listing
PATCH  /listings/{id}/unflag         Clear flag
GET    /reports                      User reports
PATCH  /reports/{id}/resolve         Resolve report
GET    /disputes                     Disputes
PATCH  /disputes/{id}                Update dispute
GET    /announcements                Announcements
POST   /announcements                Create announcement
PATCH  /announcements/{id}           Update announcement
DELETE /announcements/{id}           Delete announcement
GET    /audit-log                    Admin action log
```

### Other APIs

```http
/api/compare     Net savings calculation, store switching recommendations
/api/stores      Nearby stores, location-based search
/api/maps        Google Maps autocomplete, reverse geocoding
/api/upload      Cloudinary image upload
/api/ml          Price trend predictions, recommendations, heatmaps
/api/payments    Squad payment link generation
```

---

## Project Structure

```text
backend/
├── app/                          # FastAPI backend
│   ├── main.py                   # Entry point, CORS, router registration
│   ├── models.py                 # SQLAlchemy ORM models (21+ tables)
│   ├── schemas.py                # Pydantic request/response schemas
│   ├── database.py               # DB config and session management
│   ├── dependencies.py           # Shared auth dependencies
│   ├── routers/
│   │   ├── auth.py
│   │   ├── items.py
│   │   ├── prices.py
│   │   ├── seller.py
│   │   ├── storefront.py
│   │   ├── flash_sales.py
│   │   ├── reviews.py
│   │   ├── wishlist.py
│   │   ├── notifications.py
│   │   ├── admin_users.py
│   │   ├── admin_items.py
│   │   ├── admin_stats.py
│   │   ├── compare.py
│   │   ├── stores.py
│   │   ├── google_maps.py
│   │   ├── ml.py
│   │   ├── payments.py
│   │   ├── uploads.py
│   │   └── pending.py
│   └── services/
│       ├── cloudinary_upload.py  # Image hosting
│       ├── email.py              # OTP and transactional emails
│       ├── heatmap_engine.py     # Price distribution heatmaps
│       ├── price_engine.py       # Price validation and comparison logic
│       └── squad.py              # Payment processing
│
├── price-saver-frontend/         # Next.js 16 frontend
│   ├── middleware.ts             # JWT route guards (jose)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/           # /signin, /signup
│   │   │   ├── (storefront)/     # /, /search, /listing/[id], /dashboard
│   │   │   ├── seller/           # /seller/* dashboard
│   │   │   ├── admin/            # /admin/* dashboard
│   │   │   ├── store/            # /store/[username] public storefronts
│   │   │   ├── buyer/            # /buyer/[userId]/* legacy routes
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   └── seller/
│   │   │       └── SellerSidebar.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx   # useAuth() — user, token, logout
│   │   └── lib/
│   │       └── api.ts            # API client (all fetch wrappers)
│   └── package.json
│
├── api/
│   └── index.py                  # Vercel serverless entry point
├── requirements.txt
├── vercel.json
├── docker-compose.yml
├── Dockerfile
└── data.db                       # SQLite database (auto-created)
```

---

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+

### Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables — create a .env file:
#   DATABASE_URL=sqlite:///./data.db
#   JWT_SECRET=your-secret-key
#   GOOGLE_MAPS_API_KEY=your-key
#   CLOUDINARY_CLOUD_NAME=...
#   CLOUDINARY_API_KEY=...
#   CLOUDINARY_API_SECRET=...
#   SQUAD_SECRET_KEY=...

# Run the server (database auto-created on first start)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at `http://localhost:8000/docs`.

### Frontend Setup

```bash
cd price-saver-frontend

# Install dependencies
npm install

# Create .env.local:
#   NEXT_PUBLIC_API_URL=http://localhost:8000
#   NEXT_PUBLIC_JWT_SECRET=your-secret-key

npm run dev
```

Frontend available at `http://localhost:3000`.

---

## Deployment

### Vercel

The project includes `vercel.json` and `api/index.py` for Vercel serverless deployment:

```bash
npm i -g vercel
vercel
```

### Docker

```bash
docker-compose up --build
```

### Production Notes

- Switch SQLite to PostgreSQL for production scale
- Set `NEXT_PUBLIC_JWT_SECRET` to a strong random secret shared with the backend
- Configure CORS allowed origins in `app/main.py`
- Enable HTTPS via your hosting provider

---

## Security

- **Password Hashing** — Argon2 + bcrypt via passlib
- **JWT Auth** — Signed tokens (24h expiry), verified server-side on every request
- **Middleware Route Guards** — Next.js middleware verifies JWT and enforces role-based access (buyer/seller/admin) on all protected routes
- **Input Validation** — Pydantic schemas on all API endpoints
- **SQL Injection Protection** — SQLAlchemy ORM (no raw queries)
- **Rate Limiting** — SlowAPI on sensitive endpoints
- **Image Hosting** — Cloudinary (no user-uploaded files stored on server)
- **Role Isolation** — Sellers cannot access buyer data, buyers cannot access seller dashboards, admin-only endpoints reject non-admin tokens

---

## Database Models

21+ SQLAlchemy models including:

`User` · `Price` (listings) · `Category` · `Store` · `FlashSale` · `Review` · `Inquiry` · `Wishlist` · `Notification` · `PointsTransaction` · `Follow` · `BlockedUser` · `SellerVerification` · `Report` · `Dispute` · `AuditLog` · `Announcement` · `UserPreference` · `PriceAlert`

---

Built with love for the UNILAG community
