import { defineConfig } from "vitest/config";

export default defineConfig({
    test: { projects: ["apps/*", "packages/*"], exclude: [".repos/**", "**/node_modules/**"] },
});
