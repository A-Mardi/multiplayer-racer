package main

import (
	"math"
	"testing"
)

func TestDrivingAndSurfaceDrag(t *testing.T) {
	c := Car{X: 600, Y: 690}
	for i := 0; i < 30; i++ {
		step(&c, Controls{Up: true}, 1.0/30)
	}
	if c.X <= 680 || c.Speed < 100 {
		t.Fatal("throttle did not accelerate")
	}
	a := c.Angle
	step(&c, Controls{Left: true}, 1.0/30)
	if c.Angle >= a {
		t.Fatal("left did not turn")
	}
	grass := Car{X: 700, Y: 440, Speed: 150}
	road := Car{X: 600, Y: 690, Speed: 150}
	step(&grass, Controls{}, 1.0/30)
	step(&road, Controls{}, 1.0/30)
	if grass.Speed >= road.Speed {
		t.Fatal("grass should slow the car")
	}
	for i := 0; i < 10000; i++ {
		step(&c, Controls{Up: true, Left: true}, 1.0/30)
	}
	if math.IsNaN(c.X) || c.X < 20 || c.X > 1380 {
		t.Fatal("invalid state")
	}
}
