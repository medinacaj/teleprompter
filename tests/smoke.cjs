const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/app/index.html', 'utf8');
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

const manifest = JSON.parse(fs.readFileSync('public/app/manifest.webmanifest', 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.icons.length);
for (const icon of manifest.icons) assert.ok(fs.existsSync('public' + icon.src));
const worker = fs.readFileSync('public/app/sw.js', 'utf8');
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

assert.match(worker, /prompter-static-v12/);
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

assert.equal(manifest.theme_color, '#0b0a12');
assert.equal(manifest.background_color, '#0b0a12');
assert.match(html, /<meta name="theme-color" content="#0b0a12">/);
assert.match(html, /<main id="setup" class="wrap">/);
assert.match(html, /<header class="setup-header">/);
assert.match(html, /<h1>Lector de guiones<\/h1>/);
assert.match(html, /class="setup-editor" aria-label="Editor de guion"/);
assert.match(html, /class="setup-settings" aria-label="Ajustes de lectura"/);
assert.match(html, /class="card"/);
assert.match(html, /class="actions"/);
assert.match(html, /class="setup-stats"/);
assert.match(html, /#setup\.wrap\{display:block;max-width:748px/);
assert.match(html, /--amber:#fbbf24;--btn:#f59e0b/);
assert.match(html, /#setup \.actions \.btn\.primary/);
assert.match(html, /@media\(max-width:560px\)/);
assert.match(html, /\.band\{background:rgba\(41,151,255/);
for (const removedText of ['Tu guion.', 'A tu ritmo.', 'Lectura inmersiva', 'Ajustes precisos', 'Guardado local', 'Todo listo para empezar.']) {
  assert.ok(!html.includes(removedText), 'Unwanted promotional text: ' + removedText);
}
for (const obsolete of ['class="studio-hero"', 'class="editor-panel"', 'class="settings-panel"', 'class="launch-panel"']) {
  assert.ok(!html.includes(obsolete), 'Old oversized component: ' + obsolete);
}
console.log('OK: compact single-column setup, subtle amber accent and preserved reader design');

assert.match(html, /id="speedRange" class="speed-range"/);
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

assert.ok(!html.includes('Pega o escribe tu guion para empezar.'), 'Do not repeat textarea placeholder underneath the editor');
assert.match(html, /#setup \.setup-editor \.meta:empty\{display:none\}/);
assert.match(html, /: '';/);
console.log('OK: empty editor shows no redundant message; entered text retains word-count metadata');

assert.match(html, /<img class="brand-icon" src="\/app\/icon\.svg" alt=""/);
assert.match(html, /class="brand-content"/);
assert.match(html, /<details class="help-disclosure">/);
assert.match(html, /<summary aria-label="Ayuda y atajos" title="Ayuda y atajos">/);
assert.match(html, /<symbol id="i-help"/);
const startHeader = html.indexOf('<header class="setup-header">');
const endHeader = html.indexOf('</header>', startHeader);
assert.ok(startHeader >= 0 && endHeader > startHeader, 'Header markup missing');
assert.ok(html.slice(startHeader, endHeader).includes('class="help-disclosure"'), 'Help must be in the header');
assert.match(html, /#setup \.help-disclosure \.tips\{[\s\S]*?position:absolute/);
assert.match(html, /helpPanel\.open && !helpPanel\.contains\(e\.target\)/);
assert.match(html, /helpPanel\.querySelector\('summary'\)\.focus\(\)/);
assert.ok(html.indexOf('class="help-disclosure"', html.indexOf('<div class="actions">')) === -1, 'Do not add another help row below actions');
assert.match(html, /class="tips" id="tips"/);
assert.match(html, /#setup \.setup-settings \.card::before/);
assert.match(html, /#setup \.actions \.btn\.primary\{box-shadow:/);
console.log('OK: refined header identity, compact accent and accessible optional shortcuts');

assert.ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html), 'Do not request third-party fonts');
assert.match(html, /<p class="r-msg" id="rMsg" role="status"><\/p>/);
assert.match(html, /const box = S\.view === 'reader' \? el\.rMsg : el\.flash/);
assert.match(html, /const validSavedAt = v =>/);
assert.match(html, /savedAt: validSavedAt\(x\.savedAt\)/);
assert.match(html, /String\(x\.name \|\| 'Guion'\)\.slice\(0, 80\)/);
assert.match(html, /No se pudo guardar el borrador/);
assert.ok(!html.includes('S.text.length > 200000'), 'Use MAX_SCRIPT_LENGTH');
assert.match(fs.readFileSync('public/sitemap.xml', 'utf8'), /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
console.log('OK: visible reader notices, no third-party fonts, bounded imports and draft warnings');

assert.match(html, /const hasUnsavedText = \(\) =>/);
assert.match(html, /El editor tiene cambios sin guardar/);
assert.match(html, /existing\.id !== S\.loadedId/);
assert.match(html, /function uniqueName\(base\)/);
assert.match(html, /id: S\.loadedId \}/);
assert.match(html, /isJson = ext === 'json'/);
console.log('OK: unsaved-editor guard, title collision prompt and .txt imports starting with [cues]');

const landing = fs.readFileSync('public/index.html', 'utf8');
for (const page of ['index.html', 'login/index.html', 'cuenta/index.html', 'legal/index.html']) {
  const src = fs.readFileSync('public/' + page, 'utf8');
  assert.match(src, /^<!doctype html>/i, page);
  assert.match(src, /href="\/assets\/site\.css"/, page);
  for (const [, attrs, body] of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/application\/ld\+json/i.test(attrs)) JSON.parse(body);
    else if (!/\bsrc\s*=/.test(attrs)) new vm.Script(body, { filename: page });
  }
  assert.ok(!/https?:\/\/(?!schema\.org)[^"' ]+\.(js|css)\b/.test(src), page + ' must not load third-party code');
}
new vm.Script(fs.readFileSync('public/assets/site.js', 'utf8'), { filename: 'site.js' });
assert.match(landing, /US\$1/);
assert.match(html, /navigator\.serviceWorker\.register\('\/app\/sw\.js', \{ scope: '\/app\/' \}\)/);
assert.match(html, /async function verifyAccess\(\)/);
assert.match(html, /OFFLINE_GRACE = 72 \* 3600000/);
assert.match(html, /id="paywall" hidden role="dialog"/);
assert.match(html, /noindex, nofollow/);
assert.match(worker, /!response\.redirected/);
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const allHeaders = vercel.headers.flatMap(h => h.headers.map(x => x.key));
for (const h of ['Content-Security-Policy', 'X-Frame-Options', 'Strict-Transport-Security', 'X-Content-Type-Options']) assert.ok(allHeaders.includes(h), 'Missing header ' + h);
assert.match(fs.readFileSync('middleware.js', 'utf8'), /matcher: \['\/app', '\/app\/:path\*'\]/);
assert.match(fs.readFileSync('public/robots.txt', 'utf8'), /Disallow: \/app\//);
console.log('OK: landing, account pages, subscription guard, gated app routes and security headers');

assert.equal(vercel.outputDirectory, 'public', 'Only public/ is served as static files');
for (const priv of ['lib', 'api', 'tests', 'supabase', 'docs', '.env.example']) assert.ok(!fs.existsSync('public/' + priv), priv + ' must not be public');
console.log('OK: only public/ is deployed as static content');
