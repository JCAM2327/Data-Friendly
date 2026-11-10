<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep dataset tables, cleaning steps and validation rules in the session provider; validation, reports and ML must evaluate the same user rules so navigation cannot change conclusions.
- Keep processing and report calculations in pure services; browser-only exports use explicit click handlers so files never require a server upload.
- Render reports from a shared ReportDocument for preview, standalone HTML and printing; exports must not include raw dataset rows or reversible table snapshots.
- Session history is ephemeral and records explicit actions only; viewing a page must not create operations.
- Keep ML state in a provider inside the dataset provider and invalidate experiments when data, rules or configuration change; navigation must preserve valid experiments.
- Load the scientific runtime only inside the browser worker from its version-pinned distribution; Node-only Pyodide imports must not enter the application bundle.
- The AI Data Assistant receives only `buildAssistantContext` output (metadata and computed results, never rows, previews or sample values) via `/api/assistant`; its chat is a single in-memory conversation, matching the ephemeral session.
