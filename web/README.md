# Workflow Console

This Next.js app creates a row in Supabase `queries` and polls `agent_runs` for that query about every 2.5 seconds. The orchestrator consumes new queries and owns agent execution and both approval gates. An agent run with status `awaiting_approval` appears in the list as “Awaiting approval.”

## Configuration

Set these server-side variables in `web/.env.local` for local development or in the affected environment in Vercel.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | The team’s Supabase project URL |
| `SUPABASE_SECRET_KEY` | A server-side Supabase key that starts with `sb_secret_` |
| `WORKFLOW_ACCESS_CODE` | A randomly generated team-only code of at least 24 characters, such as the output of `openssl rand -hex 24` |
| `ENABLE_QUERY_SUBMISSION` | Set to `true` to enable writes in Vercel and other production builds |
| `QUERY_REQUESTED_BY` | Optional server-controlled requester value if required by the active schema |
| `QUERY_INITIAL_STATUS` | Optional starting status if the schema has a `queries.status` column and the orchestrator requires an explicit value |

Only share the console access code with the team. The Supabase secret stays in server configuration. The app uses a shared session for this internal demo, so anyone with the access code and a run link can read that run.

The Supabase Data API must expose these tables to the server-side key.

- `public.queries` with a unique UUID `query_id` and a text `prompt`. The app supplies the query ID so retrying an uncertain save can reuse the same row. Any other required fields need defaults or the configuration above.
- `public.agent_runs` with `id`, `query_id`, `agent`, `status`, `started_at`, and `ended_at`. The orchestrator or agents insert and update these rows using the saved query ID.

## Run locally

```bash
cd web
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000), enter the team access code, and submit a test query. Run `npm run lint` and `npm run build` before deployment.

## Deploy and verify on Vercel

1. [Import the GitHub repository](https://vercel.com/new) into the team’s Vercel account. Set **Root Directory** to `web` and **Framework Preset** to Next.js. For an existing Vercel project, update these settings and deploy this branch as a preview.
2. Add the environment variables above to the target environment and deploy or redeploy. If Vercel imports `main` first, deploy the feature branch as a preview after connecting the repository, or deploy `main` after the PR is merged.
3. Open the deployment URL as a teammate and unlock it. Submit a harmless test query using the team’s test Supabase project or test workflow destination.
4. Verify that the matching `queries` row was inserted once and the status list changes automatically as the orchestrator logs or updates `agent_runs`. Reopen the copied run link as a teammate to verify that it points to the same query.

If the page says “Query saved” and remains waiting, verify that the orchestrator picks up new rows from `queries` and records runs under the same `query_id`. Use the Supabase and worker logs to diagnose failures.
