export type Car = { x: number; y: number; angle: number; speed: number };
export type Controls = { up: boolean; down: boolean; left: boolean; right: boolean };
export const controls = (): Controls => ({ up: false, down: false, left: false, right: false });
export function onRoad(x: number, y: number) {
  return (
    ((x - 700) / 550) ** 2 + ((y - 440) / 340) ** 2 <= 1 &&
    ((x - 700) / 350) ** 2 + ((y - 440) / 160) ** 2 >= 1
  );
}
// Keep these constants and operation order aligned with server/cmd/server/model.go.
export function step(car: Car, input: Controls, dt = 1 / 30): Car {
  const c = { ...car },
    road = onRoad(c.x, c.y);
  c.speed += ((input.up ? 290 : 0) - (input.down ? 220 : 0)) * dt;
  c.speed *= Math.exp(-(road ? 0.95 : 4.8) * dt);
  c.speed = Math.max(-65, Math.min(road ? 245 : 85, c.speed));
  if (Math.abs(c.speed) < 0.1) c.speed = 0;
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (Math.abs(c.speed) > 1)
    c.angle += steer * (0.8 + Math.abs(c.speed) / 140) * dt * (c.speed < 0 ? -1 : 1);
  c.angle = Math.atan2(Math.sin(c.angle), Math.cos(c.angle));
  c.x = Math.max(20, Math.min(1380, c.x + Math.cos(c.angle) * c.speed * dt));
  c.y = Math.max(20, Math.min(860, c.y + Math.sin(c.angle) * c.speed * dt));
  return c;
}
export type Driver = Car & {
  id: string;
  name: string;
  seq: number;
  lap: number;
  checkpoint: number;
  best: number;
  last: number;
  connected: boolean;
};
