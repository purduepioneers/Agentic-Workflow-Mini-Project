import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "workflow_session";
const QUERY_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const EXISTING_QUERY_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function matches(candidate: string | undefined, expected: string) {
  return candidate?.length === expected.length &&
    timingSafeEqual(Buffer.from(candidate, "utf8"), Buffer.from(expected, "utf8"));
}

async function requireTeamAccess() {
  const code = process.env.WORKFLOW_ACCESS_CODE;
  if (!code || code.length < 24) {
    return json({ error: "Team access is not configured." }, 503);
  }
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session || !/^[a-f0-9]{64}$/.test(session) || !matches(session, digest(code))) {
    return json({ error: "Enter the team access code to continue." }, 401);
  }
}

async function readBody(request: Request) {
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") {
    return null;
  }
  return request.json().catch(() => null);
}

export async function PUT(request: Request) {
  const code = process.env.WORKFLOW_ACCESS_CODE;
  if (!code || code.length < 24) {
    return json({ error: "Team access is not configured." }, 503);
  }
  const body = await readBody(request);
  if (typeof body?.code !== "string" || !matches(digest(body.code), digest(code))) {
    return json({ error: "That access code did not match." }, 401);
  }
  (await cookies()).set(SESSION_COOKIE, digest(code), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.VERCEL === "1" || new URL(request.url).protocol === "https:",
    path: "/",
  });
  return json({ authorized: true });
}

function supabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key?.startsWith("sb_secret_")) return null;

  return async function select<T>(table: "queries" | "agent_runs", params: Record<string, string>, init?: RequestInit) {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    endpoint.search = new URLSearchParams(params).toString();
    const response = await fetch(endpoint, {
      ...init,
      headers: { apikey: key, ...init?.headers },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      console.error("Supabase request failed", table, init?.method ?? "GET", response.status, error?.code);
      throw new Error("Supabase request failed");
    }
    return response.json() as Promise<T[]>;
  };
}

type QueryRow = { query_id: string; prompt: string };

export async function GET(request: Request) {
  const denial = await requireTeamAccess();
  if (denial) return denial;

  const queryId = new URL(request.url).searchParams.get("queryId");
  if (queryId === null) return json({ authorized: true });
  if (!EXISTING_QUERY_ID.test(queryId)) return json({ error: "Invalid query ID." }, 400);

  const requestSupabase = supabaseClient();
  if (!requestSupabase) return json({ error: "Supabase is not configured." }, 503);

  try {
    const [queries, runs] = await Promise.all([
      requestSupabase<QueryRow>("queries", { select: "query_id,prompt", query_id: `eq.${queryId}` }),
      requestSupabase("agent_runs", {
        select: "id,agent,status,started_at,ended_at",
        query_id: `eq.${queryId}`,
        order: "started_at.asc.nullsfirst,id.asc",
      }),
    ]);
    if (!queries.length) return json({ error: "This query could not be found." }, 404);
    return json({ prompt: queries[0].prompt, runs });
  } catch {
    return json({ error: "Could not refresh run status." }, 502);
  }
}

export async function POST(request: Request) {
  const denial = await requireTeamAccess();
  if (denial) return denial;
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_QUERY_SUBMISSION !== "true") {
    return json({ error: "Query submission is disabled." }, 503);
  }

  const body = await readBody(request);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const queryId = typeof body?.queryId === "string" ? body.queryId.toLowerCase() : "";
  if (!prompt || prompt.length > 4000 || !QUERY_ID.test(queryId)) {
    return json({ error: "Enter a query between 1 and 4,000 characters and use a valid query ID." }, 400);
  }

  const requestSupabase = supabaseClient();
  if (!requestSupabase) return json({ error: "Supabase is not configured." }, 503);

  try {
    // A retry reuses the same primary key and leaves the original row untouched.
    const [created] = await requestSupabase<QueryRow>("queries", {
      select: "query_id",
      on_conflict: "query_id",
    }, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=ignore-duplicates",
      },
      body: JSON.stringify({
        query_id: queryId,
        prompt,
        requested_by: process.env.QUERY_REQUESTED_BY || undefined,
        status: process.env.QUERY_INITIAL_STATUS || undefined,
      }),
    });
    if (created?.query_id === queryId) return json({ queryId }, 201);

    const [existing] = await requestSupabase<QueryRow>("queries", {
      select: "query_id,prompt",
      query_id: `eq.${queryId}`,
    });
    if (existing?.prompt === prompt) return json({ queryId });
    if (existing) return json({ error: "That query ID is already in use. Edit the prompt to start a new submission." }, 409);
    throw new Error("Missing saved query");
  } catch {
    return json({ error: "Could not confirm the save. Submit the same prompt again to retry." }, 502);
  }
}
