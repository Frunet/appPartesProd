const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const outDir = 'extracted';
const raw = fs.readFileSync('index.html', 'utf8');

function findScriptSpan(type) {
  const marker = `<script type="${type}">`;
  const start = raw.indexOf(marker);
  if (start === -1) throw new Error('not found: ' + type);
  const contentStart = start + marker.length;
  const end = raw.indexOf('</script>', contentStart);
  return { contentStart, end };
}

// Rebuild manifest from original index.html manifest entries, keeping assets
// unchanged unless the corresponding asset file on disk differs.
const manifestSpan = findScriptSpan('__bundler/manifest');
const origManifest = JSON.parse(raw.slice(manifestSpan.contentStart, manifestSpan.end));
const assetIndex = JSON.parse(fs.readFileSync(path.join(outDir, 'asset_index.json'), 'utf8'));

const newTemplate = fs.readFileSync(path.join(outDir, 'template.html'), 'utf8');

const newManifest = {};
for (const uuid of Object.keys(origManifest)) {
  // Drop assets no longer referenced by the (possibly edited) template —
  // e.g. a script/font that got removed — instead of carrying dead bytes.
  if (!newTemplate.includes(uuid)) continue;

  const entry = origManifest[uuid];
  const idxEntry = assetIndex.find(a => a.uuid === uuid);
  const assetPath = path.join(outDir, idxEntry.file);
  const currentBytes = fs.readFileSync(assetPath);

  // Recompute base64 (+gzip if original was compressed) from the file on disk,
  // so editing an asset file (e.g. a font swap) is picked up automatically.
  let dataBytes = currentBytes;
  if (entry.compressed) {
    dataBytes = zlib.gzipSync(currentBytes);
  }
  newManifest[uuid] = Object.assign({}, entry, { data: dataBytes.toString('base64') });
}

// The original bundler escapes every "</" inside the template's JSON string
// (as a / unicode escape) so a literal closing tag (</div>, </script>,
// ...) embedded in the template text can never prematurely terminate the
// outer <script> element when the browser's HTML parser scans for raw
// "</script".
function jsonStringifyEscaped(str) {
  return JSON.stringify(str).replace(/<\//g, '<\\u002F');
}

function replaceSpan(str, type, newInner) {
  const marker = `<script type="${type}">`;
  const start = str.indexOf(marker);
  const contentStart = start + marker.length;
  const end = str.indexOf('</script>', contentStart);
  return str.slice(0, contentStart) + newInner + str.slice(end);
}

let out = raw;
out = replaceSpan(out, '__bundler/manifest', JSON.stringify(newManifest));
out = replaceSpan(out, '__bundler/template', jsonStringifyEscaped(newTemplate));

fs.writeFileSync('index.html', out);
console.log('Rebuilt index.html from extracted/template.html (' + newTemplate.length + ' chars) and ' + Object.keys(newManifest).length + ' assets.');
