// Keyboard and mouse state, polled once per frame. Keys are tracked by
// their physical code so the layout never matters.
export function createInput() {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered: cleared after each frame
  let anyKey = false;
  function onDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    anyKey = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onUp(e) { keys.delete(e.code); }
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', () => { keys.clear(); pressed.clear(); });
  return {
    // Held axes, -1..1.
    get pitch() { return (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0); },
    get roll() { return (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0); },
    get throttleUp() { return keys.has('KeyW'); },
    get throttleDown() { return keys.has('KeyS'); },
    get airbrake() { return keys.has('Space'); },
    wasPressed(code) { return pressed.has(code); },
    consumeAnyKey() { const v = anyKey; anyKey = false; return v; },
    endFrame() { pressed.clear(); },
  };
}
