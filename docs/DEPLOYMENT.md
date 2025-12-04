# Deployment & Monitoring Guide

This project is optimized for Vercel, but the same steps work on Netlify (with the `_redirects` file below).

## 1. Pre-flight Checklist
1. `npm run lint`
2. `npm run build`
3. Run the smoke tests in `docs/QA_CHECKLIST.md`.
4. Ensure `.env.local` contains:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_OPENAI_API_KEY`
   - `OPENAI_API_KEY`
   - Optional: `NEXT_PUBLIC_ANTHROPIC_API_KEY`, `NEXT_PUBLIC_GOOGLE_API_KEY`
5. Run `supabase db push` (if schema changes) and promote at least one admin user.

## 2. Vercel Setup
1. Import the repo.
2. In **Settings → Environment Variables**, add the keys above for Production, Preview, and Development.
3. Build command: `npm run build`
4. Output directory: `.next`
5. Redeploy.

## 3. Netlify Setup (optional)
1. Add `@netlify/plugin-nextjs` in the Netlify dashboard or `netlify.toml`.
2. Ensure `public/_redirects` exists with:
   ```
   /*    /index.html   200
   ```
3. Build command: `npm run build`
4. Publish directory: `.next`

## 4. Post-Deploy Monitoring
- **Vercel Analytics**: watch Core Web Vitals and serverless function logs.
- **Supabase Dashboard**: monitor `prompt_attempts` volume, DB errors, and RLS access logs.
- **OpenAI / Anthropic / Google usage pages**: confirm spend aligns with expectations; set budget alerts.
- **Log drain** (optional): connect Vercel to Logflare/Datadog for centralized logs.

## 5. Incident Response
- If the app 404s on Netlify, verify `_redirects`, plugin status, and publish directory.
- If Playground or Analyzer fail, confirm `OPENAI_API_KEY` is set in the deployed environment.
- For quota/cost anomalies, query `prompt_attempts` by user/day and temporarily lower `DAILY_MODEL_CALL_LIMIT` / `DAILY_COST_LIMIT` in `app/playground/page.tsx`.

