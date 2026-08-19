import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7: bağlantı artık şemadaki 'url' yerine bir driver adapter üzerinden
// veriliyor. DATABASE_URL boşsa (örn. henüz Postgres kurulmadıysa) client
// yine de oluşturulur — ilk gerçek sorguda anlamlı bir hata fırlatır.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
