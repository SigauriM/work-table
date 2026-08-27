import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient(
  process.env.NODE_ENV === "test"
    ? { log: [{ emit: "event", level: "query" }] }
    : undefined,
);