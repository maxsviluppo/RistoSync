import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Questo permette al codice di leggere process.env.API_KEY anche nel browser dopo il build di Vercel
    'process.env': process.env
  }
});