import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const superadminEmail = process.env["SUPERADMIN_EMAIL"];
if (!superadminEmail) {
  throw new Error("SUPERADMIN_EMAIL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Setting SUPERADMIN role for: ${superadminEmail}`);

  const user = await prisma.user.update({
    where: { email: superadminEmail },
    data: { role: "SUPERADMIN" },
  });

  console.log(`Done. User "${user.name}" (${user.email}) is now SUPERADMIN.`);
}

main()
  .catch((error) => {
    console.error("Failed to set superadmin:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
