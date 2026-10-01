# Circuit roadmap

## Shipped in the local beta

- Shared rooms for up to eight drivers, keyboard/touch controls, checkpoints, and lap times.
- A 30 Hz authoritative server; clients submit controls rather than positions.
- Local prediction, acknowledgement-based reconciliation, and remote-car interpolation.
- Reconnect tokens, measured ping, render diagnostics, and selectable added network delay.

## Next, not implemented

- Automated Go/TypeScript model parity fixtures.
- Jitter/loss tests and interpolation buffering.
- Room lifecycle controls and additional tracks.

The README and tests describe current behavior. Roadmap items are not resume claims or capacity guarantees.

## Added after the initial beta

Live spectator mode, separate driver/spectator limits, shareable viewing links, and protocol tests that reject spectator control messages.
