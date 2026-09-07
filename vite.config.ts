import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { buildOfflineCatalog } from './src/platform/offline-catalog-build';

const root = path.dirname(fileURLToPath(import.meta.url));
const runtimeDirectories = ['data', 'icons', 'media'];
const runtimeExtensions = new Set([
  '.js', '.css', '.html', '.json', '.webmanifest', '.png', '.jpg', '.jpeg', '.webp',
  '.gif', '.svg', '.mp3', '.m4a', '.aac', '.ogg', '.wav',
]);
const developmentFiles = new Set(['package.json', 'package-lock.json', 'tsconfig.json']);

function copyLegacyRuntime(): Plugin {
  return {
    name: 'copy-legacy-runtime',
    apply: 'build',
    async closeBundle() {
      const output = path.join(root, 'dist');
      await Promise.all(runtimeDirectories.map((directory) =>
        fs.cp(path.join(root, directory), path.join(output, directory), { recursive: true }),
      ));

      const entries = await fs.readdir(root, { withFileTypes: true });
      await Promise.all(entries
        .filter((entry) => entry.isFile() && runtimeExtensions.has(path.extname(entry.name).toLowerCase()))
        .filter((entry) => entry.name !== 'index.html')
        .filter((entry) => !developmentFiles.has(entry.name))
        .map((entry) => fs.copyFile(path.join(root, entry.name), path.join(output, entry.name))));
      const catalog = await buildOfflineCatalog(output, true);
      await fs.writeFile(path.join(output, 'offline-catalog.json'), JSON.stringify(catalog));
      await fs.writeFile(path.join(output, 'offline-shell.json'), JSON.stringify(catalog.core));
    },
  };
}

function offlineDevelopmentCatalog(): Plugin {
  return { name: 'offline-development-catalog', configureServer(server) {
    server.middlewares.use(async (request,response,next) => {
      const url=request.url?.split('?')[0];
      if(url!=='/offline-catalog.json'&&url!=='/offline-shell.json')return next();
      try{const catalog=await buildOfflineCatalog(root,false);response.setHeader('Content-Type','application/json');response.end(JSON.stringify(url==='/offline-shell.json'?catalog.core:catalog));}
      catch(error){next(error);}
    });
  }};
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [copyLegacyRuntime(), offlineDevelopmentCatalog()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: {
        index: path.join(root, 'index.html'),
        modernization: path.join(root, 'src', 'main.ts'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
