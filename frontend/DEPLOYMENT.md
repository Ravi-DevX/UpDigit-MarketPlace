# Frontend Deployment

Do not run the public frontend with `pnpm dev`. Next.js dev mode emits un-hashed
route chunk URLs and can leave admin/seller pages stuck if generated chunks are
missing or stale.

Use the isolated production deploy script. It builds outside the live `.next`
directory, retains old hashed assets, swaps only after a successful build, and
rolls back if the restarted server fails its health check:

```bash
cd /root/marketplace/frontend
pnpm install --frozen-lockfile
pnpm run deploy
```

After deploying, verify that the public pages no longer reference dev chunks:

```bash
curl -sS https://updigit.net/seller | grep -E "_next/static/chunks/app/.+page-"
```
