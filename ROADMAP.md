# Code Factory — Prioritized Feature Roadmap

> **Generated:** 2026-02-20
> **Based on:** Codebase analysis of current `main` branch

Features are ordered by priority. Dependencies flow top-down: earlier features unlock or enhance later ones.

---

## Feature 1: Wire Up Per-Stage Provider/Model/Thinking Overrides

**Priority:** Critical (bug fix)

**Rationale:** The UI lets users set per-stage provider, model, and thinking level overrides. The data model stores them in `StageOverride`. But `orchestrator.ts:650-653` hard-codes `claude` as the provider and `"medium"` as the thinking level, ignoring all overrides. This makes multi-provider support non-functional for real runs.

**Affected Files:**
- `lib/harness/orchestrator.ts` — Remove the TEMP hard-code block (~line 650). Read `stageDef.provider`, `stageDef.model`, `stageDef.thinkingLevel` and the run-level `model`/`thinkingLevel`; pass them through to `runProviderPrompt()`.
- `lib/harness/runners.ts` — Ensure `runProviderPrompt()` correctly forwards model and thinking level to the provider's CLI args.
- `lib/harness/providers.ts` — Verify each provider's `buildArgs()` handles optional model/thinking overrides.

**Tasks:**
1. In `executeStage()`, replace the hard-coded provider/model/thinking with values resolved from: stage overrides → run-level settings → runner mode defaults.
2. Accept `StageOverrides` in the run creation POST body and merge them into `stageDef` at execution time.
3. Verify the timeout override (`StageOverride.timeoutMs`) is also respected.
4. Remove the `// TEMP` comment block.

**Acceptance Criteria:**
- [ ] Creating a run with `runnerMode: "codex"` invokes the Codex CLI (not Claude)
- [ ] Per-stage model override in the UI results in that model being passed to the provider CLI
- [ ] Per-stage timeout override causes the stage to use that timeout instead of the template default
- [ ] The TEMP hard-code comment block is removed from `orchestrator.ts`
- [ ] `pnpm build` passes

---

## Feature 2: Real-Time Log Streaming via Server-Sent Events (SSE)

**Priority:** High

**Rationale:** The UI polls `/api/runs/:id/logs` every 2 seconds and `/api/runs` every 1.8 seconds (`use-runs.ts:11`). This causes delayed feedback, unnecessary server load, and missed state transitions. SSE provides instant updates with lower overhead.

**Affected Files:**
- `app/api/runs/[runId]/stream/route.ts` (new) — SSE endpoint that tails `live.log` and emits run status changes.
- `app/_hooks/use-runs.ts` — Replace polling with EventSource for real-time run status updates; fall back to polling if SSE connection fails.
- `app/_hooks/use-run-actions.ts` — Trigger optimistic UI updates on mutation, reconcile with SSE.
- `app/_components/stage-detail.tsx` — Replace log polling with SSE stream for the active stage.
- `lib/harness/orchestrator.ts` — Emit structured events (stage transitions, completion, errors) to a shared event bus that the SSE endpoint reads.

**Tasks:**
1. Create a lightweight in-process event emitter (or use Node `EventEmitter`) that `orchestrator.ts` writes to on stage transitions.
2. Implement the SSE route at `/api/runs/[runId]/stream` using `ReadableStream` in the Next.js Route Handler.
3. Emit events: `stage:start`, `stage:done`, `stage:failed`, `run:done`, `log:append`.
4. In `use-runs.ts`, open an EventSource per active run; merge incoming events into React state.
5. Keep the polling fallback behind a feature flag or automatic reconnect.

**Acceptance Criteria:**
- [ ] Logs appear in the UI within 500ms of being written (no 2-second polling delay)
- [ ] Stage transitions update the Kanban board instantly
- [ ] SSE connection auto-reconnects on drop
- [ ] Polling fallback still works if SSE is unavailable
- [ ] `pnpm build` passes

---

## Feature 3: Input Validation with Zod Schemas

**Priority:** High

**Rationale:** No API route validates request bodies, path parameters, or query parameters. The run creation endpoint accepts arbitrary strings for `repoPath`, `testCommand`, and `runnerMode` without validation. This creates silent failures, confusing error messages, and potential path traversal risks.

**Affected Files:**
- `lib/harness/schemas.ts` (new) — Zod schemas for `CreateRunBody`, `RepoConfigBody`, `StageOverride`, etc.
- `app/api/runs/route.ts` — Validate POST body with Zod before creating a run.
- `app/api/repos/route.ts` — Validate POST body for repo creation.
- `app/api/repos/[repoId]/route.ts` — Validate PUT body for repo updates.
- `app/api/runs/[runId]/actions/[action]/route.ts` — Validate action-specific payloads.
- `package.json` — Add `zod` dependency.

**Tasks:**
1. Install `zod` as a dependency.
2. Define schemas: `CreateRunSchema`, `RepoConfigSchema`, `StageOverrideSchema`, `ActionPayloadSchema`.
3. Add a `validateBody<T>(req, schema)` helper that returns `{ data, error }`.
4. Apply validation to each API route. Return `400` with structured error on failure.
5. Validate `repoPath` is an absolute path that exists on disk.
6. Validate `runnerMode` is one of the known `RunnerMode` values.

**Acceptance Criteria:**
- [ ] POST `/api/runs` with invalid `runnerMode` returns 400 with a helpful error message
- [ ] POST `/api/runs` with a non-absolute `repoPath` returns 400
- [ ] POST `/api/repos` with missing `localPath` returns 400
- [ ] All valid requests continue to work as before
- [ ] `pnpm build` passes

---

## Feature 4: Structured Logging

**Priority:** High

**Rationale:** The harness code uses bare `console.log/error` with no log levels, no timestamps, no context (run ID, stage name). Debugging production issues requires searching unstructured terminal output. Structured logging enables filtering, correlation, and persistence.

**Affected Files:**
- `lib/harness/logger.ts` (new) — Logger factory using `pino` or similar. Creates child loggers with `runId` and `stageName` context.
- `lib/harness/orchestrator.ts` — Replace `console.log/error` calls with logger.
- `lib/harness/runners.ts` — Replace `console.log/error` calls with logger.
- `lib/harness/workspace-manager.ts` — Replace `console.log/error` calls with logger.
- `lib/harness/store.ts` — Replace `console.log/error` calls with logger.
- `package.json` — Add `pino` dependency.

**Tasks:**
1. Install `pino` and `pino-pretty` (dev).
2. Create `logger.ts` that exports a root logger and a `createRunLogger(runId)` factory.
3. Replace all `console.log/error` calls in harness code with appropriate log levels (`info`, `warn`, `error`, `debug`).
4. Include structured fields: `runId`, `stage`, `attempt`, `provider`, `duration`.
5. Optionally write per-run logs to `runs/<runId>/harness.log`.

**Acceptance Criteria:**
- [ ] All harness log output includes timestamps, log level, and run context
- [ ] Logs are JSON-formatted in production, pretty-printed in development
- [ ] No bare `console.log` calls remain in `lib/harness/`
- [ ] `pnpm build` passes

---

## Feature 5: Store Backups and Data Integrity

**Priority:** Medium-High

**Rationale:** All persistence lives in a single `.data/store.json` file. Concurrent writes use a basic lock (`store.ts`), but there are no backups. A corrupted write (crash mid-save, disk full) results in total data loss. Adding backup rotation and atomic writes makes the system resilient.

**Affected Files:**
- `lib/harness/store.ts` — Add atomic write (write to temp file, then rename). Add backup rotation before each write.
- `app/api/export/route.ts` (new) — Export full store as downloadable JSON.
- `app/api/import/route.ts` (new) — Import a store JSON file (merge or replace).

**Tasks:**
1. Modify `saveStore()` to write to `.data/store.json.tmp` first, then `fs.rename()` atomically.
2. Before each save, copy current store to `.data/backups/store-<timestamp>.json`. Keep last 20 backups.
3. On startup, if `store.json` is corrupt/missing, attempt to restore from latest backup.
4. Add `/api/export` GET route that returns the store as a downloadable file.
5. Add `/api/import` POST route that accepts a store JSON and merges runs/repos.

**Acceptance Criteria:**
- [ ] A crash during save does not corrupt `store.json` (temp-file + rename pattern)
- [ ] At least 20 recent backups are retained in `.data/backups/`
- [ ] Old backups beyond the retention limit are deleted
- [ ] `/api/export` returns a valid JSON file
- [ ] `pnpm build` passes

---

## Feature 6: Run Filtering, Search, and Sorting

**Priority:** Medium

**Rationale:** As users accumulate runs, the Kanban board and table view become cluttered. There is no way to filter by status, template, date range, or search by ticket text. The table view (`runs-table.tsx`) has columns but no sort/filter controls.

**Affected Files:**
- `app/_components/runs-table.tsx` — Add column sort indicators and filter dropdowns (status, template, date range).
- `app/_components/kanban-board.tsx` — Add a search bar that filters runs by ticket text.
- `app/_components/top-bar.tsx` — Add global search input and filter controls.
- `app/_hooks/use-runs.ts` — Add client-side filter/sort state; optionally add query params to the API call for server-side filtering.
- `app/api/runs/route.ts` — Accept optional query params: `?status=`, `?template=`, `?q=`, `?sort=`, `?archived=`.

**Tasks:**
1. Add query parameter parsing to GET `/api/runs` for server-side filtering.
2. Add a search input to the top bar that filters runs by ticket text (case-insensitive substring match).
3. Add filter dropdowns for status and template type.
4. Add clickable column headers in table view for sorting by date, status, template.
5. Persist filter/sort preferences in `localStorage`.

**Acceptance Criteria:**
- [ ] Searching "auth" filters runs whose ticket contains "auth"
- [ ] Filtering by status "failed" shows only failed runs
- [ ] Clicking a table column header toggles sort direction
- [ ] Filters persist across page reloads
- [ ] `pnpm build` passes

---

## Feature 7: Attempt Diff View

**Priority:** Medium

**Rationale:** When a stage has multiple attempts (retries, auto-reverts), users need to compare what changed between attempts. Currently, the stage detail drawer shows attempts in a selector but provides no side-by-side or diff view. This makes debugging regressions across attempts difficult.

**Affected Files:**
- `app/_components/attempt-diff.tsx` (new) — Side-by-side or unified diff view component.
- `app/_components/stage-detail.tsx` — Add "Compare Attempts" button and integrate diff view.
- `lib/harness/orchestrator.ts` — Ensure full output (not just preview) is accessible for diff computation.

**Tasks:**
1. Install a lightweight diff library (e.g., `diff` or `diff2html`).
2. Create `attempt-diff.tsx` that accepts two attempt outputs and renders a unified diff.
3. Add an "A ↔ B" selector in the stage detail drawer that lets users pick two attempts to compare.
4. Show the diff below the attempt selector.
5. Support comparing prompts as well as outputs.

**Acceptance Criteria:**
- [ ] Users can select two attempts and see a diff of their outputs
- [ ] Diff highlights additions, deletions, and changes
- [ ] Prompt diffs are also available
- [ ] Works for stages with 2+ attempts
- [ ] `pnpm build` passes

---

## Feature 8: Custom Pipeline Templates

**Priority:** Medium

**Rationale:** The five built-in templates (Feature, Bug Fix, Refactor, Docs, Review) are hardcoded in `pipeline-templates.ts`. Users cannot create custom pipelines with different stage sequences, custom success criteria, or project-specific prompt templates. This limits flexibility for teams with unique workflows.

**Affected Files:**
- `lib/harness/pipeline-templates.ts` — Separate built-in templates from the template loading logic. Add a `loadCustomTemplates()` function.
- `lib/harness/types.ts` — Add `PipelineTemplate` type to the shared types (currently it's only in `pipeline-templates.ts`).
- `app/api/templates/route.ts` (new or rename from `app/api/template/route.ts`) — CRUD for custom templates.
- `app/_components/template-editor-dialog.tsx` (new) — UI for creating/editing custom templates.
- `app/_components/new-run-dialog.tsx` — Show custom templates alongside built-in ones in the template picker.

**Tasks:**
1. Define a `custom-templates.json` file in `.data/` for user-created templates.
2. Add GET/POST/PUT/DELETE routes for custom templates.
3. Build a template editor dialog with a stage list builder (add/remove/reorder stages, set execution type, timeout, success criteria).
4. Merge custom templates with built-in templates in the template picker.
5. Ensure custom templates are included in the store export/import (Feature 5).

**Acceptance Criteria:**
- [ ] Users can create a custom template with arbitrary stage names and execution types
- [ ] Custom templates appear in the "New Run" template picker alongside built-ins
- [ ] Custom templates can be edited and deleted
- [ ] Deleting a custom template does not affect runs that used it (template snapshot preserved)
- [ ] `pnpm build` passes

---

## Feature 9: Multi-Platform PR URL Extraction

**Priority:** Medium-Low

**Rationale:** The PR success criteria (`pipeline-templates.ts:57`) only matches GitHub URLs via regex `https://github\\.com/[^\\s]+/pull/\\d+`. Repos hosted on GitLab, Bitbucket, or Azure DevOps produce PR URLs that won't be extracted, causing the PR stage to fail on non-GitHub repos.

**Affected Files:**
- `lib/harness/pipeline-templates.ts` — Expand `extractUrlPattern` to support multiple platforms.
- `lib/harness/orchestrator.ts` — Update URL extraction logic to handle multiple patterns or a union regex.
- `lib/harness/types.ts` — Consider adding `prPlatform` to `RunRecord` for downstream display.

**Tasks:**
1. Define URL patterns for GitHub (`/pull/\d+`), GitLab (`/merge_requests/\d+`), Bitbucket (`/pull-requests/\d+`), and Azure DevOps (`/pullrequest/\d+`).
2. Use a union regex or an array of patterns in `successCriteria.extractUrlPattern`.
3. Auto-detect the platform from the repo's `git remote` URL and prioritize the matching pattern.
4. Store the detected platform in `RunRecord` for the UI to display the correct icon/link.
5. Update the `extractUrlPattern` check in `orchestrator.ts` to iterate over patterns.

**Acceptance Criteria:**
- [ ] PR URLs are extracted from GitLab merge request output
- [ ] PR URLs are extracted from Bitbucket pull request output
- [ ] GitHub extraction still works as before
- [ ] Runs against non-GitHub repos no longer fail the PR stage due to URL mismatch
- [ ] `pnpm build` passes

---

## Feature 10: Run History Export and Analytics Dashboard

**Priority:** Low

**Rationale:** After dozens or hundreds of runs, users need visibility into trends — success rates, average durations, most common failure stages, provider comparison. Currently there is no aggregation or export of run history beyond raw JSON.

**Affected Files:**
- `app/analytics/page.tsx` (new) — Analytics dashboard page.
- `app/_components/analytics-charts.tsx` (new) — Chart components (success rate over time, stage duration heatmap, failure distribution).
- `app/api/analytics/route.ts` (new) — Aggregation endpoint that computes metrics from run history.
- `app/api/runs/export/route.ts` (new) — CSV/JSON export of run history with configurable fields.
- `app/_components/top-bar.tsx` — Add navigation link to Analytics page.

**Tasks:**
1. Create an aggregation endpoint that computes: total runs, success rate, average duration per stage, failure counts by stage, runs per template, runs per provider.
2. Build a dashboard page with charts (use a lightweight library like `recharts`).
3. Add a CSV export endpoint that lets users download run history as a spreadsheet.
4. Add date range filtering to the analytics view.
5. Add a nav link in the top bar.

**Acceptance Criteria:**
- [ ] Analytics page shows success rate, average stage duration, and failure distribution
- [ ] Charts update when the date range filter changes
- [ ] CSV export includes all run fields and is importable into Excel/Sheets
- [ ] Navigation from top bar to analytics page works
- [ ] `pnpm build` passes

---

## Summary Table

| # | Feature | Priority | Depends On | Key Benefit |
|---|---------|----------|------------|-------------|
| 1 | Provider/Model Override Wiring | Critical | — | Multi-provider support actually works |
| 2 | SSE Log Streaming | High | — | Real-time feedback, lower server load |
| 3 | Zod Input Validation | High | — | Safety, better error messages |
| 4 | Structured Logging | High | — | Debuggability and observability |
| 5 | Store Backups & Data Integrity | Medium-High | — | Resilience against data loss |
| 6 | Run Filtering & Search | Medium | — | Usability at scale |
| 7 | Attempt Diff View | Medium | — | Debugging multi-attempt stages |
| 8 | Custom Pipeline Templates | Medium | — | Workflow flexibility |
| 9 | Multi-Platform PR Extraction | Medium-Low | 1 | Non-GitHub repo support |
| 10 | Analytics Dashboard | Low | 5, 6 | Visibility into trends |
