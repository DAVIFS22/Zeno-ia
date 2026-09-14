import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import fs from 'fs';
import { gzipSync, brotliCompressSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom, native compression plugin that compresses JS, CSS, HTML, and JSON directly inside build outDir
function customCompressionPlugin() {
  return {
    name: 'custom-native-compression',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      
      function compressDirectory(dir: string) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            compressDirectory(filePath);
          } else {
            // Only compress code and static text assets larger than 1024 bytes
            if (
              (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.html') || file.endsWith('.json')) &&
              !file.endsWith('.gz') && !file.endsWith('.br') &&
              stat.size > 1024
            ) {
              try {
                const content = fs.readFileSync(filePath);
                
                // Gzip Sync
                const gzipped = gzipSync(content);
                fs.writeFileSync(`${filePath}.gz`, gzipped);
                
                // Brotli Sync
                const brotli = brotliCompressSync(content);
                fs.writeFileSync(`${filePath}.br`, brotli);
              } catch (err) {
                console.warn(`[Compression Warning] Failed to compress ${file}:`, err);
              }
            }
          }
        }
      }
      
      compressDirectory(outDir);
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      customCompressionPlugin()
    ],
    esbuild: {
      drop: ['console', 'debugger'],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      cssCodeSplit: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('pdfjs-dist')) return 'vendor-pdfjs';
              if (id.includes('highlight.js')) return 'vendor-highlight';
              if (id.includes('recharts') || id.includes('d3')) return 'vendor-charts';
              if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
              if (id.includes('motion')) return 'vendor-motion';
              if (id.includes('lucide-react')) return 'vendor-lucide';
              if (
                id.includes('react-markdown') || 
                id.includes('remark') || 
                id.includes('micromark') || 
                id.includes('mdast') || 
                id.includes('unist') || 
                id.includes('vfile') || 
                id.includes('decode-named-character-reference')
              ) {
                return 'vendor-markdown';
              }
              return 'vendor-others';
            }
          },
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
