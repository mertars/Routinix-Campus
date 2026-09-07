// Ödeme Takip modülü için GERÇEKÇİ demo verisi üretir — demo/tanıtım
// ortamlarında raporların (yaşlandırma, trend, riskli öğrenci) dolu ve
// ikna edici görünmesi için.
//
//   npx tsx --env-file=.env.local scripts/seed-payment-demo.ts --institution=<id|slug>
//   npx tsx --env-file=.env.local scripts/seed-payment-demo.ts --institution=<id|slug> --reset
//
// --reset: o kuruma ait TÜM ödeme modülü kayıtlarını (taksit, tahsilat,
// gider, hesap, kategori) siler ve sıfırdan üretir. Kurumun kendi
// öğrenci/veli/şube verisine ASLA dokunmaz.
//
// ⚠️ Rastgelelik TOHUMLU (deterministik): aynı kurum için tekrar
// çalıştırıldığında aynı dağılımı üretir — demo tekrar tekrar
// gösterildiğinde rakamların zıplamaması için.
import { prisma } from "../lib/server/prisma";

// Plan GEÇMİŞE ve GELECEĞE yayılır: ilk taksit 8 ay önce, son taksit ~3 ay
// sonra. Böylece hem yaşlandırma kovalarının TAMAMI (0-30 ... 90+) dolar,
// hem de "vadesi gelmemiş alacak" gerçekçi şekilde oluşur.
const MONTHS_BACK = 8;
const INSTALLMENT_COUNT = 12;
// Gider dönemi taksit planıyla HİZALI tutulur — aksi halde trend
// grafiğinde "gelirin hiç olmadığı ama giderin olduğu" gerçekçi olmayan
// aylar görünüyordu.
const EXPENSE_MONTHS = MONTHS_BACK + 1;

// Basit, tohumlanabilir PRNG (mulberry32) — Math.random deterministik değil.
function makeRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const institution = args.find((a) => a.startsWith("--institution="))?.split("=")[1];
  return { institution, reset: args.includes("--reset") };
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

async function main() {
  const { institution: institutionRef, reset } = parseArgs();
  if (!institutionRef) {
    console.error("--institution=<id|slug> zorunludur.");
    process.exitCode = 1;
    return;
  }

  const institution = await prisma.institution.findFirst({
    where: { OR: [{ id: institutionRef }, { slug: institutionRef }] },
    select: { id: true, name: true },
  });
  if (!institution) {
    console.error(`Kurum bulunamadı: ${institutionRef}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Kurum: ${institution.name} (${institution.id})`);

  if (reset) {
    // Sıra ÖNEMLİ — FK kısıtları (Payment -> Installment/Account,
    // Expense -> Category/Account) yüzünden çocuklar önce silinir.
    const p = await prisma.payment.deleteMany({ where: { institutionId: institution.id } });
    const e = await prisma.expense.deleteMany({ where: { institutionId: institution.id } });
    const i = await prisma.installment.deleteMany({ where: { institutionId: institution.id } });
    const a = await prisma.paymentAccount.deleteMany({ where: { institutionId: institution.id } });
    const c = await prisma.expenseCategory.deleteMany({ where: { institutionId: institution.id } });
    console.log(`↺ Sıfırlandı — tahsilat:${p.count} gider:${e.count} taksit:${i.count} hesap:${a.count} kategori:${c.count}`);
  }

  const admin = await prisma.admin.findFirst({ where: { institutionId: institution.id }, select: { id: true } });
  if (!admin) {
    console.error("Bu kurumda yönetici (Admin) yok — kayıtların recordedBy alanı için gerekli.");
    process.exitCode = 1;
    return;
  }

  const students = await prisma.student.findMany({
    where: { institutionId: institution.id, isActive: true },
    select: { id: true, branch: { select: { grade: true } } },
    orderBy: { studentNumber: "asc" },
  });
  if (students.length === 0) {
    console.error("Bu kurumda aktif öğrenci yok.");
    process.exitCode = 1;
    return;
  }
  console.log(`Öğrenci: ${students.length}`);

  // --- Kasa/banka hesapları ---
  let accounts = await prisma.paymentAccount.findMany({ where: { institutionId: institution.id, isActive: true } });
  if (accounts.length === 0) {
    await prisma.paymentAccount.createMany({
      data: [
        { institutionId: institution.id, name: "Nakit Kasa", type: "CASH" },
        { institutionId: institution.id, name: "Ziraat Bankası TL", type: "BANK" },
        { institutionId: institution.id, name: "İş Bankası TL", type: "BANK" },
      ],
    });
    accounts = await prisma.paymentAccount.findMany({ where: { institutionId: institution.id, isActive: true } });
  }
  const cashAccount = accounts.find((a) => a.type === "CASH") ?? accounts[0];
  const bankAccounts = accounts.filter((a) => a.type === "BANK");
  const primaryBank = bankAccounts[0] ?? accounts[0];

  // --- Gider kategorileri ---
  const DEFAULT_CATEGORIES = ["Personel Maaş", "Kira", "Fatura (Elektrik/Su/Doğalgaz)", "Kırtasiye & Malzeme", "Servis & Ulaşım", "Bakım & Onarım", "Tanıtım & Pazarlama", "Diğer"];
  let categories = await prisma.expenseCategory.findMany({ where: { institutionId: institution.id } });
  if (categories.length === 0) {
    await prisma.expenseCategory.createMany({ data: DEFAULT_CATEGORIES.map((name) => ({ institutionId: institution.id, name })) });
    categories = await prisma.expenseCategory.findMany({ where: { institutionId: institution.id } });
  }
  const catByName = new Map(categories.map((c) => [c.name, c.id]));
  const catId = (name: string) => catByName.get(name) ?? categories[0].id;

  // --- Taksit planları + tahsilatlar ---
  const rng = makeRng(1337);
  const installmentRows: { institutionId: string; studentId: string; title: string; amount: number; dueDate: Date; status: "PENDING" | "PARTIALLY_PAID" | "PAID" }[] = [];
  const paymentSeeds: { studentId: string; installmentIndex: number; amount: number; method: "CASH" | "BANK_TRANSFER" | "CREDIT_CARD"; paidAt: Date; accountId: string }[] = [];

  const now = new Date();

  for (const student of students) {
    // Sınıf seviyesine göre yıllık ücret (12. sınıf en pahalı) + öğrenciye
    // özel küçük bir sapma — hepsi aynı rakam olmasın.
    const base = 60_000 + (student.branch.grade - 8) * 6_000;
    const yearly = Math.round((base * (0.9 + rng() * 0.25)) / 500) * 500;
    const count = INSTALLMENT_COUNT;
    const per = Math.round(yearly / count / 10) * 10;

    // Öğrencinin "ödeme karakteri": çoğu düzenli öder, bir kısmı gecikir.
    const roll = rng();
    const profile = roll < 0.72 ? "good" : roll < 0.9 ? "late" : "risky";

    for (let k = 0; k < count; k++) {
      const dueDate = monthsAgo(MONTHS_BACK - k); // k>MONTHS_BACK ise gelecek tarih
      const isPast = dueDate < now;
      const index = installmentRows.length;

      let status: "PENDING" | "PARTIALLY_PAID" | "PAID" = "PENDING";
      if (isPast) {
        const r = rng();
        if (profile === "good") status = r < 0.97 ? "PAID" : "PENDING";
        else if (profile === "late") status = r < 0.82 ? "PAID" : r < 0.93 ? "PARTIALLY_PAID" : "PENDING";
        else status = r < 0.45 ? "PAID" : r < 0.6 ? "PARTIALLY_PAID" : "PENDING";
      }

      installmentRows.push({ institutionId: institution.id, studentId: student.id, title: `2025-2026 Eğitim Ücreti - Taksit ${k + 1}/${count}`, amount: per, dueDate, status });

      if (status === "PAID" || status === "PARTIALLY_PAID") {
        const amount = status === "PAID" ? per : Math.round((per * (0.3 + rng() * 0.4)) / 10) * 10;
        // Ödeme, vadeden birkaç gün önce/sonra yapılır.
        const paidAt = new Date(dueDate);
        paidAt.setDate(paidAt.getDate() + Math.floor(rng() * 12) - 4);
        if (paidAt > now) paidAt.setTime(now.getTime() - 86_400_000);

        const mr = rng();
        const method = mr < 0.45 ? "BANK_TRANSFER" : mr < 0.8 ? "CREDIT_CARD" : "CASH";
        const accountId = method === "CASH" ? cashAccount.id : bankAccounts.length > 1 && rng() < 0.35 ? bankAccounts[1].id : primaryBank.id;

        paymentSeeds.push({ studentId: student.id, installmentIndex: index, amount, method, paidAt, accountId });
      }
    }
  }

  console.log(`Taksit üretiliyor: ${installmentRows.length}`);
  // createManyAndReturn — oluşturulan satırların ID'lerini SIRASIYLA döner.
  // (Önceki sürüm createMany + "geri oku, sıraya göre eşle" yapıyordu; o
  // yaklaşım kurumda ZATEN taksit varsa indeksi kaydırıp tahsilatları
  // YANLIŞ taksite bağlayabilirdi — burada böyle bir risk yok.)
  const createdIds: string[] = [];
  for (let i = 0; i < installmentRows.length; i += 500) {
    const chunk = await prisma.installment.createManyAndReturn({ data: installmentRows.slice(i, i + 500), select: { id: true } });
    createdIds.push(...chunk.map((c) => c.id));
  }
  if (createdIds.length !== installmentRows.length) {
    throw new Error(`Taksit oluşturma tutarsız: beklenen ${installmentRows.length}, dönen ${createdIds.length}`);
  }

  const paymentRows = paymentSeeds.map((seed) => ({
    institutionId: institution.id,
    studentId: seed.studentId,
    installmentId: createdIds[seed.installmentIndex],
    accountId: seed.accountId,
    amount: seed.amount,
    method: seed.method,
    paidAt: seed.paidAt,
    recordedByAdminId: admin.id,
  }));

  console.log(`Tahsilat üretiliyor: ${paymentRows.length}`);
  for (let i = 0; i < paymentRows.length; i += 500) {
    await prisma.payment.createMany({ data: paymentRows.slice(i, i + 500) });
  }

  // --- Giderler ---
  const expenseRows: {
    institutionId: string;
    categoryId: string;
    accountId: string | null;
    title: string;
    vendorName: string | null;
    amount: number;
    status: "PENDING" | "PAID";
    dueDate: Date | null;
    paidAt: Date | null;
    recordedByAdminId: string;
  }[] = [];

  const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const staffCost = Math.round((students.length * 1_600) / 1000) * 1000;

  for (let m = EXPENSE_MONTHS - 1; m >= 0; m--) {
    const d = monthsAgo(m);
    const label = MONTH_NAMES[d.getMonth()];
    const isCurrentMonth = m === 0;

    const monthly: { cat: string; title: string; vendor: string | null; amount: number }[] = [
      { cat: "Personel Maaş", title: `${label} Personel Bordrosu`, vendor: null, amount: Math.round(staffCost * (0.95 + rng() * 0.12)) },
      { cat: "Kira", title: `${label} Bina Kirası`, vendor: null, amount: 45_000 },
      { cat: "Fatura (Elektrik/Su/Doğalgaz)", title: `${label} Elektrik Faturası`, vendor: "BEDAŞ", amount: Math.round((3_000 + rng() * 4_000) / 100) * 100 },
      { cat: "Fatura (Elektrik/Su/Doğalgaz)", title: `${label} Su Faturası`, vendor: "İSKİ", amount: Math.round((800 + rng() * 900) / 50) * 50 },
      { cat: "Servis & Ulaşım", title: `${label} Servis Ödemesi`, vendor: "Öz Ulaşım Turizm", amount: Math.round((12_000 + rng() * 6_000) / 500) * 500 },
    ];
    if (rng() < 0.5) monthly.push({ cat: "Kırtasiye & Malzeme", title: `${label} Kırtasiye Alımı`, vendor: "Deniz Kırtasiye", amount: Math.round((2_000 + rng() * 5_000) / 100) * 100 });
    if (rng() < 0.35) monthly.push({ cat: "Bakım & Onarım", title: `${label} Bakım/Onarım`, vendor: null, amount: Math.round((3_000 + rng() * 9_000) / 500) * 500 });
    if (rng() < 0.3) monthly.push({ cat: "Tanıtım & Pazarlama", title: `${label} Reklam & Tanıtım`, vendor: "Ajans", amount: Math.round((8_000 + rng() * 20_000) / 1000) * 1000 });

    for (const item of monthly) {
      // Bu ayın bazı giderleri henüz ödenmemiş olsun (bekleyen gider
      // listesi ve "vadesi yaklaşan" görünümü boş kalmasın).
      const stillPending = isCurrentMonth && rng() < 0.45;
      const paidAt = new Date(d);
      paidAt.setDate(Math.min(28, 3 + Math.floor(rng() * 20)));

      expenseRows.push({
        institutionId: institution.id,
        categoryId: catId(item.cat),
        accountId: stillPending ? null : rng() < 0.25 ? cashAccount.id : primaryBank.id,
        title: item.title,
        vendorName: item.vendor,
        amount: item.amount,
        status: stillPending ? "PENDING" : "PAID",
        dueDate: paidAt,
        paidAt: stillPending ? null : paidAt,
        recordedByAdminId: admin.id,
      });
    }
  }

  console.log(`Gider üretiliyor: ${expenseRows.length}`);
  for (let i = 0; i < expenseRows.length; i += 500) {
    await prisma.expense.createMany({ data: expenseRows.slice(i, i + 500) });
  }

  // --- Özet ---
  const [instCount, payAgg, expAgg] = await Promise.all([
    prisma.installment.count({ where: { institutionId: institution.id } }),
    prisma.payment.aggregate({ where: { institutionId: institution.id, status: "COMPLETED" }, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({ where: { institutionId: institution.id, status: "PAID" }, _sum: { amount: true }, _count: true }),
  ]);
  console.log("\n✅ Tamam");
  console.log(`   Taksit: ${instCount}`);
  console.log(`   Tahsilat: ${payAgg._count} adet / ${Number(payAgg._sum.amount ?? 0).toLocaleString("tr-TR")} ₺`);
  console.log(`   Ödenmiş gider: ${expAgg._count} adet / ${Number(expAgg._sum.amount ?? 0).toLocaleString("tr-TR")} ₺`);
}

main()
  .catch((err) => {
    console.error("Seed hata ile durdu:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
