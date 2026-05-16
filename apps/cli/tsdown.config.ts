import { defineConfig } from "tsdown";

export default defineConfig({
    entry: { fof: "src/index.tsx" },
    format: ["esm"],
    platform: "node",
    target: "node20",
    outDir: "dist",
    clean: true,
    external: ["react-devtools-core"],
    outputOptions: { banner: (chunk) => (chunk.isEntry ? "#!/usr/bin/env node\n" : "") },
});
