import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// DATABASE_URL = Supabase "Transaction" pooler (port 6543). Reused across hot reloads / lambda invocations.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function make() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? make();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
