// MapLibre loads its web worker from a URL next to the library bundle, which
// breaks under bundlers. We serve the worker from /public instead and point
// MapLibre at it with setWorkerUrl() (see src/components/DropMap.tsx).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve("maplibre-gl/package.json")), "dist", "maplibre-gl-worker.mjs");
mkdirSync("public", { recursive: true });
copyFileSync(src, join("public", "maplibre-gl-worker.mjs"));
console.log("copied maplibre-gl-worker.mjs to public/");
