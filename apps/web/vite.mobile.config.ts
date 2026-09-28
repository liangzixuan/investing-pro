import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const mobileRoot = fileURLToPath(new URL("./mobile", import.meta.url));

function clientBoundary(): Plugin {
  return {
    name: "mobile-client-boundary",
    moduleParsed({ id }) {
      const normalized = id.replaceAll("\\", "/");
      if (
        normalized.startsWith("node:") ||
        normalized.includes("/node_modules/next/") ||
        /\/(?:apps\/api|packages\/(?:db|local-research-vault))\//u.test(
          normalized,
        )
      ) {
        this.error("A server-only module entered the mobile client graph.");
      }
    },
  };
}

export default defineConfig({
  root: mobileRoot,
  base: "./",
  publicDir: false,
  envDir: false,
  define: {
    "process.env.NEXT_PUBLIC_API_BASE_URL": JSON.stringify(""),
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [clientBoundary()],
  build: {
    outDir: fileURLToPath(new URL("./dist/mobile", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    rolldownOptions: {
      input: fileURLToPath(new URL("./mobile/index.html", import.meta.url)),
    },
  },
});
