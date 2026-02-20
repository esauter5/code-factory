# Code Factory

A local-first control plane for running AI coding agents through structured SDLC pipelines. Point it at a repo, describe what you want, pick a provider, and watch it plan, implement, verify, test, and open a PR — all from a Kanban board UI.

<!-- ![Code Factory screenshot](public/screenshot.png) -->

## Features

- **Pipeline templates** — Feature, Bug Fix, Refactor, Docs, and Review workflows with pre-configured stage sequences
- **Multi-provider support** — Claude, Codex, and Gemini (auto-detected from your local CLI installs), plus a mock mode that works with zero setup
- **Kanban board UI** — Runs flow through columns as stages complete, with real-time progress updates
- **Stage controls** — Retry a stage, retry from a stage, edit the prompt and rerun, or skip with a reason
- **Stage detail drawer** — View the full prompt, output artifact, streaming logs, and errors for every attempt
- **Per-stage overrides** — Swap the provider, model, or thinking level for individual stages without changing the run config
- **Repo management** — Register repos with custom setup scripts, test commands, and env file patterns; runs get isolated git worktrees automatically
- **File-backed persistence** — Everything lives in JSON and flat files. No database, no external services

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)

### Install and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Try it out

1. Click **New Run**
2. Enter a repo path (or use the directory picker) and describe what you want done
3. Select **mock** as the runner mode — this works immediately, no AI CLI needed
4. Hit **Create** and watch the run move through the pipeline

## Using Real Providers

To use actual AI agents instead of mock mode, install and authenticate the CLI for your provider of choice:

| Provider | CLI | Setup |
|----------|-----|-------|
| Claude | `claude` | [Install Claude Code](https://docs.anthropic.com/en/docs/claude-code) and sign in |
| Codex | `codex` | [Install Codex CLI](https://github.com/openai/codex) and authenticate |
| Gemini | `gemini` | [Install Gemini CLI](https://github.com/google-gemini/gemini-cli) and authenticate |

Code Factory auto-detects which CLIs are available on your system and shows them in the runner mode dropdown when creating a run.

## Pipeline Templates

| Template | Stages | Use case |
|----------|--------|----------|
| **Feature** | Plan → Implement → Verify → Test → PR | Full SDLC for new features |
| **Bug Fix** | Plan → Implement → Test → PR | Skips verification for faster fixes |
| **Refactor** | Plan → Implement → Test | No PR — for internal cleanups |
| **Docs** | Plan → Implement → PR | Lightweight flow for documentation |
| **Review** | Plan → Verify | Review-only, no implementation |

## Project Structure

```
app/
  page.tsx                  # Main Kanban board
  api/                      # Next.js route handlers (runs, repos, providers, templates)
  _components/              # React components (board, cards, dialogs, drawers)
  _hooks/                   # Client hooks (polling, actions, repo CRUD)
lib/harness/
  orchestrator.ts           # Execution engine — drives stages sequentially
  providers.ts              # CLI abstraction for Claude, Codex, Gemini
  pipeline-templates.ts     # Built-in template definitions
  runners.ts                # Stage execution handlers
  prompts.ts                # Prompt template loading and variable rendering
  store.ts                  # JSON file persistence
  workspace-manager.ts      # Git worktree provisioning
prompt-templates/           # Prompt .txt files for each stage (plan, implement, verify, test, pr)
runs/                       # Created at runtime — attempt artifacts, logs, and progress files
.data/                      # Created at runtime — store.json
```

## How It Works

When you create a run, the orchestrator snapshots the selected pipeline template, builds context about your repo (file tree, README excerpt), and starts executing stages in order. Each stage renders a prompt template with context from prior stages, spawns the selected provider's CLI, and streams output to disk. The UI polls the API every ~2 seconds to pick up progress. If a stage fails, you can retry it (with automatic feedback from the failure), edit the prompt, or skip it entirely.

Runs are stored in `.data/store.json`. Stage artifacts (prompts, outputs, logs) are written to `runs/<runId>/<stage>/attempt-<N>/` so you always have a full history of what happened.

## Development

```bash
pnpm lint        # ESLint
pnpm typecheck   # TypeScript type checking
```

## Tech Stack

- **[Next.js](https://nextjs.org/)** (App Router) + **TypeScript**
- **[React](https://react.dev/)** 19
- **[Tailwind CSS](https://tailwindcss.com/)** 4
- **[shadcn/ui](https://ui.shadcn.com/)** + **[Radix UI](https://www.radix-ui.com/)**
- **[Lucide](https://lucide.dev/)** icons
