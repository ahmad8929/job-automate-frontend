# Job Apply — Frontend (Next.js)

Pages: `/` (two modes: **Via ChatGPT (free)** — copy prompt → run in your ChatGPT app → paste reply; **Automatic (API)** — screenshot/paste → Gemini/ChatGPT/Claude API extracts + drafts; both → review → send), `/dashboard` (tracker), `/profile` (resume, preferences, Gmail).

## How it talks to the backend
The browser only calls `/api/backend/*` on this app. That route handler checks the NextAuth session (only
`ALLOWED_EMAIL` can sign in) and forwards to the Express API with `BACKEND_API_KEY`. The backend URL and key
never reach the browser.

## Local setup
```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
```

## Deploy to Vercel
Import the repo, then set the same env vars as `.env.example` with production values:
`NEXTAUTH_URL=https://<your-app>.vercel.app`, `BACKEND_URL=https://api.yourdomain.com`, a fresh `NEXTAUTH_SECRET`.
In Google Cloud, add `https://<your-app>.vercel.app/api/auth/callback/google` as an authorized redirect URI.
