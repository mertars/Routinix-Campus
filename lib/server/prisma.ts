import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@/lib/server/env";

// Prisma 7: bağlantı artık şemadaki 'url' yerine bir driver adapter üzerinden
// veriliyor. DATABASE_URL eksikse getEnv() boot anında zaten fail-fast
// tetiklemiş olur (bkz. instrumentation.ts) — burası hiç ulaşılmaz kalır.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: getEnv().DATABASE_URL,
    // node-postgres varsayılanları (max: 10, connectionTimeoutMillis: 0 —
    // yani SINIRSIZ bekleme) bilinçli olarak ezilir:
    //   * max: TEK Node sürecinde (bkz. globalForPrisma singleton'ı) tüm
    //     eşzamanlı isteklerin paylaştığı havuzun üst sınırı. Neon'un kendi
    //     compute planının bağlantı limitini aşmamak İÇİN üst sınır —
    //     birden fazla sunucu instance'ı çalıştırırsanız (yatay ölçek) bu
    //     sayı instance başına çarpılır, plana göre yeniden ayarlanmalı.
    //   * idleTimeoutMillis: boşta bekleyen bağlantıları makul bir sürede
    //     geri verir — Neon zaten kendi tarafında uzun süre boşta kalan
    //     bağlantıları/compute'u askıya alabilir, burada sonsuza kadar
    //     tutmanın anlamı yok.
    //   * connectionTimeoutMillis: Neon'un otomatik askıdan uyanması birkaç
    //     saniye sürebilir (bu oturumda gözlemlenen gerçek bir P1001
    //     gecikmesiydi) — sınırsız beklemek yerine makul ama SINIRLI bir
    //     süre sonra net bir hatayla başarısız olmak, yığılan (cascading)
    //     bekleyen isteklerin bir kesintiyi büyütmesini önler.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
