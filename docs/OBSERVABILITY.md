# Observability & Operations Guide

This document explains how to monitor Promptcademy in production and ensure the database remains healthy.

## 1. API Logging

- The `/api/ai/run` endpoint emits structured JSON logs for every request:
  - `ai_run_start`: user ID, requested models, provider key availability, config.
  - `ai_run_success`: duration, total tokens, total cost, per-model errors.
  - `ai_run_error`: request ID plus error message.
- In Vercel or any Node host, forward these logs to your logging platform (e.g. Datadog, Logtail) using a log drain so you can create dashboards/alerts. Filter by `source=api/ai/run`.

## 2. Monitoring & Alerts

| What to Watch         | How                                                     | Alert Condition                   |
| --------------------- | ------------------------------------------------------- | --------------------------------- |
| Supabase RLS errors   | Supabase → Logs → Filters (`[42501] permission denied`) | >5 errors in 5 min                |
| API usage spikes      | Dashboard from `prompt_attempts` (tokens/cost)          | Daily cost > planned budget       |
| AI provider errors    | Log search for `ai_run_error` or `results.error`        | Any spike in provider error count |
| Task queues / latency | `ai_run_success.durationMs` histogram                   | P95 duration > 15s                |

### Suggested Automation

1. Create Supabase log alerts for `permission denied` to catch misconfigured policies.
2. Schedule a daily job (Supabase Edge Function or cron) that aggregates `prompt_attempts` and emails/Slack posts usage + cost.
3. Forward Playwright smoke test results (CI) to Slack so regressions surface quickly.

## 3. Backups & Recovery

- Supabase automatically snapshots the database every day. Confirm Backups → “PitR enabled” for your project.
- Ensure the new tables (`user_api_keys`, `team_members`, `team_templates`, `prompt_attempts`, `prompt_templates`) are included. Supabase backs up the entire DB, so no extra action is needed besides verifying retention.
- Recommended schedule:
  - Enable Point-in-Time Recovery (PITR) with at least 7 days retention.
  - Export a weekly SQL dump to object storage for belt-and-suspenders restores.

### Restore Drill

Quarterly, practice restoring the latest backup to a staging project:

1. Create a temporary Supabase project.
2. Restore the most recent backup/PITR timestamp into it.
3. Run migrations + targeted queries to confirm tables and RLS policies load correctly.

## 4. Dashboards

- **AI Usage**: Chart daily token/cost totals from `prompt_attempts`.
- **User Activity**: Use Supabase’s `analytics` views or build a dashboard from `user_progress` & `template` events.
- **Key Health**: Display counts of users with/without provider keys to proactively contact teams before they hit fallbacks.

## 5. Incident Runbook

1. **Users report “Missing API key” errors**
   - Check Settings → API Keys in the app to ensure fallback keys exist.
   - Review `ai_run_error` logs for provider-specific issues (rate limits, invalid keys).
2. **RLS Permission errors**
   - Tail Supabase logs for `permission denied`.
   - Compare policies to `supabase/migrations`.
   - Hotfix by adjusting policies, then add automated tests (coming soon) to prevent recurrence.
3. **Backups**
   - If a table is accidentally truncated, use PITR restore to recover to a new database, then copy rows back with `pg_dump`/`psql`.

With structured logging, alerts, and backup drills in place, Promptcademy can be operated confidently in production.
