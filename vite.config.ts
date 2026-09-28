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

function preserveLegacyRuntimeReferences(): Plugin {
  return {
    name: 'preserve-legacy-runtime-references',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          // These files are copied verbatim below and intentionally retain their
          // stable URLs for the classic runtime and service worker.
          .replace(/<link\b/g, '<link vite-ignore')
          .replace(/<script\b(?![^>]*\btype="module")/g, '<script vite-ignore')
          .replace(/<img\b([^>]*)>/g, (tag) => {
            const critical = /kaishi-journey-hero|class="brand-mark"|id="dashboardAvatar"/.test(tag);
            const loading = critical ? '' : ' loading="lazy"';
            return tag.replace('<img', `<img vite-ignore decoding="async"${loading}`);
          });
      },
    },
  };
}

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
      const catalogAssets = new Map(catalog.assets.map((asset) => [asset.url, asset]));
      const shellBytes = catalog.core.reduce((total, url) => total + (catalogAssets.get(url)?.bytes ?? 0), 0);
      if (shellBytes >= 15 * 1024 * 1024) {
        throw new Error(`Offline application shell is ${(shellBytes / 1024 / 1024).toFixed(1)} MB; keep it below 15 MB.`);
      }
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
  plugins: [preserveLegacyRuntimeReferences(), copyLegacyRuntime(), offlineDevelopmentCatalog()],
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
