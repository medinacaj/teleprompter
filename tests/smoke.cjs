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
