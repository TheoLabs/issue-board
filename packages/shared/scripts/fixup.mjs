// dist/cjs 와 dist/esm 각 폴더에 module type 마커를 심어
// Node/번들러가 올바른 포맷으로 로드하도록 한다.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

mkdirSync(resolve(root, 'dist/cjs'), { recursive: true });
mkdirSync(resolve(root, 'dist/esm'), { recursive: true });

writeFileSync(
  resolve(root, 'dist/cjs/package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2),
);
writeFileSync(
  resolve(root, 'dist/esm/package.json'),
  JSON.stringify({ type: 'module' }, null, 2),
);
