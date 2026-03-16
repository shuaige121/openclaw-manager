# Upstream Findings

Reference snapshot:

- local clone: `/home/leonard/openclaw-upstream`
- upstream branch: `main`

## Reuse Directly

Latest OpenClaw already includes strong single-instance control features:

- browser Control UI served by the gateway
- WebSocket RPC for `health`, `status`, `system-presence`
- config read/write/apply APIs with base-hash concurrency guard
- config schema + form rendering
- local probes at `/healthz` and `/readyz`
- built-in auth, device pairing, and token handling

## Important Conclusion

The new manager should not duplicate these single-instance features:

- raw config editor
- schema-driven config form
- chat console
- skills/config/cron/details console
- device pairing logic

Those remain inside each OpenClaw instance.

## What The New Manager Must Add

- inventory of many OpenClaw projects
- one dashboard for simultaneous status across many gateways
- lifecycle orchestration
- per-project saved connection metadata
- fast deep-link into each instance's Control UI

## Multi-Gateway Reality

Running many OpenClaw projects on one host is supported, but only when each project keeps its own:

- config path
- state directory
- workspace
- gateway base port

Gateway ports should be spaced out because OpenClaw also derives extra ports from the base gateway port.

## Auth Model Implication

The manager should keep two auth layers separate:

- manager login auth for humans
- downstream gateway auth for each OpenClaw project

For downstream auth, the cleanest default is:

- one manager-level default credential profile
- per-project inherit or override

## UI Embedding Constraint

OpenClaw's Control UI is not safe to iframe directly in phase 1.
The gateway sets frame-deny headers, so the manager should link out to each project's native UI in a new tab unless we later add an explicit proxy layer.

## Practical Constraint

OpenClaw's own UI is single-gateway oriented.

It keeps one active gateway connection in app state and stores recent gateway scopes, but it does not act as a true multi-gateway fleet view.

That is exactly the gap the new manager should fill.
