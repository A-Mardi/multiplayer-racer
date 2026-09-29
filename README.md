# Multiplayer Racer

A small browser racer built around responsive multiplayer.

[![Build](https://github.com/A-Mardi/multiplayer-racer/actions/workflows/build.yml/badge.svg)](https://github.com/A-Mardi/multiplayer-racer/actions/workflows/build.yml)

**Status: initial scaffold.** This repository contains a runnable frontend and language-specific starter code. The product features described in the roadmap are not implemented. There are no performance or adoption claims yet.

## Stack

Go, React, TypeScript.

## Run the frontend

Requires Node.js 22.12+; CI uses Node.js 24. From the repository root:

```sh
cd web
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Each project uses the same development ports; run one project at a time or adjust `web/vite.config.js` and the service address.

`npm run check` checks TypeScript. `npm run build` checks types and creates a production frontend build. `npm run preview` serves that static build; it does not include an API proxy or backend.

## Run the service

Install Go 1.26 or newer. In a second terminal, from the repository root:

```sh
cd server
go run ./cmd/server
```

The service binds to http://127.0.0.1:8080 and only exposes `GET /api/health`. The frontend dev server proxies `/api` to it. The health button verifies that the starter service is running; it does not verify any planned product feature.

Check the service with `go vet ./...` and `go build ./...` from `server/`.

## Repository layout

- `web/` — React + TypeScript frontend
- `server/` — standard-library Go HTTP service
- `docs/` — scope, component boundaries, and implementation milestones
- `.github/workflows/build.yml` — frontend and language-specific build checks

## Development

Read [the roadmap](docs/ROADMAP.md), [architecture notes](docs/ARCHITECTURE.md), and [contribution guidance](CONTRIBUTING.md).

## License

[MIT](LICENSE).
