import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { id: "default-organization" },
    update: {},
    create: {
      id: "default-organization",
      name: "Default Organization",
      slug: "default-org",
    },
  });

  console.log("✅ Created organization:", org.name);
  console.log("🎉 Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
