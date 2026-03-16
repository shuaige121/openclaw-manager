# OpenClaw Manager

OpenClaw Manager is a multi-project control plane for teams running more than one raw OpenClaw gateway.

It gives you one place to:

- register OpenClaw projects by path, config, gateway, and lifecycle command
- see live runtime and health status across many projects
- start, stop, and restart projects without leaving the dashboard
- run bulk hook, skill, memory, and config operations
- jump straight into each project's native OpenClaw Control UI for deep single-instance work

OpenClaw already ships a strong single-instance UI. OpenClaw Manager adds the missing fleet layer.

## Why this exists

The old fleet-style tool mixed together three different concerns:

- project inventory
- lifecycle orchestration
- channel-specific modeling

This rewrite intentionally narrows the product boundary.

OpenClaw Manager does **not** try to replace OpenClaw's own config editor, chat UI, skills console, or device pairing flows.
Instead, it focuses on the operational layer that shows up once you run multiple OpenClaw projects at the same time.

## What it does well

- One project row equals one raw OpenClaw project
- Live probes beat stale database state
- Batch operations stay file-based and predictable
- Per-project auth can inherit a manager default or override locally
- Deep single-instance configuration stays inside the project's own OpenClaw UI

## Product model

- One manager record = one OpenClaw project
- One OpenClaw project = one config file, one workspace, one gateway, one lifecycle strategy
- Manager handles fleet-wide actions
- Each project's Control UI handles deep, single-instance operations

## Features

### Current

- JSON registry for projects and default downstream auth
- Project CRUD
- Live TCP + `/healthz` + `/readyz` probing
- Lifecycle actions: `start`, `stop`, `restart`
- Bulk actions for hooks, skills, memory, and config patch
- Compatibility scanning for mixed OpenClaw layouts
- Persisted action history
- React dashboard with cards, detail panel, multi-select, and bulk action entry points

### In progress / planned

- Model/provider switching in the manager UI
- First-class hook and skill inventories
- Plugin and tool-policy management
- Access control hardening for LAN / WireGuard deployments
- Manager-specific Telegram bot commands

## Architecture

```text
apps/api  -> Express API, registry, probes, lifecycle actions, bulk actions
apps/web  -> React dashboard shell
data/     -> local runtime state (gitignored) + example files
docs/     -> rewrite rationale, upstream findings, marketing notes
```

## Local development

```bash
npm install
npm run dev
```

By default:

- API runs on `0.0.0.0:3000`
- Vite dev server runs on `0.0.0.0:5173`

After `npm run build`, the API serves the built web app on the same port.

## Runtime data

Runtime registry and history files are intentionally **gitignored**.

- local runtime registry: `data/projects.json`
- local action history: `data/action-history.json`
- examples: `data/projects.example.json`, `data/action-history.example.json`

For a fresh checkout you can copy the examples if you want to pre-seed local state:

```bash
cp data/projects.example.json data/projects.json
cp data/action-history.example.json data/action-history.json
```

If those files are missing, the manager will create local runtime files on first write.

## Scripts

```bash
npm run typecheck
npm run test
npm run build
```

## Deployment notes

- Keep manager auth separate from downstream OpenClaw gateway auth
- Prefer per-project gateways instead of one shared giant instance
- Keep project-specific channels, plugins, and deep config inside OpenClaw itself
- If you expose the manager on LAN or WireGuard, add an allowlist or upstream access control layer first

## GitHub and marketing

Additional positioning, SEO targets, repo copy, and launch messaging live in [docs/marketing.md](docs/marketing.md).

## Repo status

This repo is already running as a working internal manager, not just a mockup.
The current baseline passes:

- `npm run typecheck`
- `npm run test`
- `npm run build`

## Related docs

- [rewrite-plan.md](docs/rewrite-plan.md)
- [upstream-findings.md](docs/upstream-findings.md)
- [marketing.md](docs/marketing.md)
