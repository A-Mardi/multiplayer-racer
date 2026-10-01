# Circuit architecture

## Authority and timing

Go advances vehicle state at a fixed 1/30-second step, applies the most recent valid input, and broadcasts state with acknowledged sequence numbers. Clients send boolean throttle, brake, and steering inputs; position, lap count, and checkpoint claims are never accepted from clients. Input goes neutral after 400 ms without a fresh message. The simulation models acceleration, drag, steering, reverse, and slower grass; it is an arcade kinematic model, not rigid-body physics.

The client predicts at the same 30 Hz rate. On each snapshot it restores its authoritative car state, discards acknowledged inputs, and replays remaining inputs. Other cars interpolate between the two most recent snapshots. Rendering runs through requestAnimationFrame independently from the simulation. The Go and TypeScript model constants are intentionally aligned; maintaining parity is a maintenance cost of this split. Snapshot queues are bounded; a stalled reader can miss snapshots and catch up on a later state.

## Rooms and reconnect

The server issues a random reconnect token. The same tab can reclaim its car for 60 seconds; a new socket supersedes its old socket. Checkpoints must be visited in order before crossing the finish gate in the correct direction. Lap time comes from authoritative tick counts. Under server overload, the fixed-step timer can lag wall time; this beta does not implement catch-up ticks or claim competition-grade timing.

## Network harness

The UI adds half the selected round-trip delay to outbound input and inbound messages. Ping includes that delay. This reproduces latency, not packet loss or reordering. The load harness opens eight real WebSocket clients, sends 30 Hz inputs, steers them around the course, measures snapshot cadence and ping, and requires each client to receive over 25 updates/second and at least one driver to complete a valid lap.

## Spectators

A socket with spectate=1 is registered in a separate room connection set and receives a role-only welcome without a driver token. The server broadcasts the same bounded snapshots and spectator count to watchers. Spectators can ping but cannot submit controls or reset a car. Disconnection immediately releases the spectator slot; an empty room is removed only after both its driver and spectator sets are empty. The browser does not run local prediction or expose driving controls while spectating.
