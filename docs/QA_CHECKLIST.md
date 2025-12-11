# Promptcademy Manual Smoke Test Checklist

Run this checklist before **each** deployment (locally and on Vercel). Use the ✅ / ⚠️ markers to record results.

## 1. Environment & Auth

- ✅ Login + logout (email/password).
- ✅ New signup → onboarding flow → dashboard redirect.
- ✅ Admin user sees `Admin` nav, non-admins do not.
- ✅ Settings → API Keys: add/update provider keys and confirm playground warning disappears when a key is active.

## 2. Admin / Teacher Dashboards

- ✅ `/admin` loads stats for courses, lessons, users.
- ✅ Create, edit, delete a course; verify Supabase receives the row.
- ✅ Lessons page: edit lesson, delete lesson (confirm toast), order updates.
- ✅ User Management: filter/search, update a user’s role, stats refresh.

## 3. Playground & Cost Controls

- ✅ Base run with OpenAI key only (budget mode ON) logs records in `prompt_attempts`.
- ✅ Disable budget mode and run 4+ models to trigger rate-limit warning + acknowledgement checkbox.
- ✅ Quota progress bars increment; refresh usage button updates counts.
- ✅ Errors (missing key, provider bans) show descriptive toast and do not crash the page.
- ✅ After a Gemini run, confirm `/history` and `/analytics` show the attempt with correct provider/tokens.

## 4. Templates

- ✅ Create a private template; ensure it appears under “My Templates” but not “Community”.
- ✅ Toggle to public; verify it shows in Community tab for another account.
- ✅ Delete template and confirm immediate UI update.

## 5. AI Analyzer

- ✅ “Analyze Prompt” returns score/strengths/weaknesses/suggestions.
- ✅ “Generate Ideas” returns 5 templates and copy-to-clipboard works.
- ✅ API failures (remove OPENAI key temporarily) surface user-friendly error.

## 6. User-Facing Pages

- ✅ `/courses`, `/courses/[id]`, `/courses/[id]/lessons/[id]`.
- ✅ `/challenges`, `/leaderboard`, `/history`, `/profile`, `/settings`, `/teams`, `/search`.
- ✅ `/login`, `/signup`, `/onboarding`, `/dashboard`.

## 7. Browser Matrix

- ✅ **Chrome (desktop)**: full flow (login → lesson Gemini run → template CRUD → analyzer). Capture any layout regressions at 1440/1024/768/375 widths.
- ✅ **Safari (desktop)**: repeat Chrome flow, including verifying the Gemini selector disables providers with no key and warnings render.
- ⚠️ **Firefox (optional)**: quick sweep for layout, dark/light toggle, playground readability on mobile widths.

## 8. Accessibility & Perf Spot-Checks

- Keyboard navigation (Tab/Shift+Tab) reaches all controls on Playground & Admin pages.
- Lighthouse quick audit ≥ 90 for Performance/Best Practices on `/`, `/playground`, `/admin`.

## 9. Post-Deploy Sanity

- Check Vercel build logs (lint/build succeeded, no warnings).
- Confirm Supabase metrics (prompt attempts, template CRUD) reflect the smoke test actions.
- Monitor OpenAI usage dashboard for unexpected spikes.

## 10. Automated Smoke Test (Playwright)

- Export `E2E_BASE_URL` (defaults to `http://localhost:3000`), `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_LESSON_URL`.
- Start the Next.js app at `E2E_BASE_URL`.
- Run `npm run test:e2e` and archive the generated trace/video artifacts for failures.

> Keep a copy of this file in the repo (committed) so the entire team follows the same validation steps.
