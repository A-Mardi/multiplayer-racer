# Eight-driver local measurement

Measured 2026-09-29 on Intel Core Ultra 7 155H, Windows 10.0.26200, Node v24.19.0, Go 1.27.1. The client harness and server ran on the same computer over loopback.

Start the app, then run `node scripts/load-test.mjs`. An optional first argument overrides the WebSocket endpoint (default ws://127.0.0.1:8093/ws). The harness creates a unique room, connects eight clients, sends steering inputs at 30 Hz, and measures 24 seconds of snapshots and ping replies.

| Metric | Observed |
| --- | ---: |
| Concurrent simulated drivers | 8 |
| Snapshot rate, each of eight clients | 30.00 Hz |
| Completed valid laps, each client | 1 |
| Ping samples | 184 |
| Loopback RTT p50 | 0.51 ms |
| Loopback RTT p95 | 0.98 ms |

This verifies the configured eight-seat room with headless protocol clients. It does not measure WAN latency, browser render performance, many-room capacity, packet loss, or production load. The browser test separately exercises two drivers and 200 ms of added RTT. A nonzero RTT value in the UI is measured, not a server tick interval or a promise of internet latency. 30 Hz means a nominal 33.3 ms simulation step.
