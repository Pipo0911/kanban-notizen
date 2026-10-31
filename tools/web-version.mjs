// Schreibt beim Veröffentlichen der Web-App Version, Datum und Neuerungen in site/.
// Aufruf: node tools/web-version.mjs <site-ordner> <kurz-sha>
import fs from 'node:fs';
const [dir, sha = 'local'] = process.argv.slice(2);
const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const built = new Date().toISOString();
// Web-Version = App-Version + Datum/Zeit des Builds, damit jeder Push als Update erkannt wird
const stamp = built.slice(2, 16).replace(/[-:T]/g, '');
const version = conf.version, build = stamp;
// Neuerungen: Stichpunkte des obersten Abschnitts im CHANGELOG
const cl = fs.readFileSync('CHANGELOG.md', 'utf8').split('\n');
const start = cl.findIndex(l => l.startsWith('## '));
const notes = [];
for (let i = start + 1; i < cl.length && !cl[i].startsWith('## '); i++) {
  const m = cl[i].match(/^\s*-\s+(.*)/);
  if (m) notes.push((/^\s{2,}/.test(cl[i]) ? '– ' : '') + m[1].trim());
}
fs.writeFileSync(`${dir}/js/version.js`,
  `/* Automatisch erzeugt beim Veröffentlichen */\n'use strict';\nconst APP_VERSION=${JSON.stringify(version)},APP_BUILD=${JSON.stringify(build)},APP_BUILT=${JSON.stringify(built)};\n`);
fs.writeFileSync(`${dir}/version.json`, JSON.stringify({ version, build, built, sha, notes }, null, 1));
const sw = fs.readFileSync(`${dir}/sw.js`, 'utf8').replace("const VERSION='dev';", `const VERSION=${JSON.stringify(version + '-' + build + '-' + sha)};`);
if (!sw.includes(build)) throw new Error('VERSION in sw.js nicht gefunden');
fs.writeFileSync(`${dir}/sw.js`, sw);
console.log('Web-Version', version, 'Build', build, '·', notes.length, 'Neuerungen');
