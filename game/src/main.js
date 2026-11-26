// SKY COURIER: Meridian Run — game loop and state machine.
// States: title → play → complete | crash. R restarts a sortie, M mutes.
import * as THREE from 'three';
import { CFG } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createFlight, resetFlight, stepFlight } from './flight.js';
import { createMission, startSortie, updateMission } from './missions.js';
import { createHud, updateHud } from './hud.js';
import { createRenderer } from './render.js';
import { applyShot } from './shots.js';

const game = {
  state: 'title',
  clock: 0,
  shotFrozen: false,
  settleFrames: 0,
  lastWarn: 0,
};

function buildGame() {
  const canvas = document.getElementById('view');
  game.renderer = createRenderer(canvas);
  game.world = game.renderer.world;
  game.flight = createFlight();
  game.mission = createMission();
  game.hud = createHud();
  game.input = createInput();
  game.audio = createAudio();
  resetFlight(game.flight, CFG.runways[0], CFG.runways[0].heading);
  game.hud.showTitle();
  wireButtons();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    game.audio.unlock();
    applyShot(game, shot);
  }
  // Debug handle for the screenshot harness.
  window.__skycourier = {
    game,
    state: () => ({
      screen: game.state,
      sortie: game.mission.index,
      rings: game.mission.ringsPassed,
      alt: Math.round(game.flight.y),
      speed: Math.round(game.flight.speed * 3.6),
      fuel: Math.round(game.flight.fuel),
      damage: Math.round(game.flight.damage),
      grounded: game.flight.grounded,
    }),
  };
}

function wireButtons() {
  document.querySelectorAll('[data-sortie]').forEach((btn) => {
    btn.addEventListener('click', () => {
      game.audio.unlock();
      startSortie(game, Number(btn.dataset.sortie));
    });
  });
  document.getElementById('btn-again').addEventListener('click', () => {
    game.audio.unlock();
    startSortie(game, game.mission.index);
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    game.audio.unlock();
    startSortie(game, (game.mission.index + 1) % 3);
  });
  document.getElementById('btn-title').addEventListener('click', () => {
    resetFlight(game.flight, CFG.runways[0], CFG.runways[0].heading);
    game.state = 'title';
    game.hud.showTitle();
  });
  game.hud.muteBtn.addEventListener('click', () => {
    const muted = game.audio.toggleMute();
    game.hud.muteBtn.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
  });
}

function showEndOverlay(kind) {
  const m = game.mission;
  const f = game.flight;
  const stats = `Fuel ${Math.round(f.fuel)}%  •  Damage ${Math.round(f.damage)}%  •  Speed ${Math.round(f.speed * 3.6)} km/h`;
  const nextBtn = document.getElementById('btn-next');
  if (kind === 'complete') {
    nextBtn.classList.remove('hidden');
    const names = ['RING RUN COMPLETE', 'CARGO DELIVERED', 'STORM LANDING COMPLETE'];
    const texts = [
      'All eight rings threaded. Meridian Island has never looked better from the air.',
      'Freight down safe on North Point runway. The island keeps flying because of you.',
      'Down in one piece with the clock to spare, crosswind and all. Textbook.',
    ];
    game.hud.showEnd('complete', names[m.index], texts[m.index], stats);
  } else {
    nextBtn.classList.add('hidden');
    game.hud.showEnd('crash', 'SORTIE FAILED', m.failReason || 'The courier is down.', stats);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
  frame.last = now;
  game.clock += dt;
  const input = game.input;
  const f = game.flight;

  if (game.state === 'title') {
    // Slow orbit around the parked courier while the title is up.
    const t = game.clock * 0.1;
    const cam = game.renderer.camera;
    cam.position.set(f.x + Math.sin(t) * 26, f.y + 9, f.z + Math.cos(t) * 26);
    cam.up.set(0, 1, 0);
    cam.lookAt(f.x, f.y + 1, f.z);
    game.renderer.updateAircraft(f, dt);
    if (input.wasPressed('Digit1')) startSortie(game, 0);
    if (input.wasPressed('Digit2')) startSortie(game, 1);
    if (input.wasPressed('Digit3')) startSortie(game, 2);
  } else if (game.state === 'play') {
    if (input.wasPressed('KeyR')) startSortie(game, game.mission.index);
    if (input.wasPressed('KeyM')) game.hud.muteBtn.click();
    if (!game.shotFrozen) {
      const wind = game.mission.index === 2 ? CFG.crosswind : null;
      const ev = stepFlight(f, input, dt, wind);
      if (ev === 'crash' || ev === 'splash') game.audio.crash();
      const result = updateMission(game, dt, ev);
      if (result === 'complete') {
        game.state = 'complete';
        showEndOverlay('complete');
      } else if (result === 'failed') {
        game.state = 'crash';
        showEndOverlay('crash');
      }
      // Low-fuel reminder beep, at most once every 4 seconds.
      if (f.fuel > 0 && f.fuel < 15 && game.clock - game.lastWarn > 4) {
        game.lastWarn = game.clock;
        game.audio.warning();
      }
    }
    game.renderer.updateCamera(f, dt);
    game.renderer.updateAircraft(f, dt);
    updateHud(game, dt);
    game.audio.update(f.throttle, f.speed, !f.grounded);
  } else {
    // complete / crash: the scene holds still behind the overlay, and the
    // HUD stays live so it never shows a stale sortie.
    if (input.wasPressed('KeyR')) startSortie(game, game.mission.index);
    game.renderer.updateCamera(f, dt);
    game.renderer.updateAircraft(f, dt);
    updateHud(game, dt);
  }

  game.world.update(dt);
  game.renderer.render();
  input.endFrame();
  if (game.settleFrames > 0) game.settleFrames--;
}

buildGame();
requestAnimationFrame(frame);
