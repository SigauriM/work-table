import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed in production");
    process.exit(1);
  }

  const login = process.env.ADMIN_LOGIN;
  const password = process.env.ADMIN_PASSWORD;
  if (!login || !password) {
    console.error("Missing env: ADMIN_LOGIN and ADMIN_PASSWORD are required");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { login },
    update: { passwordHash, role: Role.ADMIN },
    create: {
      login,
      passwordHash,
      role: Role.ADMIN,
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });