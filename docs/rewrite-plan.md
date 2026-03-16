# Rewrite Plan

## Product Reset

The new manager is not a channel manager.

It is a control plane for multiple raw OpenClaw projects:

- register projects
- inspect status
- start, stop, restart
- open each project's native Control UI
- edit manager-owned metadata only

Per-project OpenClaw configuration remains inside that project's own `openclaw.json` and Control UI.

## What We Reuse From Latest OpenClaw

Latest upstream OpenClaw already provides the single-instance control surface we need:

- Control UI served by the gateway
- WebSocket RPC for `health`, `status`, `system-presence`
- config APIs: `config.get`, `config.set`, `config.apply`, `config.schema`
- shallow probes: `/healthz`
- readiness probes: `/readyz`

That means the new manager should not clone OpenClaw's whole config UI.
It should discover, summarize, and route into those existing surfaces.

## Core Principles

1. Instance first

One manager record maps to one OpenClaw project.

2. Command driven lifecycle

The manager stores how to start, stop, and restart a project. It does not assume PM2, systemd, or Docker globally.

3. Runtime truth beats database truth

Displayed status should come from live probes and command results, not from stale persisted state.

4. Upstream compatibility

The manager should adapt to current OpenClaw config/runtime behavior instead of inventing a competing schema.

5. Shallow manager, deep project UI

The manager handles fleet-wide operations. Each project's Control UI handles deep single-instance operations.

6. Manager auth defaults, project auth overrides

The manager may provide one default downstream gateway credential profile.
Each project inherits that profile by default and may override it when needed.

## Data Model

Minimal project record:

- `id`
- `name`
- `rootPath`
- `configPath`
- `gatewayUrl`
- `gatewayPort`
- `auth.mode`
- `auth.strategy`
- `auth.secretRef` or stored secret
- `startCommand`
- `stopCommand`
- `restartCommand`
- `notes`
- `tags`

Derived, not primary:

- live health
- readiness
- config summary
- control UI URL
- current process state

## Backend Scope

Phase 1 backend:

- CRUD for project registry
- read config summary from disk
- probe `healthz` and `readyz`
- optional gateway RPC probe when auth is available
- run lifecycle commands safely

Phase 2 backend:

- import existing OpenClaw projects from a directory scan
- persist action history
- stream command logs
- token redaction and secret storage cleanup

Phase 3 backend:

- command templates for PM2/systemd/Docker
- batch actions
- policy/role controls

## Frontend Scope

Phase 1 frontend:

- dashboard list
- project search and multi-select
- project detail view
- quick actions: start, stop, restart, open Control UI, open gateway
- batch action entry points for hooks, skills, memory, config patch

Control UI should open in a new tab in phase 1.
The manager should not try to embed OpenClaw's UI until we explicitly add a framing-safe proxy.

Phase 2 frontend:

- filters, tags, bulk actions
- runtime diagnostics panel
- action history

Not in manager v1:

- channel-specific editors
- plugin-specific forms
- cloned copy of OpenClaw chat/config console

## Delivery Sequence

1. Create clean manager repo and workspace
2. Build minimal API and dashboard shell
3. Add project registry persistence
4. Add config reading and runtime probes
5. Add lifecycle command execution
6. Add deep links into each project's Control UI
7. Migrate real server projects into the new registry
