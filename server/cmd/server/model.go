package main

import "math"

type Car struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Angle float64 `json:"angle"`
	Speed float64 `json:"speed"`
}
type Controls struct {
	Up    bool `json:"up"`
	Down  bool `json:"down"`
	Left  bool `json:"left"`
	Right bool `json:"right"`
}

func onRoad(x, y float64) bool {
	outer := math.Pow((x-700)/550, 2) + math.Pow((y-440)/340, 2)
	inner := math.Pow((x-700)/350, 2) + math.Pow((y-440)/160, 2)
	return outer <= 1 && inner >= 1
}
func step(c *Car, input Controls, dt float64) {
	road := onRoad(c.X, c.Y)
	accel := 0.0
	if input.Up {
		accel += 290
	}
	if input.Down {
		accel -= 220
	}
	c.Speed += accel * dt
	drag, limit := .95, 245.0
	if !road {
		drag, limit = 4.8, 85
	}
	c.Speed *= math.Exp(-drag * dt)
	c.Speed = math.Max(-65, math.Min(limit, c.Speed))
	if math.Abs(c.Speed) < .1 {
		c.Speed = 0
	}
	steer := 0.0
	if input.Left {
		steer--
	}
	if input.Right {
		steer++
	}
	if math.Abs(c.Speed) > 1 {
		sign := 1.0
		if c.Speed < 0 {
			sign = -1
		}
		c.Angle += steer * (.8 + math.Abs(c.Speed)/140) * dt * sign
	}
	c.Angle = math.Atan2(math.Sin(c.Angle), math.Cos(c.Angle))
	c.X = math.Max(20, math.Min(1380, c.X+math.Cos(c.Angle)*c.Speed*dt))
	c.Y = math.Max(20, math.Min(860, c.Y+math.Sin(c.Angle)*c.Speed*dt))
}
