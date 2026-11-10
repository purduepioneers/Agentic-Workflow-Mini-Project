## Branch workflow

- `main` is the stable integration branch. Do not push directly to it.
- Create a short-lived branch from an up-to-date `main` for each focused change.
- Use `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `test/<topic>`, or `chore/<topic>` (for example, `feat/agent-1-research`).
- Open a pull request into `main`, use the PR template, and request one review.
- Keep changes scoped and include testing instructions or evidence.
- Resolve review conversations and passing required checks before merging.

## Definition of done

- The affected part of the workflow works as described and has appropriate tests or documented manual verification.
- Persisted data is tied to the right query/run ID, with explicit status and failure behavior where relevant.
- Approval gates cannot be bypassed on normal or retry paths.
- Secrets are only in local environment files or deployment secrets, never source control.
- README and `.env.example` are updated when setup or configuration changes.
