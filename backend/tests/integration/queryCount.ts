import { prisma } from "../../src/config/prisma.js";

let count = 0;
let attached = false;

export function attachPrismaQueryCounter() {
  if (attached) return;
  attached = true;
  prisma.$on("query", () => {
    count += 1;
  });
}

export function resetPrismaQueryCount() {
  count = 0;
}

export function getPrismaQueryCount() {
  return count;
}
