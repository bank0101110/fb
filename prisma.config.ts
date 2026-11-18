import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// The CLI (migrate) needs a direct connection: Supabase "Session" / port 5432.
// The app itself uses DATABASE_URL (pooled, port 6543) — see lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DIRECT_URL") },
});
