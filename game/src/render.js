// The three.js scene: warm late-afternoon sun, haze, the island, the
// courier aircraft and a chase camera that follows the plane without
// ever fighting the pilot.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { buildAircraft } from './aircraft.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc3e8);

  // Late-afternoon sun from the west, warm; soft sky fill from above.
  const sun = new THREE.DirectionalLight(0xffe0ae, 2.4);
  sun.position.set(-1800, 1400, -900);
  scene.add(sun);
  const sky = new THREE.HemisphereLight(0x9fc8e8, 0x8a7a5a, 1.1);
  scene.add(sky);

  const world = buildWorld(THREE, scene);
  const aircraft = buildAircraft(THREE);
  aircraft.group.rotation.order = 'YXZ';
  scene.add(aircraft.group);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 12000);
  camera.position.set(0, 60, -40);

  const camState = { x: 0, y: 60, z: -40 };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    renderer, scene, camera, world, aircraft,
    // Chase camera: trails behind the plane's heading, eases in, looks
    // ahead of the nose. Bank rolls the horizon a little, never the view.
    updateCamera(f, dt) {
      const fx = Math.sin(f.heading), fz = Math.cos(f.heading);
      const tx = f.x - fx * 21, ty = f.y + 6.5, tz = f.z - fz * 21;
      const k = 1 - Math.exp(-3.6 * dt);
      camState.x += (tx - camState.x) * k;
      camState.y += (ty - camState.y) * k;
      camState.z += (tz - camState.z) * k;
      // Keep the camera out of the terrain.
      const ground = 8;
      if (camState.y < ground) camState.y = ground;
      camera.position.set(camState.x, camState.y, camState.z);
      camera.up.set(Math.sin(f.bank * 0.25), Math.cos(f.bank * 0.25), 0);
      camera.lookAt(f.x + fx * 26, f.y + 1.5, f.z + fz * 26);
    },
    updateAircraft(f, dt) {
      const g = aircraft.group;
      g.position.set(f.x, f.y, f.z);
      g.rotation.y = f.heading;
      g.rotation.x = -f.pitch;
      g.rotation.z = f.bank;
      // Propeller spins with throttle, faster in the air.
      const spin = (2 + f.throttle * 26) * (f.grounded ? 0.6 : 1);
      aircraft.prop.rotation.z += spin * dt;
    },
    render() { renderer.render(scene, camera); },
  };
}
