# Digital Goods Marketplace Monorepo

A production-oriented digital goods marketplace platform consisting of a high-performance Go backend and a modern Next.js frontend.

## System Architecture
- **Backend**: Go 1.22+ (Gin Web Framework, PostgreSQL driver via `pgx/v5`, Redis client via `go-redis/v9`, AWS S3/Cloudflare R2 integration, JWT authentication, and structured logging via `zerolog`).
- **Frontend**: Next.js 14 (App Router, TypeScript, React Query, Zustand, TailwindCSS, Framer Motion, and Stripe/Tebex checkout integrations).
- **Process Manager**: PM2 (for managing and daemonizing both the frontend and backend applications in production).
- **Services**: PostgreSQL 16+ (Database) and Redis 7+ (Rate limiting, CSRF protection, and worker queue).

---

## Directory Structure
```text
marketplace/
├── backend/                  # Go backend source code
│   ├── cmd/                  # Entry points (server, checkconfig, devtoken)
│   ├── internal/             # Core business logic, repositories, and handlers
│   ├── migrations/           # SQL database migrations
│   └── .env.example          # Backend environment configuration template
├── frontend/                 # Next.js frontend source code
│   ├── app/                  # Next.js App Router pages and layouts
│   ├── components/           # Reusable UI components
│   ├── scripts/              # Frontend deployment automation scripts
│   └── .env.local.example    # Frontend environment configuration template
└── docker-compose.yml        # Docker configuration for PostgreSQL & Redis
```

---

## 1. Prerequisites

Before installing, ensure the following software is installed on the host machine:
- **Go**: Version 1.22.2 or higher
- **Node.js**: Version 18+ (with `pnpm` package manager installed globally: `npm install -g pnpm`)
- **Docker & Docker Compose**: For spinning up database and cache services locally
- **PM2**: For process management in production (`npm install -g pm2`)

---

## 2. Infrastructure Setup (Database & Redis)

### Option A: Quick Setup with Docker Compose (Recommended)
To spin up both PostgreSQL 16 and Redis 7 instances automatically:
```bash
docker compose up -d
```
This starts:
- **PostgreSQL** on port `5432` (Default database: `marketplace_db`, User: `postgres`, Password: `postgres`)
- **Redis** on port `6379` (passwordless, DB `0`)

### Option B: Manual Installation
If you prefer to install services natively on Ubuntu:
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create Database and User
sudo -u postgres psql -c "CREATE DATABASE marketplace_db;"
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE marketplace_db TO postgres;"

# Install Redis
sudo apt install redis-server -y
sudo systemctl start redis
sudo systemctl enable redis
```

---

## 3. Database Schema Migrations

The database schema is defined as a series of raw SQL migration steps inside the `backend/migrations/` directory.

### Method 1: Using `golang-migrate` CLI (Recommended)
1. Install `golang-migrate` CLI on the machine:
   ```bash
   curl -L https://github.com/golang-migrate/migrate/releases/download/v4.17.0/migrate.linux-amd64.tar.gz | tar xvz
   sudo mv migrate /usr/local/bin/
   ```
2. Run all up migrations to configure the schema:
   ```bash
   migrate -path backend/migrations -database "postgres://postgres:postgres@localhost:5432/marketplace_db?sslmode=disable" up
   ```

### Method 2: Manual SQL Import
If you do not have `golang-migrate`, you can apply the migration files sequentially (from `001` to `009`) using the `psql` command:
```bash
for file in $(ls backend/migrations/*.up.sql | sort); do
  echo "Applying $file..."
  psql -h localhost -U postgres -d marketplace_db -f "$file"
done
```

---

## 4. Backend Configuration & Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create configuration file**:
   Copy `.env.example` to `.env` and fill in the values:
   ```bash
   cp .env.example .env
   ```

3. **Key Configuration Options (`.env`)**:
   - `PORT`: Port the Go Gin server runs on (default: `8080`).
   - `APP_SECRET`: Random long string for encryption.
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL connection details.
   - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Redis connection details.
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: Secrets to sign JWT access and refresh tokens.
   - `STORAGE_PROVIDER`: Either `r2` (Cloudflare R2) or `s3` (Amazon S3) for digital product file storage. Provide the corresponding API keys and bucket details.
   - `EMAIL_PROVIDER`: Either `resend` or `smtp`. If using `resend`, fill `RESEND_API_KEY`. If using `smtp`, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`.
   - **Payment Integrations**: Fill in Stripe, PayPal, or Tebex credentials:
     - `TEBEX_HEADLESS_ENABLED`: Set to `true` if utilizing Tebex Headless Checkout.
     - `TEBEX_PUBLIC_TOKEN` & `TEBEX_PRIVATE_KEY`: API keys from Tebex Creator Panel.
   - **DGEN Auth**: Configurations for OAuth client/provider integration (DGEN Server details).

4. **Install backend dependencies**:
   ```bash
   go mod download
   ```

5. **Start backend (Development mode)**:
   ```bash
   go run ./cmd/server
   ```

---

## 5. Frontend Configuration & Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd ../frontend
   ```

2. **Create configuration file**:
   Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

3. **Key Configuration Options (`.env.local`)**:
   - `NEXT_PUBLIC_API_URL`: Public-facing API URL (e.g., `http://localhost:8080/api/v1`).
   - `INTERNAL_API_URL`: Internal network API URL for server-side Next.js fetch requests (e.g., `http://127.0.0.1:8080/api/v1`).
   - `NEXT_PUBLIC_APP_NAME`: Name of the marketplace web app.
   - `NEXT_PUBLIC_APP_URL`: Base URL of the web application.
   - `NEXT_PUBLIC_CDN_URL`: CDN URL pointing to Cloudflare R2 / S3 public files.
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Public Stripe publishable token.

4. **Install frontend dependencies**:
   ```bash
   pnpm install
   ```

5. **Start frontend (Development mode)**:
   ```bash
   pnpm dev
   ```
   The site will be accessible at `http://localhost:3000`.

---

## 6. Production Deployment & PM2 Management

For a production environment, both applications should run as background services managed by PM2.

### 1. Compile and Start Backend
First compile the Go source code to a high-performance binary:
```bash
cd backend
go build -o server ./cmd/server
```
Start the compiled backend binary via PM2:
```bash
pm2 start ./server --name backend --env production
```

### 2. Build and Start Frontend
Build the Next.js production bundle:
```bash
cd ../frontend
pnpm build
```
Start the server using PM2 with the configured `ecosystem.config.cjs`:
```bash
pm2 start ecosystem.config.cjs
```

### 3. Automated Frontend Rolling Deployment Script
The codebase includes a rolling deployment script (`frontend/scripts/deploy-production.sh`) that builds Next.js in a separate directory (`.next-candidate`) and performs zero-downtime hot-swapping inside PM2:
```bash
cd frontend
pnpm run deploy
```

### 4. General PM2 Management Commands
```bash
# View all active processes
pm2 list

# Monitor CPU/Memory utilization
pm2 monit

# View log outputs in real-time
pm2 logs backend
pm2 logs frontend

# Restart or stop processes
pm2 restart backend
pm2 stop frontend

# Save the process list to revive them after system reboot
pm2 save
```

---

## 7. Configuration Details for Tebex Headless Checkout

If you are using Tebex Headless Checkout:
1. Ensure `TEBEX_HEADLESS_ENABLED=true` is set in the backend `.env`.
2. Configure the Tebex environment variables in `.env` using your Tebex Creator API keys.
3. Every paid digital good added to the marketplace must be mapped to a Tebex package ID. Go to **Admin Panel > Products > Product detail** and select the Tebex package. Note: The package base currency and prices must match exactly for the mapping validation to succeed.
