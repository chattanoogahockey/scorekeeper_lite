import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  appIndex: resolve(__dirname, 'index.html'),
  rootDir: __dirname,
  nodeResolve: true,
  open: false,
  watch: true,
  logStartup: true,
};
