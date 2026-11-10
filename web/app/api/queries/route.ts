export async function POST(request: Request) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_QUERY_SUBMISSION !== "true"
  ) {
    return Response.json({ error: "Query submission is disabled." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt || prompt.length > 4000) {
    return Response.json(
      { error: "Enter a query between 1 and 4,000 characters." },
      { status: 400 },
    );
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key?.startsWith("sb_secret_")) {
    return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  // Leave unset fields to the table defaults. These values are server-controlled.
  const requestedBy = process.env.QUERY_REQUESTED_BY;
  const status = process.env.QUERY_INITIAL_STATUS;

  try {
    const response = await fetch(new URL("/rest/v1/queries?select=query_id", url), {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ prompt, requested_by: requestedBy, status }),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      console.error("Supabase query insert failed", response.status, error?.code);
      return Response.json({ error: "The query could not be saved." }, { status: 502 });
    }

    const [row] = await response.json();
    if (typeof row?.query_id !== "string") {
      throw new Error("Missing query ID");
    }

    return Response.json({ queryId: row.query_id }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Could not confirm the save. Check Supabase before retrying." },
      { status: 502 },
    );
  }
}
