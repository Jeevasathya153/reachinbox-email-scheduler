# ReachInbox Full-Stack Email Job Scheduler

A production-grade, full-stack **Email Job Scheduler** assignment project built with **React, TypeScript, Express, XAMPP MySQL, BullMQ, Redis, and Ethereal SMTP**.

---

## Project Overview

This application implements a persistent email scheduling system that allows users to authenticate via Google OAuth, compose and schedule email batches with custom delay offsets and hourly rate limits, persist jobs in Redis via BullMQ, store records in MySQL, and simulate email delivery through Ethereal SMTP with live preview URLs.

---

## Architecture Diagram

```
Google OAuth Login
          ↓
React + TypeScript Frontend (http://localhost:5173)
          ↓
Express + TypeScript Backend API (http://localhost:3000)
          ↓
XAMPP MySQL Database (localhost:3306)
          ↓
BullMQ Queue ('email-queue')
          ↓
Local Redis (127.0.0.1:6379)
          ↓
BullMQ Email Worker Process
          ↓
Nodemailer + Ethereal SMTP (smtp.ethereal.email:587)
          ↓
Ethereal Preview URL (Stored in MySQL & rendered in Sent Emails UI)
```

---

## Features

- **Real Google OAuth Authentication**: Complete Google Cloud OAuth authentication flow (`/auth/google`, `/auth/google/callback`, `/api/auth/me`).
- **Batch Email Scheduling ("Send Later")**: Upload CSV leads or input recipient emails manually, configure start time, delay offset between recipients, and hourly limits.
- **BullMQ + Redis Delayed Queue**: Scheduled email jobs are queued in Redis via BullMQ (`email-queue`) and survive server process restarts.
- **Ethereal-Only Test SMTP Delivery**: Simulated email delivery using Nodemailer and Ethereal SMTP. Captures preview URLs (`ethereal_preview_url`) and displays a **View Ethereal Mail** button in the UI.
- **Atomic Idempotency & Concurrency**: DB-level status locks (`UPDATE emails SET status = 'processing' WHERE id = ? AND status = 'scheduled'`) prevent double-sending across worker threads.
- **Time Editing & Rescheduling**: Edit pending email start times via `PUT /api/emails/:id/schedule`, which updates MySQL `scheduled_at`, cancels the old BullMQ job, and enqueues a new delayed job.
- **Clean Diagnostic Startup Logs**: Backend and Worker report clear, single-line diagnostic indicators for MySQL, Redis, Ethereal SMTP, and Worker queue readiness.

---

## Tech Stack

### Backend
- **Language**: TypeScript
- **Framework**: Express.js
- **Queue System**: BullMQ
- **In-Memory Store**: Redis / Memurai (Port 6379)
- **Database**: MySQL via `mysql2/promise` (Port 3306)
- **Email Transport**: Nodemailer + Ethereal SMTP

### Frontend
- **Framework**: React (Vite)
- **Language**: TypeScript
- **Styling**: Modern CSS / Flexbox / Grid

---

## Prerequisites

- **Node.js** v18+ and `npm`
- **XAMPP MySQL** (Running on `localhost:3306`)
- **Redis / Memurai for Windows** (Running on `127.0.0.1:6379`)

> **Note**: Docker and PostgreSQL are **not required**.

---

## Environment Setup

1. **Backend Environment Setup**:
   Copy `backend/.env.example` to `backend/.env` and update credentials:
   ```bash
   cp backend/.env.example backend/.env
   ```

   **`backend/.env` structure**:
   ```env
   NODE_ENV=development
   PORT=3000
   SESSION_SECRET=replace_with_local_session_secret
   FRONTEND_URL=http://localhost:5173

   # MySQL Configuration (XAMPP MySQL)
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=reachinbox

   # Redis Configuration
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379

   # Ethereal Email Settings (Auto-generated if empty)
   ETHEREAL_HOST=smtp.ethereal.email
   ETHEREAL_PORT=587
   ETHEREAL_USER=
   ETHEREAL_PASSWORD=

   # Google OAuth Credentials
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

   # Worker Settings
   WORKER_CONCURRENCY=5
   MIN_EMAIL_DELAY_MS=2000
   MAX_EMAILS_PER_HOUR=200
   ```

2. **Frontend Environment Setup**:
   Copy `frontend/.env.example` to `frontend/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:3000
   ```

---

## Infrastructure Setup Instructions

### 1. MySQL Setup (XAMPP)
- Start XAMPP Control Panel and click **Start** next to MySQL.
- Verify MySQL is listening on `localhost:3306`.
- Database `reachinbox` and required tables (`users`, `emails`, `slack_connections`) are initialized automatically on startup.

### 2. Redis / Memurai Setup (Windows)
- Start Memurai or Redis server on Windows.
- Verify Redis port connectivity in PowerShell:
  ```powershell
  Test-NetConnection 127.0.0.1 -Port 6379
  ```
  Expected output: **`TcpTestSucceeded : True`**

### 3. Google OAuth Setup
- Create an OAuth 2.0 Client ID in Google Cloud Console.
- Add Authorized Redirect URI: `http://localhost:3000/auth/google/callback`.
- Copy your Client ID and Client Secret into `backend/.env`.

---

## Running the Project

Open 3 PowerShell terminal windows inside the root directory:

```powershell
# Terminal 1: Express Server
cd backend
npm run dev

# Terminal 2: BullMQ Worker Process (Auto-starts inside server as well)
cd backend
npm run worker

# Terminal 3: React Frontend Application
cd frontend
npm run dev
```

- **Frontend Application**: `http://localhost:5173`
- **Backend API**: `http://localhost:3000`
- **BullMQ Live Queue Dashboard**: `http://localhost:3000/admin/queues`

---

## Testing & Typecheck Verification

Run TypeScript compilation and Jest tests:

```powershell
# Backend Type Check
cd backend
npx tsc --noEmit

# Frontend Type Check
cd ../frontend
npx tsc --noEmit

# Run Backend Unit Tests
cd ../backend
npm test
```

---

## Demo Flow Walkthrough

1. **Start Services**: Ensure XAMPP MySQL and Redis (Port 6379) are active.
2. **Launch Application**: Start backend, worker, and frontend.
3. **Login**: Open `http://localhost:5173` and authenticate via **Login with Google**.
4. **Compose & Schedule**: Click **Compose**, enter or upload email leads, select a future start time, and click **Send Later**.
5. **Scheduled List**: Verify email records immediately appear in the **Scheduled Emails** tab.
6. **Time Edit**: Click **Edit Time** on any scheduled email row, pick a new start time, and click **Save New Time**.
7. **Worker Execution**: When the start time arrives, BullMQ worker processes the job, submits it via Ethereal SMTP, updates status to `sent`, and stores `ethereal_preview_url`.
8. **Sent List & Preview**: Email moves to **Sent Emails**. Click **View Ethereal Mail** to view the test message preview.

---

## Assignment Requirements Mapping

| Requirement | Implementation Detail | Status |
| :--- | :--- | :---: |
| **Google OAuth** | Authenticates users via real Google Cloud OAuth (`/auth/google`) and persists sessions in MySQL. | ✅ Implemented |
| **MySQL Database** | Connects via `mysql2/promise` to XAMPP MySQL (`reachinbox` DB on `localhost:3306`). | ✅ Implemented |
| **BullMQ + Redis** | Queue engine (`email-queue`) backed by Redis (`127.0.0.1:6379`). Jobs persist across restarts. | ✅ Implemented |
| **Ethereal SMTP** | Simulates test sending via Nodemailer & Ethereal SMTP with live `ethereal_preview_url` generation. | ✅ Implemented |
| **Time Rescheduling** | `PUT /api/emails/:id/schedule` updates MySQL `scheduled_at` & reschedules BullMQ delayed job. | ✅ Implemented |
| **Atomic Idempotency**| `UPDATE emails SET status = 'processing' WHERE id = ? AND status = 'scheduled'` prevents double-sends. | ✅ Implemented |
| **Clean Logging** | Throttled Redis error handlers prevent console log spam when Redis is offline. | ✅ Implemented |
