import { defineConfig } from "@prisma/config";
import { config } from "dotenv";

// Load .env.local for Prisma CLI commands (Next.js only loads this at runtime)
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DIRECT_URL"] as string,
  },
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});
