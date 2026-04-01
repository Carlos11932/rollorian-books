import { defineConfig } from "@prisma/config";
import { config } from "dotenv";

// Load .env.local for Prisma CLI commands (Next.js only loads this at runtime)
config({ path: ".env.local" });

const datasourceUrl =
  process.env["DATABASE_URL_UNPOOLED"]
  ?? process.env["DIRECT_URL"]
  ?? process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: datasourceUrl as string,
  },
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});
