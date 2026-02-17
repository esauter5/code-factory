# LLM SDLC V0 (Next.js + TypeScript)

This is a simplified, demo-first SDLC automation control plane built with:

- Next.js (App Router) + TypeScript
- React client board UI
- shadcn-style component architecture
- File-backed persistence for runs and stage artifacts

Fixed workflow:

`Plan -> Implement -> Verify -> Test -> PR`

## Features

- Create and start pipeline runs from UI
- Runner modes:
  - `mock` (default, works out of the box)
  - `claude` (`claude -p` if installed/authenticated)
- Stage controls:
  - Retry stage
  - Retry from stage
  - Edit prompt and rerun
  - Skip stage with reason
- Stage details drawer:
  - Prompt
  - Artifact output
  - Logs
  - Error
- Persisted run history in `.data/store.json`
- Attempt files under `runs/<runId>/<stage>/attempt-N/`

## Getting Started

```bash
pnpm install
pnpm dev
```

Open:

`http://localhost:3000`

## Checks

```bash
pnpm lint
pnpm typecheck
```

## Notes

- Default test command is `pnpm lint` for demo portability.
- PR stage runs in simulate mode and emits a simulated PR URL.
