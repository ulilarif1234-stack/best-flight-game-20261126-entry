// The three sorties. Each has a different goal, a different start, and a
// different way to fail — fuel and damage make every one a decision.
import { CFG } from './config.js';
import { placeAirborne, resetFlight } from './flight.js';

export const SORTIES = [
  {
    id: 'rings',
    name: 'Sortie 1 — Ring Run',
    brief: 'Thread all 8 rings over the island. Mind your throttle: the rings climb.',
    start: 'air',
  },
  {
    id: 'cargo',
    name: 'Sortie 2 — Cargo Run',
    brief: 'Freight for North Point. Take off from Meridian Field and land on the far runway.',
    start: 'ground',
  },
  {
    id: 'storm',
    name: 'Sortie 3 — Storm Landing',
    brief: 'A crosswind is blowing across Meridian Field. Land before the clock runs out.',
    start: 'air',
  },
];

export function createMission() {
  return {
    index: 0,
    ringsPassed: 0,
    prevRingDist: null, // signed distance to the next ring's plane, last frame
    timeLeft: 0,
    status: 'flying', // flying | complete | failed
    failReason: '',
    message: '',
    messageUntil: 0,
  };
}

export function startSortie(game, index) {
  const m = game.mission;
  const f = game.flight;
  m.index = index;
  m.ringsPassed = 0;
  m.prevRingDist = null;
  m.status = 'flying';
  m.failReason = '';
  const sortie = SORTIES[index];
  const home = CFG.runways[0];
  const far = CFG.runways[1];
  if (sortie.id === 'rings') {
    placeAirborne(f, -350, 185, 1420, 180, 48);
    m.message = 'Fly through the gold rings — 8 to go';
  } else if (sortie.id === 'cargo') {
    resetFlight(f, home, home.heading);
    m.message = 'Take off, then land on North Point runway';
  } else {
    placeAirborne(f, -1650, 210, 1350, 90, 50);
    m.timeLeft = CFG.sortie3Time;
    m.message = 'Land on Meridian Field before the clock runs out';
  }
  // Reset the rings: all gold again.
  for (const ring of game.world.rings) {
    ring.userData.passed = false;
    ring.material.color.setHex(0xffb020);
    ring.material.opacity = 0.95;
  }
  m.messageUntil = game.clock + 4;
  game.state = 'play';
  game.hud.showPlay();
}

export function objectiveText(game) {
  const m = game.mission;
  const sortie = SORTIES[m.index];
  if (sortie.id === 'rings') return `Rings ${m.ringsPassed} / 8`;
  if (sortie.id === 'cargo') return 'Land on North Point';
  return `Land on Meridian Field — ${Math.max(0, Math.ceil(m.timeLeft))}s`;
}

// Called every frame during play. Returns 'complete' | 'failed' | null.
export function updateMission(game, dt, flightEvent) {
  const m = game.mission;
  const f = game.flight;
  const sortie = SORTIES[m.index];
  const now = game.clock;

  if (sortie.id === 'storm' && m.status === 'flying') {
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) {
      m.status = 'failed';
      m.failReason = 'Out of time — the storm window closed before you landed.';
      return 'failed';
    }
  }

  if (sortie.id === 'rings' && m.status === 'flying') {
    const ring = game.world.rings[m.ringsPassed];
    if (ring) {
      const c = ring.userData.centre;
      const n = ring.userData.normal;
      const d = (f.x - c.x) * n.x + (f.y - c.y) * n.y + (f.z - c.z) * n.z;
      const dist = Math.hypot(f.x - c.x, f.y - c.y, f.z - c.z);
      if (m.prevRingDist !== null && Math.sign(d) !== Math.sign(m.prevRingDist) && dist < CFG.ringRadius + 4) {
        ring.userData.passed = true;
        ring.material.color.setHex(0x39d353);
        m.ringsPassed++;
        game.audio.ringChime();
        if (m.ringsPassed >= CFG.ringCentres.length) {
          m.status = 'complete';
          return 'complete';
        }
        m.message = `Ring ${m.ringsPassed + 1} of 8 — nice flying`;
        m.messageUntil = now + 2.5;
        // Next ring glows brighter.
        const next = game.world.rings[m.ringsPassed];
        if (next) next.material.opacity = 1;
      }
      m.prevRingDist = d;
    }
  }

  if (flightEvent === 'touchdown') {
    game.audio.touchdown();
    const rw = f.onRunway;
    if (sortie.id === 'cargo') {
      if (rw && rw.id === 'far') {
        m.status = 'complete';
        return 'complete';
      }
      m.message = rw ? `That's ${rw.name} — North Point is the far runway` : 'Off the strip — taxi back and try again';
      m.messageUntil = now + 3;
    } else if (sortie.id === 'storm') {
      if (rw && rw.id === 'home') {
        m.status = 'complete';
        return 'complete';
      }
      m.message = 'Down, but not on Meridian Field';
      m.messageUntil = now + 3;
    } else {
      m.message = 'Touchdown — throttle up and go again';
      m.messageUntil = now + 3;
    }
  }
  if (flightEvent === 'ditch') {
    m.message = 'Rough ground — the airframe took damage';
    m.messageUntil = now + 3;
    if (f.damage >= 100) {
      m.status = 'failed';
      m.failReason = 'The airframe gave out after too many hard knocks.';
      return 'failed';
    }
  }
  if (flightEvent === 'crash' || flightEvent === 'splash') {
    m.status = 'failed';
    m.failReason = flightEvent === 'splash'
      ? 'Ditched in the sea off Meridian Island.'
      : 'Terrain impact — the courier is down.';
    return 'failed';
  }
  if (flightEvent === 'hard') {
    m.message = 'Hard landing — check the damage gauge';
    m.messageUntil = now + 3;
  }
  if (f.fuel <= 0 && m.status === 'flying') {
    m.message = 'Fuel empty — gliding. Find a runway.';
    m.messageUntil = now + 3;
  }
  return null;
}
