# Changelog

## [Unreleased]

## [0.1.1] - 2026-10-14

### Fixed

- A publish URL with a query string or fragment is refused, and so is a URL path that names another `d28-` target than `marker`. Before, a caller allowed one target could publish to another by naming it in the URL or the content.

### Changed

- The `publish` tool always sends `{ "marker": …, "content": … }` as JSON, so the checked marker is the field the endpoint routes on. Before, a publish with content sent the content alone, as text or JSON, without the marker. A receiver that read the body as the announcement now reads `content`.

## [0.1.0] - 2026-10-12

### Added

- Guard extension: publish `tool_call` gate (allow list, secret scan, audit ledger), plus `tool_result`, `tool_execution_end`, and `tool_approval_resolved` hooks.
- `publish` tool extension for loopback marker POSTs.
- Example `overlay.yml` and `policy.example.json`, English and Traditional Chinese READMEs.
