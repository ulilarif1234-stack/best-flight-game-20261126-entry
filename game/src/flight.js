// Arcade flight model: throttle and turn discipline decide the sortie.
// Speed buys lift; banking turns the nose; fuel burns with throttle; a
// landing only counts when it is gentle, slow and on a runway.
import { CFG } from './config.js';
import { runwayAt, terrainHeight } from './world.js';

export function createFlight() {
  return {
    x: 0, y: 0, z: 0,
    heading: 0, pitch: 0, bank: 0,
    speed: 0, vy: 0,
    throttle: 0,
    fuel: CFG.fuelCapacity,
    damage: 0,
    grounded: true,
    onRunway: null,
    engineOn: true,
  };
}

export function resetFlight(f, runway, headingDeg) {
  f.x = runway.x; f.z = runway.z;
  f.y = runway.elevation + CFG.gearHeight;
  f.heading = (headingDeg * Math.PI) / 180;
  f.pitch = 0; f.bank = 0;
  f.speed = 0; f.vy = 0;
  f.throttle = 0;
  f.fuel = CFG.fuelCapacity;
  f.damage = 0;
  f.grounded = true;
  f.onRunway = runway;
  f.engineOn = true;
}

// Place the aircraft airborne for a sortie that starts in the air.
export function placeAirborne(f, x, y, z, headingDeg, speed) {
  f.x = x; f.y = y; f.z = z;
  f.heading = (headingDeg * Math.PI) / 180;
  f.pitch = 0; f.bank = 0;
  f.speed = speed; f.vy = 0;
  f.throttle = 0.55;
  f.fuel = CFG.fuelCapacity;
  f.damage = 0;
  f.grounded = false;
  f.onRunway = null;
  f.engineOn = true;
}

// One fixed step. Returns an event string: 'touchdown', 'hard', 'crash',
// 'ditch', 'splash' or null.
export function stepFlight(f, input, dt, wind) {
  // Throttle.
  if (input.throttleUp) f.throttle = Math.min(1, f.throttle + 0.55 * dt);
  if (input.throttleDown) f.throttle = Math.max(0, f.throttle - 0.55 * dt);
  if (f.fuel <= 0) { f.fuel = 0; f.engineOn = false; }
  if (f.engineOn && f.fuel > 0) {
    f.fuel = Math.max(0, f.fuel - CFG.fuelBurn * f.throttle * dt);
    if (f.fuel <= 0) f.engineOn = false;
  }

  const flying = f.speed > CFG.stallSpeed;
  if (f.grounded) {
    // On the ground: roll, steer gently, lift off past rotation speed.
    const thrust = f.engineOn ? f.throttle * CFG.thrustAccel : 0;
    const drag = CFG.dragK * f.speed * f.speed + (input.airbrake ? 6 : 0.4);
    f.speed = Math.max(0, f.speed + (thrust - drag) * dt);
    f.heading -= input.roll * 0.35 * dt * Math.min(1, f.speed / 15);
    if (f.speed > 26 && input.pitch > 0) {
      f.grounded = false;
      f.pitch = 0.12;
      f.onRunway = null;
    }
    f.y = terrainHeight(f.x, f.z) + CFG.gearHeight;
    if (terrainHeight(f.x, f.z) < CFG.seaLevel + 1) return 'splash';
    const fx = Math.sin(f.heading), fz = Math.cos(f.heading);
    f.x += fx * f.speed * dt;
    f.z += fz * f.speed * dt;
    if (wind) { f.x += wind.x * dt * 0.4; f.z += wind.z * dt * 0.4; }
    return null;
  }

  // Airborne: stick authority grows with speed, vanishes at the stall.
  const authority = Math.min(1, Math.max(0, (f.speed - 8) / 22));
  const targetPitch = input.pitch * CFG.maxPitch * authority;
  const targetBank = -input.roll * CFG.maxBank * authority;
  f.pitch += (targetPitch - f.pitch) * Math.min(1, 1.6 * dt);
  f.bank += (targetBank - f.bank) * Math.min(1, 3.6 * dt);
  // A right bank (bank < 0) turns the nose right: heading decreases.
  f.heading += f.bank * CFG.turnK * (f.speed / CFG.maxSpeed) * dt;

  // Speed: thrust minus drag, minus the climb's cost.
  const thrust = f.engineOn ? f.throttle * CFG.thrustAccel : 0;
  const drag = CFG.dragK * f.speed * f.speed + (input.airbrake ? 9 : 0);
  const climbCost = Math.max(0, Math.sin(f.pitch)) * 9;
  f.speed = Math.max(0, f.speed + (thrust - drag - climbCost) * dt);

  // Vertical speed: pitch converts speed into climb; slow means sink, and
  // level flight always glides down a little unless power holds it up.
  const lift = flying ? Math.sin(f.pitch) * f.speed : 0;
  const stallSink = flying ? 0 : CFG.sinkRate * (1 - f.speed / CFG.stallSpeed);
  const glideSink = flying ? 1.4 * (1 - f.throttle * 0.7) : 0;
  f.vy = lift - stallSink - glideSink;
  const fx = Math.sin(f.heading), fz = Math.cos(f.heading);
  f.x += fx * f.speed * dt;
  f.z += fz * f.speed * dt;
  f.y += f.vy * dt;
  if (wind) { f.x += wind.x * dt; f.z += wind.z * dt; }

  // Ground contact.
  const ground = terrainHeight(f.x, f.z);
  const overSea = ground < CFG.seaLevel + 1;
  if (f.y <= ground + CFG.gearHeight) {
    const rw = runwayAt(f.x, f.z);
    const descent = -f.vy;
    if (overSea) { f.y = ground + CFG.gearHeight; return 'splash'; }
    if (rw && descent < 6 && f.speed < 55 && Math.abs(f.bank) < 0.35 && Math.abs(f.pitch) < 0.25) {
      f.grounded = true;
      f.onRunway = rw;
      f.y = ground + CFG.gearHeight;
      f.pitch = 0; f.bank = 0;
      f.vy = 0;
      return 'touchdown';
    }
    if (descent > 7.5 || f.speed > 55) { f.y = ground + CFG.gearHeight; return 'crash'; }
    // A survivable but rough arrival on rough ground.
    f.damage = Math.min(100, f.damage + CFG.damageDitch);
    f.grounded = true;
    f.onRunway = null;
    f.y = ground + CFG.gearHeight;
    f.pitch = 0; f.bank = 0; f.vy = 0;
    f.speed *= 0.4;
    return f.damage >= 100 ? 'crash' : 'ditch';
  }
  if (f.y < 1.2 && overSea) return 'splash';
  return null;
}

export function kmh(f) { return Math.round(f.speed * 3.6); }
export function headingDeg(f) {
  const d = Math.round(((f.heading * 180) / Math.PI) % 360);
  return (d + 360) % 360;
}
