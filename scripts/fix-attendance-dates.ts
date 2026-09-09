// Kaymış yoklama tarihlerini UTC gün anahtarına normalleştirir.
//
// Neden gerekli: yoklama yazma/okuma uçları tarihi `setHours(0,0,0,0)`
// ile YEREL gece yarısına çekiyordu. Sunucu UTC dışında bir saat
// diliminde çalıştığında (yerel geliştirme, Türkiye'de barındırılan bir
// kurulum) tarih bir gün geriye kayıyordu: 2026-09-09 kaydı
// 2026-09-08T21:00Z olarak saklanıyordu.
//
// Uçlar düzeltildi (bkz. lib/attendance/date-key.ts) ama ESKİ KAYITLAR
// kaymış halde duruyor. Düzeltilmiş uçlar UTC gece yarısıyla sorguladığı
// için o kayıtlar artık hiç bulunamaz — yani düzeltme, göç yapılmadan
// eski yoklamaları görünmez kılar.
//
// Kullanım:
//   npx tsx --env-file=.env.local scripts/fix-attendance-dates.ts          (kuru çalışma)
//   npx tsx --env-file=.env.local scripts/fix-attendance-dates.ts --apply  (uygula)
//
// ⚠️ Kayma yönü: kayıt gece yarısından ÖNCEKİ saatlerde (21:00 gibi)
// duruyorsa, temsil ettiği gün BİR SONRAKİ gündür. Saat 12'den küçük
// kaymalar (UTC-x saat dilimleri) için gün AYNI kalır. İkisi de
// destekleniyor; karar kaymanın yönüne göre veriliyor, sabit bir +3
// varsayımıyla değil.
import { prisma } from "../lib/server/prisma";

function normalize(date: Date): Date {
  const hours = date.getUTCHours();
  if (hours === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0) return date;

  // 12:00'dan sonraysa gece yarısına YUVARLA (bir sonraki gün),
  // öncesindeyse aşağı indir (aynı gün). Bu, hem UTC+x hem UTC-x
  // kaymalarını doğru toplar.
  const shifted = new Date(date);
  if (hours >= 12) shifted.setUTCDate(shifted.getUTCDate() + 1);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

async function main() {
  const apply = process.argv.includes("--apply");

  const bozuk = await prisma.attendanceRecord.findMany({
    where: { NOT: { date: { equals: new Date(0) } } },
    select: { id: true, date: true, studentId: true, slot: true },
  });

  const duzeltilecek = bozuk
    .map((r) => ({ ...r, yeni: normalize(r.date) }))
    .filter((r) => r.yeni.getTime() !== r.date.getTime());

  console.log(`toplam kayıt        : ${bozuk.length}`);
  console.log(`düzeltilecek        : ${duzeltilecek.length}`);

  if (duzeltilecek.length === 0) {
    console.log("Yapılacak bir şey yok.");
    await prisma.$disconnect();
    return;
  }

  for (const r of duzeltilecek.slice(0, 5)) {
    console.log(`  ${r.date.toISOString()} → ${r.yeni.toISOString()}`);
  }
  if (duzeltilecek.length > 5) console.log(`  ... ve ${duzeltilecek.length - 5} tane daha`);

  if (!apply) {
    console.log("\nKURU ÇALIŞMA — hiçbir şey değiştirilmedi. Uygulamak için --apply ekleyin.");
    await prisma.$disconnect();
    return;
  }

  // ⚠️ Normalleştirme (studentId, date, slot) benzersizlik kısıtını
  // ihlal edebilir: aynı öğrenci için hem kaymış hem düzgün bir kayıt
  // varsa ikisi aynı anahtara düşer. Böyle bir çakışmada KAYMIŞ olan
  // silinir — düzgün kayıt daha yenidir ve düzeltilmiş uçtan gelmiştir.
  let guncellenen = 0;
  let silinen = 0;
  for (const r of duzeltilecek) {
    const cakisma = await prisma.attendanceRecord.findUnique({
      where: { studentId_date_slot: { studentId: r.studentId, date: r.yeni, slot: r.slot } },
      select: { id: true },
    });
    if (cakisma && cakisma.id !== r.id) {
      await prisma.attendanceRecord.delete({ where: { id: r.id } });
      silinen++;
      continue;
    }
    await prisma.attendanceRecord.update({ where: { id: r.id }, data: { date: r.yeni } });
    guncellenen++;
  }

  console.log(`\nguncellenen: ${guncellenen} · çakışma nedeniyle silinen: ${silinen}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Hata:", error);
  await prisma.$disconnect();
  process.exit(1);
});
