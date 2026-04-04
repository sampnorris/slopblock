import { PrismaClient } from "@prisma/client";

declare global {
  var __slopblockPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__slopblockPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__slopblockPrisma = prisma;
}
