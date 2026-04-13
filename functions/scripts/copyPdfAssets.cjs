/**
 * Copia el logo NEGRO de marca al directorio compilado (PDF fondo claro).
 * Origen: public/assets/logo_tematica_negra.png — no usar la variante blanca aquí.
 */
const fs = require('fs');
const path = require('path');

const functionsRoot = path.join(__dirname, '..');
const repoRoot = path.join(functionsRoot, '..');
const src = path.join(repoRoot, 'public', 'assets', 'logo_tematica_negra.png');
const dstDir = path.join(functionsRoot, 'lib', 'assets');
const dst = path.join(dstDir, 'superate-ia-logo.png');

if (fs.existsSync(src)) {
  fs.mkdirSync(dstDir, { recursive: true });
  fs.copyFileSync(src, dst);
  // eslint-disable-next-line no-console
  console.log('[copyPdfAssets] Logo copiado para PDF:', dst);
} else {
  // eslint-disable-next-line no-console
  console.warn('[copyPdfAssets] No se encontró el logo en:', src);
}
