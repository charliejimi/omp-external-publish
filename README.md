# omp-external-publish

An [oh-my-pi](https://github.com/can1357/oh-my-pi) (omp) package that implements the **Day28 integrated sequence** guard hook and structured `publish` tool: the only outward exit for “draft and publish an announcement” when an external program drives omp.

Design reference: [`external-countermeasures-day17-30/day28-integrated-sequence.md`](../external-countermeasures-day17-30/day28-integrated-sequence.md) (figures: `-fig1.svg` / `-fig1.png`).

[中文說明](README.zh-TW.md)

## What this package is (and is not)

| In scope (omp `-e`) | Out of scope (wrapper / infra — see sequence doc) |
|---|---|
| **Guard hook** — `tool_call` on `publish`: normalize params, caller allow list, secret scan, optional input rewrite; audit on block, deny, approval, and result | Identity gateway (oauth2-proxy, Tailscale Serve) |
| **`publish` tool** — loopback HTTP POST with `{ marker, url, content? }` | Task authorization table in the wrapper |
| Append-only **audit ledger** (hashes and field names, not body content) | Human approval card UI in the wrapper |
| Startup **warnings** when overlay settings drift from Day28 | Endpoint reconciliation (three-hash check) |

omp built-in approval (`tools.approval.bash: deny`, `publish: prompt`, `always-ask`) still does the heavy lifting; this extension adds caller-bound targets and evidence.

## Load

Draft-only (no outward tool):

```bash
omp acp --tools read --no-extensions \
  --config /path/to/examples/overlay.yml \
  -e /path/to/external-publish/src/guard.ts
```

Draft + publish (human approval on each `publish`):

```bash
omp acp --tools read --no-extensions \
  --config /path/to/examples/overlay.yml \
  -e /path/to/external-publish/src/guard.ts \
  -e /path/to/external-publish/src/publish-tool.ts \
  --publish-policy /path/to/policy.json
```

Environment for audit attribution (set by the wrapper, not trusted as authentication):

```bash
export OMP_PUBLISH_CALLER=program-caller-a
export OMP_PUBLISH_TASK=task-2026-001   # optional
export OMP_PUBLISH_LEDGER=$HOME/.omp/external-publish-audit.jsonl   # optional
```

Policy shape ([`examples/policy.example.json`](examples/policy.example.json)):

```json
{
  "callers": {
    "program-caller-a": { "targets": ["d28-demo-1", "d28-demo-2"] }
  }
}
```

Markers must match `d28-<id>`; URLs must be `http(s)://` on loopback only.

## Hooks (guard)

Registered on the guard extension:

- `tool_call` — block or rewrite `publish` before approval
- `tool_result` — record receipt id from a successful publish
- `tool_execution_end` — record bash/eval/publish completion (including denies omp reports here)
- `tool_approval_resolved` — record approve/deny for `publish`

## Tests

```bash
cd research_folder_omp_vs_Cursor/external-publish && bun test
```

Uses omp 18.2.8 extension loader/runner from `oh-my-pi-main/` (paths in `tsconfig.json`).

## Limits

- Caller id comes from env; stdio peers can lie — same boundary as the Day28 article (traceability, not proof of identity).
- Secret scan is pattern-based; it is not a DLP engine.
- No tamper-evident chain (see Day29 sequence for anchoring).
- Identity gateway, wrapper, and live ACP/RPC end-to-end runs are not included; only the omp-side pieces above.
