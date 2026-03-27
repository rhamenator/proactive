# PROACTIVE Admin Dashboard

Next.js admin dashboard for the PROACTIVE Field Canvassing System.

## Setup

```bash
cd admin-dashboard
npm install
cp .env.example .env.local
```

## Development

```bash
npm run dev
```

The dashboard expects the backend API to be running at `NEXT_PUBLIC_API_URL` and uses browser-local JWT storage for the session.
