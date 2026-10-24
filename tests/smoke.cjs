const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
assert.match(html, /^<!doctype html>/i);
assert.equal((html.match(/<script\b/gi) || []).length, (html.match(/<\/script>/gi) || []).length);
assert.equal((html.match(/<style\b/gi) || []).length, (html.match(/<\/style>/gi) || []).length);
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
for (const [, attrs, body] of scripts) {
  if (/application\/ld\+json/i.test(attrs)) {
    const schema = JSON.parse(body);
    assert.equal(schema['@type'], 'WebApplication');
    assert.notEqual(schema.isAccessibleForFree, true, 'Do not advertise free access');
  } else if (!/\bsrc\s*=/.test(attrs)) {
    new vm.Script(body, { filename: 'index.html:inline.js' });
  }
}
for (const id of ['setup','reader','scroller','rText','btnPlay','btnStart','btnSave','btnImport','btnExport']) {
  assert.ok(html.includes('id="' + id + '"') || html.includes("id='" + id + "'"), 'Missing element ' + id);
}
assert.match(html, /visibilitychange/);
assert.match(html, /flushDraft\(\)/);
console.log('OK: HTML structure, JavaScript syntax, schema and essential controls');

const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.icons.length);
for (const icon of manifest.icons) assert.ok(fs.existsSync(icon.src.replace(/^\.\//, '')));
const worker = fs.readFileSync('sw.js', 'utf8');
new vm.Script(worker, { filename: 'sw.js' });
assert.match(html, /serviceWorker\.register/);
assert.match(html, /id="libSearch"/);
assert.match(html, /K_SESSION/);
console.log('OK: PWA, offline worker, library search and session recovery');

for (const id of ['btnFullscreen', 'readerContrast', 'rWords']) {
  assert.ok(html.includes('id="' + id + '"'), 'Missing new control ' + id);
}
assert.match(html, /fullscreenchange/);
assert.match(html, /high-contrast/);
console.log('OK: fullscreen, high contrast and reading progress');

for (const feature of ['duplicateScript(', 'btnBookmarkSave', 'btnBookmarkGo', 'K_BOOKMARKS']) {
  assert.ok(html.includes(feature), 'Missing feature ' + feature);
}
console.log('OK: script duplication and reading bookmarks');

assert.match(html, /id="libSort"/);
assert.match(html, /localeCompare\(b\.name, 'es'\)/);
assert.match(html, /Math\.imul\(h, 16777619\)/);
console.log('OK: library sorting and compact bookmark key');

assert.match(html, /id="readingStats"/);
assert.match(html, /function recordReading\(completed\)/);
assert.match(html, /K_STATS/);
assert.match(html, /R\.statsRecorded = false/);
console.log('OK: local reading statistics');

for (const shortcut of ["e.key === 'ArrowLeft'", "e.key === 'ArrowRight'", "e.key === 'Home'", "e.key === 'End'"]) {
  assert.ok(html.includes(shortcut), 'Missing keyboard shortcut ' + shortcut);
}
assert.match(html, /function seekReader\(progress\)/);
assert.match(html, /document\.exitFullscreen\(\)\.catch/);
console.log('OK: presenter shortcuts and fullscreen cleanup');

const elementIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const seen = new Set();
for (const id of elementIds) {
  assert.ok(!seen.has(id), 'Duplicate HTML id: ' + id);
  seen.add(id);
}
const idsList = html.match(/\['setup','title'[\s\S]*?\]\.forEach\(id =>/);
assert.ok(idsList, 'Missing DOM element registry');
for (const match of idsList[0].matchAll(/'([^']+)'/g)) {
  assert.ok(seen.has(match[1]), 'Registry references missing HTML element: ' + match[1]);
}
assert.match(html, /id="btnResetStats"/);
console.log('OK: unique DOM ids, complete element registry and statistics reset');

for (const id of ['lineDown','lineUp','lineVal']) assert.match(html, new RegExp('id="' + id + '"'));
assert.match(html, /function setLineSpacing\(v\)/);
assert.match(html, /--line-spacing/);
console.log('OK: adjustable reader line spacing');

assert.match(html, /id="readerFont"/);
assert.match(html, /function setReaderFont\(font\)/);
assert.match(html, /--reader-font/);
console.log('OK: persisted reader font selection');

assert.match(worker, /prompter-static-v6/);
assert.match(worker, /url\.origin !== self\.location\.origin/);
assert.match(worker, /request\.method !== 'GET'/);
console.log('OK: PWA cache rotation and same-origin GET-only caching');

assert.match(html, /keys\.length - 100/);
assert.match(html, /flex-wrap:wrap/);
console.log('OK: bounded bookmarks and reader settings layout');

assert.match(html, /if \(!persistLib\(\)\) \{\s*if \(previous\) Object\.assign\(it, previous\)/);
assert.match(html, /S\.scripts = S\.scripts\.filter\(it => it !== copy\)/);
console.log('OK: rollback when script persistence fails');

assert.match(html, /const snapshot = S\.scripts\.map\(it => \(\{ \.\.\.it \}\)\)/);
assert.match(html, /if \(!stored\) \{ S\.scripts = snapshot/);
assert.match(html, /const progress = saved\[bookmarkKey\(\)\]/);
console.log('OK: import rollback and resilient bookmark reads');

assert.match(html, /Number\.isFinite\(p\.fs\)/);
assert.match(html, /Number\.isFinite\(p\.wpm\)/);
assert.match(html, /const MAX_SCRIPT_LENGTH = 200000/);
assert.match(html, /!seenIds\.has\(x\.id\)/);
assert.match(html, /Number\.isFinite\(st\.sessions\)/);
console.log('OK: validation of stored preferences, library and statistics');

assert.match(html, /touchMoved = true/);
assert.match(html, /R\.swallow = Date\.now\(\) \+ 500/);
assert.match(html, /document\.fullscreenElement === el\.reader\) \{ \/\* El navegador gestiona Escape/);
console.log('OK: touch-scroll playback guard and fullscreen Escape handling');

assert.match(html, /else if \(!interactive\) \{ closeReader\(\); e\.preventDefault\(\); \}/);
assert.match(html, /el\.btnStart\.focus\(\{ preventScroll: true \}\)/);
console.log('OK: reader keyboard focus and native Escape behavior');

assert.match(html, /el\.setup\.setAttribute\('inert', ''\)/);
assert.match(html, /el\.setup\.removeAttribute\('inert'\)/);
assert.match(html, /el\.lib\.addEventListener\('keydown', e => \{/);
console.log('OK: library dialog focus trap and inert background');

assert.match(html, /const previousDels = S\.dels/);
assert.match(html, /S\.dels = Cloud\.avail !== false && !S\.dels\.includes\(id\)/);
assert.match(html, /S\.scripts = previous; S\.dels = previousDels/);
assert.match(html, /S\.dels = S\.dels\.filter\(x => x !== id\)/);
console.log('OK: cloud deletion tombstones are persisted atomically');

assert.equal(manifest.theme_color, '#000000');
assert.equal(manifest.background_color, '#000000');
assert.match(html, /<meta name="theme-color" content="#000000">/);
assert.match(html, /STUDIO EDITION/);
assert.match(html, /<header class="studio-hero">/);
assert.match(html, /class="editor-panel" aria-labelledby="editorHeading"/);
assert.match(html, /class="settings-panel" aria-labelledby="settingsHeading"/);
assert.match(html, /class="launch-panel" aria-label="Acciones del guion"/);
assert.match(html, /class="session-panel" aria-label="Estadísticas locales"/);
assert.match(html, /--bg:#000000; --panel:#1d1d1f/);
assert.match(html, /--btn:#0071e3; --btn-h:#1687fa/);
assert.match(html, /<h1>Prompter<\/h1>/);
for (const removedText of ['Tu guion.', 'A tu ritmo.', 'Lectura inmersiva', 'Ajustes precisos', 'Guardado local', 'Todo listo para empezar.']) {
  assert.ok(!html.includes(removedText), 'Unwanted promotional text: ' + removedText);
}
assert.match(html, /@media\(max-width:560px\)/);
assert.match(html, /\.band\{background:rgba\(41,151,255/);
console.log('OK: compact dark interface without marketing content, blue reading guide and PWA theme');

assert.match(html, /id="speedRange"/);
assert.match(html, /id="speedValue"/);
assert.match(html, /min="60" max="300" step="5"/);
assert.match(html, /for="speedRange">Velocidad/);
assert.match(html, /speedRange\.addEventListener/);
assert.match(html, /speedRange\.value = String\(wpm\)/);
assert.match(html, /speedValue\.textContent/);
assert.match(html, /aria-valuetext/);
assert.match(html, /speed-progress/);
assert.ok(!html.includes('id="btnSlow"'));
assert.ok(!html.includes('id="btnFast"'));
console.log('OK: speed slider and cache rotation');
