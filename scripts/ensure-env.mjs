// Creates .env from .env.example on first run so `npm run setup` just works.
import { existsSync, copyFileSync } from "node:fs";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("created .env from .env.example");
}
