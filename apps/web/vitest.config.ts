import { defineConfig } from "vitest/config";
import { compressedNotices } from "./compressed-notices.js";

export default defineConfig({ plugins: [compressedNotices()] });
