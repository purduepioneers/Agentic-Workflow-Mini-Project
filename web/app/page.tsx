"use client";

import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const prompt = query.trim();
    if (!prompt) {
      setMessage("Please enter a query.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "The query could not be saved.");
        return;
      }

      setMessage(`Query saved. ID: ${result.queryId}`);
      setQuery("");
    } catch {
      setMessage("Could not confirm the save. Check Supabase before retrying.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-xl rounded-xl bg-white p-8 shadow-md">
        <h1 className="text-3xl font-bold text-gray-900">
          AI Workflow Dashboard
        </h1>

        <p className="mt-2 text-gray-600">
          Enter a query to start the AI workflow.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your query..."
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            maxLength={4000}
            disabled={isSubmitting}
            required
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 w-full rounded-lg bg-black px-6 py-3 font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Submit Query"}
          </button>
        </form>

        {message && (
          <p role="status" className="mt-4 break-words text-sm text-gray-800">
            {message}
          </p>
        )}

        <p className="mt-4 text-center text-sm text-gray-500">
          Powered by Next.js and Supabase
        </p>
      </div>
    </main>
  );
}
