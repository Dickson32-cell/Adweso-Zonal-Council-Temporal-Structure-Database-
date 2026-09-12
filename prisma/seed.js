// Seed: serial counters for the 6 electoral areas + first admin user
// Run: npx tsx prisma/seed.ts   (or) node prisma/seed.mjs
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const AREAS = [
  { area: "Adweso Estate",   code: "ADW. E" },
  { area: "Adweso Town",      code: "ADW. T" },
  { area: "Two Streams",      code: "T. S"   },
  { area: "Nyerede North",    code: "NYE. N" },
  { area: "Nyerede South",    code: "NYE. S" },
  { area: "Osabene Mile 50",  code: "OSA. M" },
];

async function main() {
  // Serial counters — one per area, starting at 0 (next = 01)
  for (const { area } of AREAS) {
    await prisma.serialCounter.upsert({
      where: { electoralArea: area },
      update: {},
      create: { electoralArea: area, lastNumber: 0 },
    });
  }
  const counters = await prisma.serialCounter.findMany({ orderBy: { electoralArea: "asc" } });
  console.log("serial_counter rows:", counters.length);
  counters.forEach((c) => console.log("  ", c.electoralArea, "-> next:", c.lastNumber + 1));

  // First admin (Dickson). Password set on first-run prompt OR env.
  const adminPassword = process.env.ADMIN_PASSWORD || "Adweso@2026";
  const hash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.appUser.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: hash,
      fullName: "Abdul Rashid Dickson",
      role: "ADMIN",
      active: true,
    },
  });
  console.log("admin user ready:", admin.username, "(" + admin.role + ")");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());