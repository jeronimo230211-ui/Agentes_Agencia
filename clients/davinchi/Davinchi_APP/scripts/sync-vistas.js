/**
 * sync-vistas.js — Sincroniza code/assets/vistas/ → repo/assets/vistas/
 * Copia archivos nuevos/modificados y BORRA los que ya no existen en origen.
 */
const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const SRC  = path.join(BASE, 'code', 'assets', 'vistas');
const DEST = path.join(BASE, 'repo', 'assets', 'vistas');

const srcFiles  = new Set(fs.readdirSync(SRC));
const destFiles = new Set(fs.readdirSync(DEST));

let copied = 0, deleted = 0;

// Copiar nuevos / modificados
for (const f of srcFiles) {
  const s = path.join(SRC, f);
  const d = path.join(DEST, f);
  const srcMtime  = fs.statSync(s).mtimeMs;
  const destMtime = destFiles.has(f) ? fs.statSync(d).mtimeMs : 0;
  if (srcMtime > destMtime) {
    fs.copyFileSync(s, d);
    copied++;
  }
}

// Borrar los que ya no están en origen
for (const f of destFiles) {
  if (!srcFiles.has(f)) {
    fs.unlinkSync(path.join(DEST, f));
    console.log(`  ✗ eliminado: ${f}`);
    deleted++;
  }
}

console.log(`  Sync listo: ${copied} copiados, ${deleted} eliminados.`);
