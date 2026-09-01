const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const raw = fs.readFileSync('index.html', 'utf8');

function extractScriptContent(type) {
  const marker = `<script type="${type}">`;
  const start = raw.indexOf(marker);
  if (start === -1) throw new Error('not found: ' + type);
  const contentStart = start + marker.length;
  const end = raw.indexOf('</script>', contentStart);
  return raw.slice(contentStart, end);
}

const manifest = JSON.parse(extractScriptContent('__bundler/manifest'));
const template = JSON.parse(extractScriptContent('__bundler/template'));
let extResources = null;
try { extResources = JSON.parse(extractScriptContent('__bundler/ext_resources')); } catch (e) {}
let pageOrder = null;
try { pageOrder = JSON.parse(extractScriptContent('__bundler/page_order')); } catch (e) {}

const outDir = 'extracted';
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });

console.log('Manifest entries:', Object.keys(manifest).length);
console.log('Template type:', typeof template);
if (extResources) console.log('ext_resources:', JSON.stringify(extResources).slice(0, 500));
if (pageOrder) console.log('pageOrder:', JSON.stringify(pageOrder));

// Decode each manifest asset
const assetIndex = [];
for (const uuid of Object.keys(manifest)) {
  const entry = manifest[uuid];
  let bytes = Buffer.from(entry.data, 'base64');
  if (entry.compressed) {
    bytes = zlib.gunzipSync(bytes);
  }
  const mime = entry.mime || entry.type || 'application/octet-stream';
  let ext = 'bin';
  if (/javascript/.test(mime)) ext = 'js';
  else if (/css/.test(mime)) ext = 'css';
  else if (/html/.test(mime)) ext = 'html';
  else if (/json/.test(mime)) ext = 'json';
  else if (/svg/.test(mime)) ext = 'svg';
  else if (/png/.test(mime)) ext = 'png';
  else if (/jpeg/.test(mime)) ext = 'jpg';
  else if (/woff2/.test(mime)) ext = 'woff2';
  else if (/woff/.test(mime)) ext = 'woff';
  else if (/font/.test(mime)) ext = 'ttf';
  else if (/^text\//.test(mime)) ext = 'txt';

  const fname = uuid + '.' + ext;
  fs.writeFileSync(path.join(outDir, 'assets', fname), bytes);
  assetIndex.push({ uuid, mime, bytes: bytes.length, file: 'assets/' + fname, filename: entry.filename || null });
}
fs.writeFileSync(path.join(outDir, 'asset_index.json'), JSON.stringify(assetIndex, null, 2));

// Save template - could be a string (HTML)
if (typeof template === 'string') {
  fs.writeFileSync(path.join(outDir, 'template.html'), template);
  console.log('Wrote template.html, length', template.length);
} else {
  fs.writeFileSync(path.join(outDir, 'template.json'), JSON.stringify(template, null, 2));
  console.log('Wrote template.json (non-string template)');
}

if (extResources) fs.writeFileSync(path.join(outDir, 'ext_resources.json'), JSON.stringify(extResources, null, 2));
if (pageOrder) fs.writeFileSync(path.join(outDir, 'page_order.json'), JSON.stringify(pageOrder, null, 2));

console.log('Done. Assets written to', outDir);
