# Contributing

Start with the README setup and architecture notes. Keep the interface focused on the primary task and use the existing paper, ink, and sage palette.

Before a pull request, run Go tests and vet, the frontend build, and Playwright. Format Go with gofmt and frontend sources with `npm run format --prefix web`. Browser tests use isolated storage; do not point them at someone else's data directory.

Bug reports should include steps, browser/OS, expected behavior, actual behavior, and sanitized logs. Do not attach private files or reconnect/download tokens. Performance changes need a reproducible workload, environment, and before/after measurements. Describe what was tested and keep limitations explicit.
