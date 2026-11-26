// The courier aircraft: a low-poly single-prop plane built from boxes,
// cylinders and cones — fuselage, wings, tail, spinning propeller, fixed
// gear — in one warm cream-and-red livery.
export function buildAircraft(THREE) {
  const plane = new THREE.Group();
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2e3c2 });
  const red = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x2e5f7a, emissive: 0x1a3a4a });

  // Fuselage: a tapered cylinder along +Z (nose forward).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.4, 10), cream);
  fuselage.rotation.x = Math.PI / 2;
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 10), red);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 3.4;
  plane.add(nose);
  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), glass);
  canopy.scale.set(0.9, 0.75, 1.5);
  canopy.position.set(0, 0.72, 1.1);
  plane.add(canopy);
  // Main wing.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.18, 1.7), red);
  wing.position.set(0, -0.1, 0.6);
  plane.add(wing);
  // Wing tips.
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 1.5), cream);
    tip.position.set(s * 4.7, 0.05, 0.6);
    plane.add(tip);
  }
  // Tail: horizontal stabiliser and fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.1), red);
  stab.position.set(0, 0.15, -2.5);
  plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 1.2), red);
  fin.position.set(0, 0.8, -2.5);
  plane.add(fin);
  // Propeller: hub + two blades, spun by the flight loop.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.28, 3.4, 0.1);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  const b1 = new THREE.Mesh(bladeGeo, bladeMat);
  const b2 = new THREE.Mesh(bladeGeo, bladeMat);
  b2.rotation.z = Math.PI / 2;
  prop.add(b1); prop.add(b2);
  prop.position.z = 4.2;
  plane.add(prop);
  // Fixed landing gear: two legs, wheels, and a tail wheel.
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    leg.position.set(s * 0.9, -0.9, 1.2);
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 0.9, -1.45, 1.2);
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), dark);
  tailWheel.position.set(0, -0.75, -2.4);
  plane.add(tailWheel);
  // Navigation lights.
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  navL.position.set(-4.7, 0, 0.6);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0x44ff66 }));
  navR.position.set(4.7, 0, 0.6);
  plane.add(navL); plane.add(navR);

  return { group: plane, prop };
}
