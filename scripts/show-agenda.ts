import { prisma } from "@/lib/server/prisma";
import { getAgenda } from "@/lib/server/agenda/agenda";
import { HORIZON_LABEL, HORIZON_ORDER, AREA_LABEL } from "@/lib/agenda-types";

async function main() {
  const list = await prisma.institution.findMany({
    select: { id: true, name: true, _count: { select: { students: true } } },
    orderBy: { students: { _count: "desc" } }, take: 20,
  });
  for (const inst of list) {
    const t = performance.now();
    const agenda = await getAgenda(inst.id);
    console.log(`\n=== ${inst.name} (${inst._count.students} öğrenci) — ${agenda.items.length} madde · ${Math.round(performance.now() - t)} ms`);
    for (const h of HORIZON_ORDER) {
      const g = agenda.items.filter((i) => i.horizon === h);
      if (!g.length) continue;
      console.log(`  ${HORIZON_LABEL[h].toUpperCase()}`);
      for (const i of g) console.log(`    ${i.urgency === "critical" ? "!" : i.urgency === "attention" ? "·" : " "} ${i.title}  [${AREA_LABEL[i.area]}] → ${i.tab ?? i.href}`);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
