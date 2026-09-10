import { prisma } from "@/lib/server/prisma";
import { getStudent360 } from "@/lib/server/student-360/student-360";

async function main() {
  // En çok verisi olan öğrenciyi seç — en kötü hâli ölç.
  const rich = await prisma.student.findMany({
    select: { id: true, firstName: true, lastName: true, institution: { select: { name: true } },
      _count: { select: { attendanceRecords: true, netResults: true, topicMasteryAssessments: true, installments: true } } },
    orderBy: { attendanceRecords: { _count: "desc" } },
    take: 3,
  });

  for (const s of rich) {
    const c = s._count;
    console.log(`\n${s.firstName} ${s.lastName} (${s.institution.name}) — ${c.attendanceRecords} yoklama · ${c.netResults} net · ${c.topicMasteryAssessments} kazanım · ${c.installments} taksit`);
    let best = Infinity;
    let data = null;
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      data = await getStudent360(s.id, { includeFinance: true });
      best = Math.min(best, performance.now() - t);
    }
    console.log(`  ${Math.round(best)} ms (en iyi 3) · ${data?.sections.length} bölüm`);
    for (const sec of data?.sections ?? []) {
      console.log(`    ${sec.label.padEnd(18)} ${String(sec.headline ?? "—").padEnd(12)} ${sec.detail}`);
    }
  }
  await assertFinanceHidden();
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

// Güvenlik kanıtı: öğretmen görünümünde finans bölümü HİÇ üretilmemeli.
export async function assertFinanceHidden() {
  const s = await prisma.student.findFirst({ where: { installments: { some: {} } }, select: { id: true } });
  if (!s) return;
  const teacherView = await getStudent360(s.id, { includeFinance: false });
  const adminView = await getStudent360(s.id, { includeFinance: true });
  console.log("\nGÜVENLİK:");
  console.log("  yönetici bölümleri :", adminView?.sections.map((x) => x.id).join(", "));
  console.log("  öğretmen bölümleri :", teacherView?.sections.map((x) => x.id).join(", "));
  console.log("  öğretmende finans var mı:", teacherView?.sections.some((x) => x.id === "payments") ? "EVET (HATA!)" : "hayır ✓");
  console.log("  financeHidden bayrağı:", teacherView?.financeHidden);
}
