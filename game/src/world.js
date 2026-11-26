// Meridian Island: one procedural island with a coastline, a river valley,
// two mountain ridges, a small town and two runways. The height function is
// the single source of truth — the mesh, the aircraft's ground checks and
// the ring placement all read it.
import { CFG } from './config.js';
import { makeNoise, mulberry32 } from './random.js';

const noise = makeNoise(CFG.seed);
const rand = mulberry32(CFG.seed + 7);

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function gauss(d, r) { return Math.exp(-(d * d) / (2 * r * r)); }

// Distance to the river's centre line (a gentle S-curve running north-south).
function riverDistance(x, z) {
  const rx = 350 * Math.sin(z * 0.0006);
  return Math.abs(x - rx);
}

export function terrainHeight(x, z) {
  const r = Math.hypot(x, z) / 2100;
  const island = smoothstep(1.0, 0.62, r);
  if (island <= 0) return -6;
  let h = 6 + noise(x * 0.0011, z * 0.0011) * 22 + noise(x * 0.004, z * 0.004) * 6;
  h += 150 * gauss(Math.hypot(x + 950, z + 850), 650);
  h += 95 * gauss(Math.hypot(x - 1250, z - 250), 520);
  h += 55 * gauss(Math.hypot(x + 1400, z - 600), 450);
  h *= 0.35 + 0.65 * island;
  h -= 9 * gauss(riverDistance(x, z), 70) * island;
  // Blend the ground flat under each runway, with a clear approach
  // corridor past both thresholds so a landing never meets a hillside.
  for (const rw of CFG.runways) {
    const rad = (rw.heading * Math.PI) / 180;
    const dx = x - rw.x, dz = z - rw.z;
    // Local axes: u along the runway (the heading's forward), v across it.
    const u = dx * Math.sin(rad) + dz * Math.cos(rad);
    const v = dx * Math.cos(rad) - dz * Math.sin(rad);
    const du = Math.max(0, Math.abs(u) - (rw.length / 2 + 260));
    const dv = Math.max(0, Math.abs(v) - (rw.width / 2 + 55));
    const d = Math.hypot(du, dv);
    const w = 1 - smoothstep(0, 90, d);
    if (w > 0) h = h * (1 - w) + rw.elevation * w;
  }
  return h;
}

// Which runway, if any, is under this point (for landing checks).
export function runwayAt(x, z) {
  for (const rw of CFG.runways) {
    const rad = (rw.heading * Math.PI) / 180;
    const dx = x - rw.x, dz = z - rw.z;
    const u = dx * Math.sin(rad) + dz * Math.cos(rad);
    const v = dx * Math.cos(rad) - dz * Math.sin(rad);
    if (Math.abs(u) < rw.length / 2 && Math.abs(v) < rw.width / 2) return rw;
  }
  return null;
}

function skyTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, CFG.sky.top);
  grad.addColorStop(0.55, CFG.sky.mid);
  grad.addColorStop(0.82, CFG.sky.horizon);
  grad.addColorStop(1, '#f7c98d');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(THREE, scene) {
  const group = new THREE.Group();
  scene.add(group);

  // Sky dome and haze.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(6000, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(THREE), side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  scene.fog = new THREE.Fog(new THREE.Color(CFG.sky.fog), CFG.sky.fogNear, CFG.sky.fogFar);

  // Sun disc, low in the west, warm late-afternoon light.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(180, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2cf, fog: false }),
  );
  sun.position.set(-4200, 1500, -2600);
  sun.lookAt(0, 0, 0);
  group.add(sun);

  // Terrain mesh with painted vertex colours.
  const size = CFG.worldSize;
  const seg = 150;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const cSand = [0.85, 0.75, 0.54], cGrass = [0.42, 0.62, 0.36], cGrass2 = [0.52, 0.68, 0.4];
  const cRock = [0.55, 0.52, 0.46], cSnow = [0.92, 0.94, 0.96], cWet = [0.72, 0.63, 0.44];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    let c;
    const n = noise(x * 0.01, z * 0.01) * 0.5 + 0.5;
    if (h < 2.5) c = cSand;
    else if (h < 8 && riverDistance(x, z) < 80) c = cWet;
    else if (h < 55) c = n < 0.5 ? cGrass : cGrass2;
    else if (h < 120) c = cRock;
    else if (h < 165) c = [0.62, 0.6, 0.55];
    else c = cSnow;
    colours[i * 3] = c[0]; colours[i * 3 + 1] = c[1]; colours[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  group.add(terrain);

  // Sea.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000),
    new THREE.MeshLambertMaterial({ color: 0x2e7fa8, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0.6;
  group.add(sea);

  // River ribbon, following the valley down to the south coast.
  const riverPts = [];
  for (let z = -1900; z <= 1900; z += 100) riverPts.push([350 * Math.sin(z * 0.0006), z]);
  const riverGeo = new THREE.BufferGeometry();
  const rv = [];
  const rIdx = [];
  riverPts.forEach(([x, z], i) => {
    const y = Math.max(terrainHeight(x, z) + 0.6, 1.2);
    rv.push(x - 16, y, z, x + 16, y, z);
    if (i > 0) {
      const a = (i - 1) * 2;
      rIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3));
  riverGeo.setIndex(rIdx);
  riverGeo.computeVertexNormals();
  group.add(new THREE.Mesh(
    riverGeo,
    new THREE.MeshLambertMaterial({ color: 0x3f8fb5, transparent: true, opacity: 0.9 }),
  ));

  // Runways: asphalt, centre dashes, threshold bars, edge lights, windsock.
  const runwayMeshes = [];
  for (const rw of CFG.runways) {
    const g = new THREE.Group();
    const rad = (rw.heading * Math.PI) / 180;
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(rw.length, rw.width),
      new THREE.MeshLambertMaterial({ color: 0x3a3d42 }),
    );
    strip.rotation.x = -Math.PI / 2;
    // After rotateX, rotation.z spins the strip in its own plane. The
    // length axis maps to (cos z, 0, -sin z), so z = rad - pi/2 puts it
    // along the heading's forward direction (sin rad, 0, cos rad).
    strip.rotation.z = rad - Math.PI / 2;
    g.add(strip);
    const dashGeo = new THREE.PlaneGeometry(18, 2.4);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f2e8 });
    for (let d = -rw.length / 2 + 30; d < rw.length / 2 - 20; d += 46) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.rotation.z = rad - Math.PI / 2;
      dash.position.set(Math.sin(rad) * d, 0.12, Math.cos(rad) * d);
      g.add(dash);
    }
    const lightGeo = new THREE.SphereGeometry(1.1, 8, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    for (let d = -rw.length / 2 + 8; d <= rw.length / 2 - 8; d += 34) {
      for (const side of [-1, 1]) {
        const l = new THREE.Mesh(lightGeo, lightMat);
        l.position.set(
          Math.sin(rad) * d + Math.cos(rad) * side * (rw.width / 2 - 1),
          0.4,
          Math.cos(rad) * d - Math.sin(rad) * side * (rw.width / 2 - 1),
        );
        g.add(l);
      }
    }
    // Windsock beside the threshold.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }),
    );
    pole.position.set(Math.cos(rad) * (rw.width / 2 + 8), 4.5, -Math.sin(rad) * (rw.width / 2 + 8));
    g.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 4.5, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8643c }),
    );
    sock.rotation.z = Math.PI / 2;
    sock.position.set(
      Math.cos(rad) * (rw.width / 2 + 8) + Math.sin(rad) * 2.4,
      8.6,
      -Math.sin(rad) * (rw.width / 2 + 8) + Math.cos(rad) * 2.4,
    );
    g.add(sock);
    g.position.set(rw.x, rw.elevation + 0.15, rw.z);
    group.add(g);
    runwayMeshes.push(g);
  }

  // Town beside Meridian Field: houses with pitched roofs, two hangars.
  const town = new THREE.Group();
  const roofCols = [0xc96f4a, 0xb85c3e, 0xd98a5a, 0x9a6a4f];
  const wallCols = [0xf2e6cf, 0xe8dcc0, 0xdfd2b4];
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = 90 + rand() * 190;
    const x = -350 + Math.cos(a) * r + 120;
    const z = 1350 + Math.sin(a) * r * 0.7 - 60;
    if (runwayAt(x, z)) continue;
    const y = terrainHeight(x, z);
    const w = 9 + rand() * 7, d = 8 + rand() * 6, hgt = 5 + rand() * 4;
    const house = new THREE.Group();
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(w, hgt, d),
      new THREE.MeshLambertMaterial({ color: wallCols[i % wallCols.length] }),
    );
    walls.position.y = hgt / 2;
    house.add(walls);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3.5 + rand() * 2, 4),
      new THREE.MeshLambertMaterial({ color: roofCols[i % roofCols.length] }),
    );
    roof.position.y = hgt + 1.8;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);
    house.position.set(x, y, z);
    house.rotation.y = rand() * Math.PI;
    town.add(house);
  }
  for (const [hx, hz] of [[-260, 1150], [-180, 1160]]) {
    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(34, 12, 22),
      new THREE.MeshLambertMaterial({ color: 0x8a94a0 }),
    );
    hangar.position.set(hx, terrainHeight(hx, hz) + 6, hz);
    town.add(hangar);
  }
  group.add(town);

  // Trees, kept off runways and the river.
  const treeTrunk = new THREE.CylinderGeometry(0.5, 0.8, 4, 5);
  const treeTop = new THREE.ConeGeometry(3.4, 9, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3e7a3a });
  const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x4d8a42 });
  for (let i = 0; i < 170; i++) {
    const x = (rand() * 2 - 1) * 1900;
    const z = (rand() * 2 - 1) * 1900;
    const h = terrainHeight(x, z);
    if (h < 4 || h > 60 || runwayAt(x, z) || riverDistance(x, z) < 40) continue;
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(treeTrunk, trunkMat);
    trunk.position.y = 2;
    const top = new THREE.Mesh(treeTop, i % 2 ? leafMat : leafMat2);
    top.position.y = 8;
    t.add(trunk); t.add(top);
    const s = 0.8 + rand() * 0.9;
    t.scale.setScalar(s);
    t.position.set(x, h, z);
    group.add(t);
  }

  // Target rings for sortie 1.
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(CFG.ringRadius, 1.15, 10, 40);
  CFG.ringCentres.forEach(([x, y, z], i) => {
    const next = CFG.ringCentres[(i + 1) % CFG.ringCentres.length];
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.95 });
    const ring = new THREE.Mesh(ringGeo, mat);
    const cy = Math.max(y, terrainHeight(x, z) + 45);
    ring.position.set(x, cy, z);
    ring.lookAt(next[0], Math.max(next[1], terrainHeight(next[0], next[2]) + 45), next[2]);
    ring.userData.centre = new THREE.Vector3(x, cy, z);
    ring.userData.normal = new THREE.Vector3(next[0] - x, 0, next[2] - z).normalize();
    ring.userData.index = i;
    ring.userData.passed = false;
    group.add(ring);
    rings.push(ring);
  });

  // Drifting clouds.
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(14 + rand() * 16, 10, 8), cloudMat);
      s.position.set(j * 18 - n * 9 + rand() * 8, rand() * 6, rand() * 10 - 5);
      s.scale.y = 0.45;
      cloud.add(s);
    }
    cloud.position.set((rand() * 2 - 1) * 2000, 280 + rand() * 160, (rand() * 2 - 1) * 2000);
    cloud.userData.speed = 2 + rand() * 3;
    group.add(cloud);
    clouds.push(cloud);
  }

  return {
    rings,
    runwayMeshes,
    update(dt) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 2300) c.position.x = -2300;
      }
    },
  };
}
