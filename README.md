# Digital Marketplace Monorepo

This repository hosts a production-oriented digital goods marketplace built with:

- `backend`: Go 1.22+ + Gin + PostgreSQL + Redis
- `frontend`: Next.js 14 App Router + TypeScript

## Quick Start

```bash
docker compose up -d

cd backend
cp .env.example .env
go run ./cmd/server

cd ../frontend
cp .env.local.example .env.local
pnpm dev
```

For the public server, build and run Next.js in production mode:

```bash
cd frontend
pnpm run deploy
```

See `backend/` and `frontend/` directories for details.

## Tebex Headless Checkout

Set the following backend environment variables using the API keys from the Tebex Creator Panel:

```env
TEBEX_HEADLESS_ENABLED=true
TEBEX_PUBLIC_TOKEN=t66x-your-webstore-token
TEBEX_PRIVATE_KEY=your-private-key
TEBEX_HEADLESS_API_URL=https://headless.tebex.io/api
TEBEX_CURRENCY=USD
```

Each paid marketplace product must then be linked by an administrator to an existing one-time Tebex package from **Admin > Products > Product detail**. The package currency and base price must match the marketplace product before the mapping is accepted.
