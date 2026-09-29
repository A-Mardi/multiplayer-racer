# Architecture notes

## Current scaffold

The web application displays project status and planned milestones. A loopback-only HTTP service exposes a scaffold health response at `/api/health`. It does not implement product APIs.

## Intended responsibilities

The Go service will own the authoritative simulation and room lifecycle. The client will own input, prediction, and rendering. The initial scaffold contains no simulation or networking beyond an HTTP health endpoint.

## Development decisions

- Keep each component independently buildable.
- Add dependencies only when a concrete feature needs them.
- Keep long-running work out of the UI thread.
- Define cancellation and failure behavior alongside the main workflow.
- Measure performance before making optimization claims.
- Use existing libraries where appropriate and attribute their contribution.

These notes describe an initial direction. Record significant changes here as the implementation develops.
