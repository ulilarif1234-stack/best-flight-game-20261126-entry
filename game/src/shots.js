// Screenshot presets, driven by ?shot= in the URL. Each one puts the game
// into a real state — mid-flight, through a ring, on final approach, or on
// the mission-complete screen — and freezes the physics so the frame is
// stable while the renderer keeps drawing. Used only for screenshots.
import { CFG } from './config.js';
import { placeAirborne, resetFlight } from './flight.js';
import { startSortie } from './missions.js';

export function applyShot(game, shot) {
  const f = game.flight;
  const home = CFG.runways[0];
  const far = CFG.runways[1];
  game.hud.showPlay();
  game.shotFrozen = true;

  if (shot === 'cover') {
    // Chase view in flight: rings and the far runway ahead over the island.
    startSortie(game, 0);
    placeAirborne(f, -420, 175, 1250, 165, 48);
    f.throttle = 0.72;
    game.mission.ringsPassed = 0;
    game.mission.message = 'Fly through the gold rings — 8 to go';
    game.mission.messageUntil = game.clock + 60;
  } else if (shot === 'rings') {
    // A breath from the third ring, dead ahead.
    startSortie(game, 0);
    const c = game.world.rings[2].userData.centre;
    const n = game.world.rings[2].userData.normal;
    placeAirborne(f, c.x - n.x * 46, c.y, c.z - n.z * 46, 0, 50);
    f.heading = Math.atan2(n.x, n.z);
    f.throttle = 0.8;
    game.mission.ringsPassed = 2;
    game.mission.message = 'Ring 3 of 8 — nice flying';
    game.mission.messageUntil = game.clock + 60;
  } else if (shot === 'landing') {
    // Final approach to North Point, gear down, HUD lit.
    startSortie(game, 1);
    const rad = (far.heading * Math.PI) / 180;
    const ax = far.x - Math.sin(rad) * 220;
    const az = far.z - Math.cos(rad) * 220;
    placeAirborne(f, ax, far.elevation + 26, az, far.heading, 40);
    f.throttle = 0.35;
    f.pitch = -0.06;
    game.mission.message = 'Final approach — North Point runway ahead';
    game.mission.messageUntil = game.clock + 60;
  } else if (shot === 'victory') {
    // Landed on the far runway: mission-complete screen over the scene.
    startSortie(game, 1);
    resetFlight(f, far, far.heading);
    f.speed = 6;
    f.throttle = 0;
    game.mission.status = 'complete';
    game.state = 'complete';
    game.hud.showEnd(
      'complete',
      'CARGO DELIVERED',
      'Freight down safe on North Point runway. The island keeps flying because of you.',
      'Sortie 2 — Cargo Run  •  Fuel 61%  •  Damage 0%  •  Time 4:12',
    );
  }
  // A few frames so the chase camera settles before the capture.
  game.settleFrames = 45;
}
