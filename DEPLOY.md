# Going live

Three things need to happen, in order: create a Supabase project (for login/sync — optional but needed for phase-2 features), push this repo to GitHub, then deploy on Vercel and attach a domain.

## 1. Supabase (backend for Google login, cross-device sync, live shared sessions)

1. Go to [supabase.com](https://supabase.com), sign up, and create a new project (free tier is enough to start). Pick a region close to your users.
2. Once it's provisioned: **Settings → API** — copy the **Project URL** and the **anon public** key.
3. Create `.env.local` in the project root (it's already git-ignored) from the template:
   ```
   cp .env.example .env.local
   ```
   and paste in the two values:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. **SQL Editor → New query** — paste the contents of `supabase/schema.sql` and run it. This creates the `tasks`, `pomo_history`, and `user_settings` tables with row-level security so each signed-in user only ever sees their own data.
5. **Authentication → Providers → Google** — enable it. You'll need a Google OAuth client ID/secret from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth consent screen + "Web application" credential). Add Supabase's callback URL (shown on that provider settings page) as an authorized redirect URI in the Google console.
6. Send me the project URL + anon key (or confirm `.env.local` is filled in) and I'll wire up the actual login button, cross-device sync, and live shared sessions against it.

Until step 6, the app keeps working exactly as it does now — everything just stays local to the browser (`localStorage`).

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
```
Create a new repo on [github.com/new](https://github.com/new), then:
```bash
git remote add origin https://github.com/<you>/pomo.git
git push -u origin main
```

## 3. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com), sign up (GitHub login is easiest), **Add New → Project**, import the `pomo` repo.
2. Vercel auto-detects Vite — no config needed. Framework preset: "Vite".
3. If you did step 1 (Supabase), add the two env vars in **Project Settings → Environment Variables**:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same values as `.env.local`).
4. Click **Deploy**. You'll get a live `pomo-xxxx.vercel.app` URL immediately.

## 4. Attach your domain

Some name ideas tied to what the app actually does (dual-mode, switchable focus timer) — check availability on a registrar like [Namecheap](https://namecheap.com), [Porkbun](https://porkbun.com), or [Cloudflare Registrar](https://cloudflare.com/products/registrar) before you commit to one:

- `pomotwo.com` / `twopomo.com` — plays on the two modes
- `pomomode.com` / `switchpomo.com`
- `getpomo.app`
- `pomo.studio`
- `dualpomo.com`

Once you own one:
1. In Vercel: **Project Settings → Domains → Add**, type the domain.
2. Vercel shows you either an A record + CNAME, or nameservers to use — add those at your registrar's DNS settings.
3. DNS propagation is usually minutes, sometimes up to 24h. Vercel issues an HTTPS certificate automatically once it verifies.

That's the whole path from where the app is now to a live site on your own domain.
