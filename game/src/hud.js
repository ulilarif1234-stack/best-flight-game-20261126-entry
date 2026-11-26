// The HUD: lit digital readouts, bar gauges, a drawn instrument panel
// (artificial horizon, compass tape, altitude and speed tapes) and the
// title / end overlays. Instruments are drawn, not just typed, so they
// look flown.
import { headingDeg, kmh } from './flight.js';
import { SORTIES, objectiveText } from './missions.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const hud = {
    root: $('hud'),
    alt: $('hud-alt'), spd: $('hud-spd'), hdg: $('hud-hdg'), vs: $('hud-vs'),
    objective: $('hud-objective'), sortieName: $('hud-sortie'),
    fuelBar: $('bar-fuel'), fuelText: $('fuel-text'),
    dmgBar: $('bar-damage'), dmgText: $('damage-text'),
    thrBar: $('bar-throttle'), thrText: $('throttle-text'),
    gear: $('hud-gear'),
    banner: $('banner'), bannerSub: $('banner-sub'),
    warn: $('warn'),
    instruments: $('instruments'),
    title: $('title-screen'), end: $('end-screen'),
    endTitle: $('end-title'), endText: $('end-text'), endStats: $('end-stats'),
    muteBtn: $('mute-btn'),
    showPlay() {
      hud.root.classList.remove('hidden');
      hud.title.classList.add('hidden');
      hud.end.classList.add('hidden');
    },
    showTitle() {
      hud.root.classList.add('hidden');
      hud.title.classList.remove('hidden');
      hud.end.classList.add('hidden');
    },
    showEnd(kind, title, text, stats) {
      hud.end.classList.remove('hidden');
      hud.end.dataset.kind = kind;
      hud.endTitle.textContent = title;
      hud.endText.textContent = text;
      hud.endStats.textContent = stats;
    },
  };
  return hud;
}

export function updateHud(game, dt) {
  const h = game.hud;
  const f = game.flight;
  const m = game.mission;
  h.alt.textContent = `${Math.max(0, Math.round(f.y))} m`;
  h.spd.textContent = `${kmh(f)} km/h`;
  h.hdg.textContent = `${String(headingDeg(f)).padStart(3, '0')}°`;
  h.vs.textContent = `${f.vy >= 0 ? '+' : ''}${f.vy.toFixed(1)} m/s`;
  h.sortieName.textContent = SORTIES[m.index].name;
  h.objective.textContent = objectiveText(game);
  h.fuelBar.style.width = `${f.fuel}%`;
  h.fuelText.textContent = `FUEL ${Math.round(f.fuel)}%`;
  h.fuelBar.classList.toggle('low', f.fuel < 20);
  h.dmgBar.style.width = `${f.damage}%`;
  h.dmgText.textContent = `DMG ${Math.round(f.damage)}%`;
  h.dmgBar.classList.toggle('bad', f.damage > 50);
  h.thrBar.style.width = `${Math.round(f.throttle * 100)}%`;
  h.thrText.textContent = `THR ${Math.round(f.throttle * 100)}%`;
  h.gear.textContent = f.grounded ? 'ON GROUND' : 'GEAR DOWN';
  // Banner message with a fade.
  if (game.clock < m.messageUntil) {
    h.banner.textContent = m.message;
    h.banner.classList.remove('hidden');
  } else {
    h.banner.classList.add('hidden');
  }
  // Warnings.
  const warns = [];
  if (f.fuel > 0 && f.fuel < 20) warns.push('LOW FUEL');
  if (f.damage > 60) warns.push('AIRFRAME DAMAGE');
  if (!f.engineOn && f.fuel <= 0) warns.push('ENGINE OUT — GLIDING');
  if (!f.grounded && f.y < 40 && f.vy < -4) warns.push('PULL UP');
  h.warn.textContent = warns.join('  •  ');
  h.warn.classList.toggle('hidden', warns.length === 0);
  drawInstruments(h.instruments, f);
}

function drawInstruments(canvas, f) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  // Panel face.
  ctx.fillStyle = '#141a24';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#3a4556';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  // Artificial horizon, centre-left.
  const cx = 62, cy = H / 2, r = 34;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(f.bank);
  const pitchPx = Math.max(-r, Math.min(r, -f.pitch * 46));
  ctx.fillStyle = '#2f6fb2'; ctx.fillRect(-r - 2, -r - 2 + pitchPx, r * 2 + 4, r + 2 - pitchPx);
  ctx.fillStyle = '#7a5a34'; ctx.fillRect(-r - 2, pitchPx, r * 2 + 4, r + 2);
  ctx.strokeStyle = '#f5f2e8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r, pitchPx); ctx.lineTo(r, pitchPx); ctx.stroke();
  ctx.restore();
  // Fixed aircraft symbol over the horizon.
  ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 4, cy);
  ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 14, cy);
  ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 5);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#3a4556'; ctx.lineWidth = 2; ctx.stroke();
  // Compass tape across the top.
  ctx.fillStyle = '#ffd27a';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  const hdg = headingDeg(f);
  ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, 175, 22);
  ctx.strokeStyle = '#8a94a0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(120, 30); ctx.lineTo(230, 30); ctx.stroke();
  for (let d = -30; d <= 30; d += 10) {
    const a = (hdg + d + 360) % 360;
    const x = 175 + d * 1.8;
    ctx.strokeStyle = '#c8ccd2';
    ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, d % 30 === 0 ? 40 : 35); ctx.stroke();
    if (d % 30 === 0) {
      ctx.fillStyle = '#c8ccd2';
      ctx.font = '10px monospace';
      ctx.fillText(String(a).padStart(3, '0'), x, 52);
    }
  }
  // Altitude and speed tapes, right side.
  ctx.fillStyle = '#e8ecf0';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`ALT ${Math.max(0, Math.round(f.y))}m`, 118, 76);
  ctx.fillText(`SPD ${kmh(f)}`, 118, 96);
  ctx.fillStyle = '#ffd27a';
  ctx.font = '11px monospace';
  ctx.fillText(f.grounded ? 'ON GROUND' : 'AIRBORNE', 118, 114);
}
