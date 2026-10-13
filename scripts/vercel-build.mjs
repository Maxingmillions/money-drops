// Build step for Vercel (and similar hosts): sync the schema to the
// database, optionally seed the demo hunt, then build Next.js.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

run("npx prisma generate");
run("npx prisma db push --skip-generate --accept-data-loss");
if (process.env.SEED_DEMO === "true") run("npx tsx prisma/seed.ts");
run("npx next build");
