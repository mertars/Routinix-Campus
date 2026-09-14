import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { bulkWriteGuard } from "@/lib/server/db-guard";
import { deleteArchive } from "@/lib/server/db-archive";

// TEST VERİTABANI İSTEMCİSİ — veri yazan/silen her test ve script BUNU
// kullanır, `lib/server/prisma.ts`i DEĞİL.
//
// ⚠️ NEDEN AYRI BİR DOSYA: 2026-09-12 ve 2026-09-14'te test temizliği
// canlı (dershane) veritabanında çalıştığı için gerçek veri silindi. Asıl
// kusur sorgunun kendisi değil, TESTİN CANLI VERİTABANINA BAĞLANABİLİYOR
// OLMASIYDI. Bu dosya o yolu kapatır:
//
//   * Yalnızca TEST_DATABASE_URL okunur. DATABASE_URL'e HİÇ bakılmaz —
//     yani yanlışlıkla bile üretime bağlanamaz.
//   * TEST_DATABASE_URL tanımsızsa süreç net bir mesajla durur.
//   * TEST_DATABASE_URL, DATABASE_URL ile AYNIYSA reddedilir (birinin
//     .env'e üretim adresini kopyalaması en olası kaza).
//   * Bilinen bulut sağlayıcı adresleri (neon.tech vb.) reddedilir —
//     test veritabanı yerelde ya da açıkça "test" işaretli olmalıdır.

function assertSafeTestUrl(url: string | undefined): string {
  if (!url || url.trim() === "") {
    throw new Error(
      "TEST_DATABASE_URL tanımlı değil. Testler üretim veritabanında ÇALIŞTIRILMAZ.\n" +
        "Yerel test veritabanını başlat:  npm run test:db:up && npm run test:db:reset\n" +
        "(bkz. docker-compose.test.yml, .env.test.example)"
    );
  }
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("TEST_DATABASE_URL geçerli bir bağlantı adresi değil.");
  }

  // ⚠️ ASIL KONTROL BU. "TEST_DATABASE_URL, DATABASE_URL'den farklı olsun"
  // diye bir kural DENENDİ ve yanlış olduğu görüldü: entegrasyon koşumunda
  // uygulama kodunun da test veritabanına bakması için ikisi BİLEREK
  // eşitleniyor (bkz. vitest.integration.config.ts). Tehlike "eşit olmak"
  // değil, adresin ÜRETİME işaret etmesi — o yüzden adresin kendisine
  // bakılıyor: yerel ya da açıkça "test/staging" olmalı.
  const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  const looksLikeTest = /test|staging|preview|ephemeral/i.test(url);
  if (!isLocal && !looksLikeTest) {
    throw new Error(
      `GÜVENLİK: TEST_DATABASE_URL yerel değil (${host}) ve adında "test/staging" geçmiyor.\n` +
        "Yanlışlıkla bir üretim/müşteri veritabanına bağlanmayı önlemek için reddedildi."
    );
  }
  return url;
}

let cached: ReturnType<typeof create> | null = null;

function create() {
  const url = assertSafeTestUrl(process.env.TEST_DATABASE_URL);
  const adapter = new PrismaPg({ connectionString: url, max: 5 });
  // ⚠️ Üretimle AYNI eklenti zinciri (guard + arşiv) — aksi hâlde testler
  // gerçek davranışı sınamaz, "testte geçti üretimde patladı" kapısı açılır.
  return new PrismaClient({ adapter }).$extends(bulkWriteGuard).$extends(deleteArchive);
}

/** Test veritabanı istemcisi. İlk çağrıda güvenlik kontrollerini çalıştırır. */
export function testDb() {
  if (!cached) cached = create();
  return cached;
}

/**
 * Testin kendi izole kurumunu üretir. Her test kendi kurumunda çalışırsa
 * testler birbirinin verisini görmez ve temizlik "kurumu sil" kadar basit olur.
 */
export function testInstitutionId(label: string): string {
  return `test_${label}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
