# Frontend conventions

- Keep dataset tables, cleaning steps and validation rules in the session provider; validation, reports and ML must evaluate the same user rules so navigation cannot change conclusions.
- Keep processing and report calculations in pure services while the local fallback exists; in production the backend Python is the source of truth.
- Render reports from a shared `ReportDocument` for preview, standalone HTML and printing; exports must not include raw dataset rows or reversible table snapshots.
- Session history is ephemeral and records explicit actions only; viewing a page must not create operations.
- Keep ML state in a provider inside the dataset provider and invalidate experiments when data, rules or configuration change; navigation must preserve valid experiments.
- Load any local scientific runtime only inside the browser worker from its version-pinned distribution; Node-only imports must not enter the application bundle.
- The AI Data Assistant receives only `buildAssistantContext` output (metadata and computed results, never rows, previews or sample values) via `/api/assistant`; its chat is a single in-memory conversation, matching the ephemeral session.
- Do not add server-side persistence for datasets or conversations without an explicit requirement.
