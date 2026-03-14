// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

// الحصول على __dirname بطريقة متوافقة مع ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // load env variables for the current mode
  const env = loadEnv(mode, process.cwd(), "");

  // Use VITE_API_URL if provided, otherwise default to localhost:8000
  //const backend = env.VITE_API_URL && env.VITE_API_URL.trim() !== "" ? env.VITE_API_URL : "http://localhost:8000";

  return {
    plugins: [react(), tailwindcss()],

    base: mode === "production" ? "/" : "/",

    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(env.VITE_API_URL ?? ""),
    },

    server: {
      port: 5173,
      host: true,
      open: true,
      proxy: {
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
          secure: false,
          ws: true,
          //rewrite: (p) => p.replace(/^\/api/, "")
        },
      },
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    build: {
      outDir: "dist",
      sourcemap: mode !== "production",
    },
  };
});
