const fs = require('fs');

const SEED = JSON.parse(fs.readFileSync('extracted/SEED.json', 'utf8'));
const EXCEL_JULIO = JSON.parse(fs.readFileSync('extracted/EXCEL_JULIO.json', 'utf8'));
const INVENTORY_SEED = JSON.parse(fs.readFileSync('extracted/INVENTORY_SEED.json', 'utf8'));

function sqlStr(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlNum(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : 'NULL';
}
function sqlTime(v) {
  if (!v) return 'NULL';
  return "'" + v + "'";
}

// Anchor date for the relative "diasAtras" demo rows in SEED — computed once
// at migration time (today = 2026-09-01) so demo partes get real, stable dates.
const ANCHOR = new Date('2026-09-01T00:00:00Z');
function dateFromDiasAtras(diasAtras) {
  const d = new Date(ANCHOR.getTime() - diasAtras * 86400000);
  return d.toISOString().slice(0, 10);
}

// Replicates isoWeek()/generarNumeroParte() from extracted/template.html so
// migrated rows get the same aa+ww+seq document number the live app would
// have assigned, in the same order the app builds its initial state
// (EXCEL_JULIO in array order, then demo rows in array order).
function isoWeek(fecha) {
  const d = new Date(fecha + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d - firstThursday) / (7 * 86400000));
}
function generarNumeroParte(fecha, partesExistentes) {
  const semana = isoWeek(fecha);
  const anio = new Date(fecha + 'T00:00:00Z').getUTCFullYear();
  const aa = String(anio).slice(-2);
  const ww = String(semana).padStart(2, '0');
  const delMismaSemana = partesExistentes.filter(n => n && n.startsWith(aa + ww));
  return aa + ww + String(delMismaSemana.length + 1).padStart(2, '0');
}

const cols = [
  'numero_parte','fecha','producto','partida','cal','trabajo','tipo_reconfeccion','cliente','material',
  'caja','envase','etiqueta','otros','proveedor','kg_volcados','cajas_confeccionadas',
  'kg_confeccionados','kg_tirados','cat2','duros','verdes','personas_maximo',
  'hora_inicio','hora_fin','descanso_min','observaciones','es_demo'
];

function rowValues(p, fecha, esDemo, numeroParte) {
  return [
    sqlStr(numeroParte), sqlStr(fecha), sqlStr(p.producto), sqlStr(p.partida), sqlStr(p.cal), sqlStr(p.trabajo),
    sqlStr(p.tipoReconfeccion), sqlStr(p.cliente), sqlStr(p.material), sqlStr(p.caja),
    sqlStr(p.envase), sqlStr(p.etiqueta), sqlStr(p.otros), sqlStr(p.proveedor),
    sqlNum(p.kgVolcados), sqlNum(p.cajasConfeccionadas), sqlNum(p.kgConfeccionados),
    sqlNum(p.kgTirados), sqlNum(p.cat2), sqlNum(p.duros), sqlNum(p.verdes),
    sqlNum(p.personasMaximo), sqlTime(p.horaInicio), sqlTime(p.horaFin),
    sqlNum(p.descansoMin), sqlStr(p.observaciones), esDemo ? 'true' : 'false',
  ].join(', ');
}

const lines = [];
lines.push(`INSERT INTO public.partes (${cols.join(', ')}) VALUES`);
const valueRows = [];
const numerosAsignados = [];
for (const p of EXCEL_JULIO) {
  const numeroParte = generarNumeroParte(p.fecha, numerosAsignados);
  numerosAsignados.push(numeroParte);
  valueRows.push('  (' + rowValues(p, p.fecha, false, numeroParte) + ')');
}
for (const p of SEED) {
  const fecha = dateFromDiasAtras(p.diasAtras);
  const numeroParte = generarNumeroParte(fecha, numerosAsignados);
  numerosAsignados.push(numeroParte);
  valueRows.push('  (' + rowValues(p, fecha, true, numeroParte) + ')');
}
lines.push(valueRows.join(',\n') + ';');

fs.writeFileSync('extracted/insert_partes.sql', lines.join('\n') + '\n');

// Inventory catalog: one row per (categoria, valor), preserving source order.
const invLines = [];
invLines.push('INSERT INTO public.inventario_items (categoria, valor, orden) VALUES');
const invRows = [];
for (const categoria of Object.keys(INVENTORY_SEED)) {
  INVENTORY_SEED[categoria].forEach((valor, i) => {
    invRows.push(`  (${sqlStr(categoria)}, ${sqlStr(valor)}, ${i})`);
  });
}
invLines.push(invRows.join(',\n') + ';');
fs.writeFileSync('extracted/insert_inventario.sql', invLines.join('\n') + '\n');

console.log('partes rows:', valueRows.length, '(', EXCEL_JULIO.length, 'reales +', SEED.length, 'demo )');
console.log('inventario rows:', invRows.length);
