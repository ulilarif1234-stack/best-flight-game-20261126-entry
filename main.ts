// SKY COURIER: Meridian Run — entry packager.
//
// This file is the submission's entrypoint. It collects everything the judge
// needs — the playable game in game/, the four judging screenshots in
// screenshots/, and the machine-readable summary dossier.json — into a single
// output folder.
//
// The output folder comes from MAKEFUN_OUTPUT_DIR when the grader sets it and
// falls back to /output otherwise. Every path is resolved from this file's own
// directory, so the script works no matter where it is invoked from:
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Nothing here touches the network, and nothing is written outside the output
// folder. Only the Node standard library is used.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath as urlToPath } from 'node:url';
import { buildDossier as makeDossier } from './vendor/makefun-game.ts';

const projectRoot = path.dirname(urlToPath(import.meta.url));
const outputRoot = process.env['MAKEFUN_OUTPUT_DIR'] ?? '/output';

// Stop loudly with a clear message instead of producing a broken entry.
function abort(message: string): never {
  throw new Error(`packager: ${message}`);
}

// Count every file under a directory, descending into subdirectories.
function tallyFiles(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? tallyFiles(path.join(dir, entry.name)) : 1;
  }
  return total;
}

const gameDir = path.join(projectRoot, 'game');
const shotDir = path.join(projectRoot, 'screenshots');

// The entry is unplayable without its landing page, so refuse to pack it.
if (!fs.existsSync(path.join(gameDir, 'index.html'))) {
  abort('game/index.html is missing — the entry has no playable page');
}

// The judge expects between one and four screenshots, no more, no fewer.
if (!fs.existsSync(shotDir)) {
  abort('screenshots/ is missing — the entry has no screenshots');
}
const shotNames = fs
  .readdirSync(shotDir)
  .filter((name) => fs.statSync(path.join(shotDir, name)).isFile());
if (shotNames.length < 1 || shotNames.length > 4) {
  abort(`screenshots/ must hold 1 to 4 files, found ${shotNames.length}`);
}

fs.mkdirSync(outputRoot, { recursive: true });
fs.cpSync(gameDir, path.join(outputRoot, 'game'), { recursive: true });
fs.mkdirSync(path.join(outputRoot, 'screenshots'), { recursive: true });
fs.cpSync(shotDir, path.join(outputRoot, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the bytes, while the rest
// refuse an entry the scorer would refuse — more than 4 screenshots or one
// over 256 KiB, more than 993 files in game/ or 48 MiB of game files in all,
// or a path under game/ over 1000 bytes.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const dossier = makeDossier(outputRoot, caps);
fs.writeFileSync(path.join(outputRoot, 'dossier.json'), dossier);

const gameFiles = tallyFiles(path.join(outputRoot, 'game'));
console.log(
  `packed SKY COURIER: ${gameFiles} game files, ${shotNames.length} screenshots, dossier.json ${dossier.byteLength} bytes -> ${outputRoot}`,
);
