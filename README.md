# UNF AI & Design Thinking Innovation Challenge — Live Event Hub

## Pages
- `/` (index.html) — Main display screen (projector / big screen)
- `/mobile.html`   — Participant mobile page (photo upload + team registration)
- `/api/data`      — Serverless API (GET/POST state)

## Deploy to Vercel (one-time setup)

### 1. Create GitHub repo
```bash
git init
git add .
git commit -m "UNF AI Challenge event site"
git remote add origin https://github.com/YOUR_USERNAME/unf-ai-challenge.git
git push -u origin main
```

### 2. Create Vercel project
- Go to vercel.com → New Project → Import the GitHub repo
- Framework: **Other** (static HTML + serverless functions)
- Root directory: `.`
- No build command needed

### 3. Add KV Storage (for cross-device real-time sync)
- In Vercel dashboard → Storage tab → Create Database → KV
- Connect it to the `unf-ai-challenge` project
- This auto-adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars

### 4. Add subdomain
- In Vercel project settings → Domains → Add `unf.capndon.com`
- In your DNS (wherever capndon.com is managed) add a CNAME:
  - Name: `unf`
  - Value: `cname.vercel-dns.com`

### 5. Optional: Admin reset endpoint
Set env var `ADMIN_SECRET=your-secret-here`, then:
```
DELETE /api/data  (with header X-Admin-Secret: your-secret-here)
```
Clears all photos and teams for a fresh start.

## Architecture
- `index.html` polls `/api/data` every 5 seconds for live updates
- `mobile.html` POSTs photos (resized client-side to max 1200px) and team registrations
- `api/data.js` uses Vercel KV for persistent cross-device state (falls back to in-memory if KV not configured)
