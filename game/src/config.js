// Every tuning number and colour in one place, so the flight model, the
// missions and the HUD all read the same values.
export const CFG = {
  seed: 20261126,
  worldSize: 4200, // island spans -2100..2100 in x and z, metres
  seaLevel: 0,
  stallSpeed: 20, // m/s; below this the wing stops flying
  maxSpeed: 72, // m/s at full throttle in level flight
  cruiseSpeed: 46,
  thrustAccel: 13, // m/s^2 at full throttle
  dragK: 0.0032, // quadratic drag coefficient
  sinkRate: 2.2, // m/s lost when slow with no power
  pitchRate: 0.55, // rad/s at full stick and flying speed
  rollRate: 1.15, // rad/s
  maxPitch: 0.42,
  maxBank: 1.05,
  turnK: 0.62, // heading change per bank and speed
  fuelBurn: 0.5, // % per second at full throttle
  fuelCapacity: 100,
  damageHardLanding: 34,
  damageDitch: 26,
  gearHeight: 1.4, // metres of clearance on the gear
  // Runways: flat, level strips the terrain is blended to.
  runways: [
    {
      id: 'home',
      name: 'Meridian Field',
      x: -350, z: 1350, heading: 90, // degrees, east
      length: 420, width: 34, elevation: 24,
    },
    {
      id: 'far',
      name: 'North Point',
      x: 1050, z: -1150, heading: 30,
      length: 380, width: 32, elevation: 31,
    },
  ],
  // Sortie 1: a chain of rings over the island's landmarks.
  ringCentres: [
    [-350, 150, 900], [-150, 120, 350], [150, 170, -100],
    [550, 190, -500], [900, 150, -900], [650, 130, -1250],
    [1050, 120, -1150], [1050, 110, -800],
  ],
  ringRadius: 15,
  crosswind: { x: -7.5, z: 2.0 }, // m/s, sortie 3 only
  sortie3Time: 150, // seconds on the clock
  sky: {
    top: '#3f7ec2', mid: '#8fc3e8', horizon: '#ffd9a3',
    sun: '#ffe3b3', fog: '#cfe0ea', fogNear: 900, fogFar: 3800,
  },
};
