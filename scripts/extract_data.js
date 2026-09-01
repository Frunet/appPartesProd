const fs = require('fs');

const tpl = fs.readFileSync('extracted/template.html', 'utf8');

function extractConst(name, endMarker) {
  const marker = `const ${name} = `;
  const start = tpl.indexOf(marker);
  if (start === -1) throw new Error('not found: ' + name);
  const exprStart = start + marker.length;
  const end = tpl.indexOf(endMarker, exprStart);
  const exprText = tpl.slice(exprStart, end + 1); // include closing ] or }
  // eslint-disable-next-line no-new-func
  return new Function('return (' + exprText + ')')();
}

const SEED = extractConst('SEED', '];');
const EXCEL_JULIO = extractConst('EXCEL_JULIO', '];');
const INVENTORY_SEED = extractConst('INVENTORY_SEED', '};');

fs.writeFileSync('extracted/SEED.json', JSON.stringify(SEED, null, 2));
fs.writeFileSync('extracted/EXCEL_JULIO.json', JSON.stringify(EXCEL_JULIO, null, 2));
fs.writeFileSync('extracted/INVENTORY_SEED.json', JSON.stringify(INVENTORY_SEED, null, 2));

console.log('SEED rows:', SEED.length);
console.log('EXCEL_JULIO rows:', EXCEL_JULIO.length);
console.log('INVENTORY_SEED categories:', Object.keys(INVENTORY_SEED).map(k => k + '=' + INVENTORY_SEED[k].length).join(', '));
