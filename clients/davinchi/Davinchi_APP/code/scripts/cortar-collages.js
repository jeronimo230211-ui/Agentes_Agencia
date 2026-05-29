/**
 * cortar-collages.js
 * Toma collages 1024x1024 (2x2) de assets/collages/ y los corta en
 * 4 vistas de 512x512 en assets/vistas/
 *
 * Nomenclatura del archivo de entrada:
 *   NombreProducto.jpg  →  NombreProducto_vista1.jpg ... _vista4.jpg
 *
 * Posición de los cortes:
 *   vista1 = top-left     vista2 = top-right
 *   vista3 = bottom-left  vista4 = bottom-right
 *
 * Uso:
 *   node scripts/cortar-collages.js           → preview (sin cambios)
 *   node scripts/cortar-collages.js --run     → procesa y guarda en vistas/
 *   node scripts/cortar-collages.js --run --producto "N001"  → solo ese producto
 */

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const args      = process.argv.slice(2);
const DRY_RUN   = !args.includes('--run');
const SOLO      = args.includes('--producto') ? args[args.indexOf('--producto') + 1] : null;

const COLLAGES  = path.join(__dirname, '..', 'assets', 'collages');
const VISTAS    = path.join(__dirname, '..', 'assets', 'vistas');

// Posiciones de los 4 cortes en un collage 2x2 de 1024x1024
const CORTES = [
  { vista: 1, left: 0,   top: 0,   label: 'top-left'     },
  { vista: 2, left: 512, top: 0,   label: 'top-right'    },
  { vista: 3, left: 0,   top: 512, label: 'bottom-left'  },
  { vista: 4, left: 512, top: 512, label: 'bottom-right' },
];

const files = fs.readdirSync(COLLAGES)
  .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
  .filter(f => !SOLO || path.parse(f).name === SOLO);

console.log(`\n✂️  Cortar Collages — ${DRY_RUN ? 'PREVIEW (sin cambios)' : 'PROCESANDO...'}`);
console.log(`   Collages encontrados: ${files.length}${SOLO ? ` (filtro: "${SOLO}")` : ''}\n`);

if (files.length === 0) {
  console.log('No hay collages en assets/collages/');
  if (SOLO) console.log(`Verifica que el archivo se llame exactamente "${SOLO}.jpg"`);
  process.exit(0);
}

(async () => {
  let ok = 0, err = 0;

  for (const file of files) {
    const producto  = path.parse(file).name;
    const inputPath = path.join(COLLAGES, file);
    const inputBuf  = fs.readFileSync(inputPath);

    try {
      const meta = await sharp(inputBuf).metadata();
      const { width, height } = meta;

      if (DRY_RUN) {
        console.log(`  ${file}: ${width}x${height} → generará ${producto}_vista1..4.jpg`);
        ok++;
        continue;
      }

      // Verificar dimensiones mínimas
      if (width < 1024 || height < 1024) {
        console.log(`  ⚠️  ${file}: ${width}x${height} — muy pequeño (mínimo 1024x1024), saltando`);
        err++;
        continue;
      }

      // Cortar las 4 vistas
      for (const corte of CORTES) {
        const outputName = `${producto}_vista${corte.vista}.jpg`;
        const outputPath = path.join(VISTAS, outputName);

        const buf = await sharp(inputBuf)
          .extract({ left: corte.left, top: corte.top, width: 512, height: 512 })
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer();

        fs.writeFileSync(outputPath, buf);
        console.log(`  ✓ ${outputName} (${corte.label})`);
      }

      ok++;
    } catch (e) {
      console.log(`  ✗ ${file}: ERROR — ${e.message}`);
      err++;
    }
  }

  console.log(`\n${DRY_RUN ? 'Preview' : 'Resultado'}: ${ok} collages${err ? `, ${err} errores` : ''}`);
  if (DRY_RUN && ok > 0) {
    console.log('\nPara procesar, ejecuta:');
    console.log('  node scripts/cortar-collages.js --run\n');
  } else if (!DRY_RUN && ok > 0) {
    console.log('\nListo. Avisa para hacer deploy.\n');
  }
})();
