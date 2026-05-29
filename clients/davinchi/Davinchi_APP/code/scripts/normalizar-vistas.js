/**
 * normalizar-vistas.js
 * Normaliza todas las imágenes de assets/vistas/ a formato cuadrado
 * con fondo crema (#F8F4EE), sin recortar el producto.
 *
 * Uso:
 *   node scripts/normalizar-vistas.js           → preview (solo muestra info)
 *   node scripts/normalizar-vistas.js --run     → procesa y sobreescribe imágenes
 *   node scripts/normalizar-vistas.js --size 800 → tamaño personalizado (default: 900)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--run');
const SIZE = parseInt(args.find(a => a.startsWith('--size'))?.split('=')[1] || args[args.indexOf('--size') + 1]) || 900;

// Fondo crema cálido (igual al de la app)
const BG = { r: 248, g: 244, b: 238, alpha: 1 };

const VISTAS_DIR = path.join(__dirname, '..', 'assets', 'vistas');
const files = fs.readdirSync(VISTAS_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

console.log(`\n📸 Normalizar Vistas — ${DRY_RUN ? 'PREVIEW (sin cambios)' : 'PROCESANDO...'}`);
console.log(`   Tamaño destino: ${SIZE}x${SIZE}px | Fondo: crema #F8F4EE`);
console.log(`   Imágenes encontradas: ${files.length}\n`);

(async () => {
  let ok = 0, err = 0;

  for (const file of files) {
    const inputPath = path.join(VISTAS_DIR, file);
    const outputPath = inputPath; // sobreescribir en sitio

    try {
      const inputBuffer = fs.readFileSync(inputPath);
      const meta = await sharp(inputBuffer).metadata();
      const { width, height } = meta;
      const needsWork = width !== height || width > SIZE;

      if (DRY_RUN) {
        const sizeKB = (fs.statSync(inputPath).size / 1024).toFixed(0);
        const status = needsWork ? '→ se normalizará' : '✓ ya es cuadrada';
        console.log(`  ${file}: ${width}x${height} (${sizeKB}KB) ${status}`);
        ok++;
        continue;
      }

      // Procesar: resize manteniendo aspect ratio + pad con fondo crema
      const processed = await sharp(inputBuffer)
        .resize(SIZE, SIZE, {
          fit: 'contain',        // mantiene proporción sin recortar
          position: 'centre',
          background: BG,
        })
        .flatten({ background: BG }) // aplana transparencia (PNGs)
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();

      fs.writeFileSync(outputPath, processed);
      const newKB = (processed.length / 1024).toFixed(0);
      console.log(`  ✓ ${file}: ${width}x${height} → ${SIZE}x${SIZE} (${newKB}KB)`);
      ok++;

    } catch (e) {
      console.log(`  ✗ ${file}: ERROR — ${e.message}`);
      err++;
    }
  }

  console.log(`\n${DRY_RUN ? 'Preview' : 'Resultado'}: ${ok} imágenes${err ? `, ${err} errores` : ''}`);
  if (DRY_RUN) {
    console.log('\nPara procesar, ejecuta:');
    console.log('  node scripts/normalizar-vistas.js --run\n');
  } else {
    console.log('\nListo. Ahora corre "deploy vistas" para subir a GitHub.\n');
  }
})();
