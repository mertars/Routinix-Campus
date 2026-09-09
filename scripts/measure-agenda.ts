import { prisma } from "@/lib/server/prisma";
import { AGENDA_SOURCES } from "@/lib/server/agenda/sources";
import { buildAgendaContext, runSource, getAgenda } from "@/lib/server/agenda/agenda";

async function main() {
  const [students, exams, questions, installments, parents] = await Promise.all([
    prisma.student.count(), prisma.exam.count(), prisma.question.count(),
    prisma.installment.count(), prisma.parent.count(),
  ]);
  console.log(`VERİTABANI: ${students} öğrenci · ${exams} sınav · ${questions} soru · ${installments} taksit · ${parents} veli\n`);

  const inst = await prisma.institution.findFirst({
    select: { id: true, name: true, _count: { select: { students: true } } },
    orderBy: { students: { _count: "desc" } },
  });
  if (!inst) return;
  console.log(`=== ${inst.name} (${inst._count.students} öğrenci) — her kaynak 3 kez, EN İYİSİ alınır ===`);
  const ctx = buildAgendaContext(inst.id);

  const rows: { key: string; ms: number }[] = [];
  for (const source of AGENDA_SOURCES) {
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await runSource(source, ctx);
      best = Math.min(best, performance.now() - t0);
    }
    rows.push({ key: source.key, ms: Math.round(best) });
  }
  rows.sort((a, b) => b.ms - a.ms);
  for (const r of rows) console.log(`  ${String(r.ms).padStart(4)} ms  ${r.key}`);

  let bestAll = Infinity;
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    await getAgenda(inst.id);
    bestAll = Math.min(bestAll, performance.now() - t);
  }
  console.log(`\n  ${Math.round(bestAll)} ms  PARALEL uçtan uca (en iyi 3)`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
