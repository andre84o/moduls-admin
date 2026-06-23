import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";

// Seeds one demo business with a SUPER_ADMIN member, properties, customers,
// services and bookings — all scoped by businessId (shared multi-tenant DB).
// NOTE: the User.supabaseId below is a placeholder. Real users are created via
// Supabase Auth; mirror their auth id into supabaseId on first login.

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const business = await prisma.business.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Estates",
      slug: "demo",
      email: "owner@demo.local",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "owner@demo.local" },
    update: {},
    create: {
      // Replace with the real Supabase Auth user id in production.
      supabaseId: "seed-super-admin",
      email: "owner@demo.local",
      firstName: "Demo",
      lastName: "Owner",
    },
  });

  await prisma.businessMember.upsert({
    where: { businessId_userId: { businessId: business.id, userId: user.id } },
    update: { role: "SUPER_ADMIN" },
    create: { businessId: business.id, userId: user.id, role: "SUPER_ADMIN" },
  });

  await prisma.project.createMany({
    data: [
      { businessId: business.id, name: "Rentals", type: "RENTAL" },
      { businessId: business.id, name: "CRM", type: "CRM" },
      { businessId: business.id, name: "Booking", type: "BOOKING" },
    ],
    skipDuplicates: true,
  });

  const casa = await prisma.property.create({
    data: {
      businessId: business.id,
      title: "Casa del Sol",
      location: "Marbella, Spain",
      price: 320,
      bedrooms: 3,
      status: "PUBLISHED",
    },
  });

  await prisma.property.create({
    data: {
      businessId: business.id,
      title: "Villa Azul",
      location: "Nerja, Spain",
      price: 410,
      bedrooms: 4,
      status: "PUBLISHED",
    },
  });

  const anna = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: "Anna Lind",
      email: "anna@example.com",
      stage: "CUSTOMER",
    },
  });

  await prisma.customer.createMany({
    data: [
      { businessId: business.id, name: "Marco Rossi", email: "marco@example.com", stage: "CONTACTED" },
      { businessId: business.id, name: "Sofia Berg", email: "sofia@example.com", stage: "LEAD" },
    ],
  });

  await prisma.service.createMany({
    data: [
      { businessId: business.id, name: "Cleaning", durationMin: 120, price: 60 },
      { businessId: business.id, name: "Airport transfer", durationMin: 90, price: 80 },
    ],
  });

  const start = new Date();
  start.setDate(start.getDate() + 3);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  await prisma.booking.create({
    data: {
      businessId: business.id,
      propertyId: casa.id,
      customerId: anna.id,
      guestName: "Anna Lind",
      guestEmail: "anna@example.com",
      startAt: start,
      endAt: end,
      status: "CONFIRMED",
    },
  });

  console.log("✓ Seed complete");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
