import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carica le variabili d'ambiente ignorando i prefissi standard se necessario
  // (process as any) serve per evitare errori di tipo in alcuni ambienti Node strict
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 1000, // Aumenta il limite a 1MB per evitare l'avviso
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'], // Separa React in un chunk dedicato
            ui: ['lucide-react'] // Separa le icone se pesanti
          }
        }
      }
    },
  };
});