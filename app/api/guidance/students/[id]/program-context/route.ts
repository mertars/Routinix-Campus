import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { expandSubject, isAggregateSubject, levelOfGrade, planningSubjects } from "@/lib/subjects";

export const dynamic = "force-dynamic";

// PROGRAM BAĞLAMI — "bu öğrenciye program yazarken neye bakmam gerekir?"
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15): "program yazmada çok profesyonel bir iş
// bekliyorum, ekrana girdiğinde Öğrenci 360 verileri". Program yazmak kör
// bir iş olmamalı: rehber öğretmenin ekranında öğrencinin EN ZAYIF
// KAZANIMLARI ve ders bazlı netleri dururken program yazması, o kazanımları
// doğrudan plana atabilmesi gerekir. Aksi halde "Pazartesi Matematik"
// yazmaktan öteye gitmez.
//
// Öğrenci 360'tan AYRI bir uç çünkü ihtiyaç farklı: burada finans, ödev,
// veli gibi bölümler gereksiz; gereken şey KAZANIM SEVİYESİNDE zayıflık
// listesi — 360 onu bu granülerlikte vermiyor.

/** subtopicId → okunabilir ad (bkz. teacher-student-card.ts'teki aynı desen). */
function subtopicNameMap(subject: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const topic of CURRICULUM_TREE[subject] ?? []) {
    for (const sub of topic.subtopics ?? []) map.set(sub.id, sub.name);
  }
  return map;
}

async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "guidance", "principal");

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        institutionId: true,
        branchId: true,
        branch: { select: { name: true, grade: true, track: true } },
      },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    // Dört sorgu birbirinden bağımsız — tek Promise.all.
    const [mastery, nets, attendance, taught] = await Promise.all([
      prisma.topicMasteryAssessment.findMany({
        where: { studentId: student.id },
        select: { subject: true, subtopicId: true, masteryScore: true, assessedAt: true },
      }),
      prisma.examNetResult.findMany({
        where: { studentId: student.id },
        select: { subject: true, net: true, exam: { select: { name: true, examDate: true } } },
        orderBy: { id: "desc" },
        take: 120,
      }),
      prisma.attendanceRecord.groupBy({ by: ["subject"], where: { studentId: student.id, status: "ABSENT" }, _count: { _all: true } }),
      // ⚠️ Öğrencinin GERÇEKTEN gördüğü dersler ders programından gelir.
      // Ders listesi deneme sonuçlarından TÜRETİLMEZ (bkz. lib/subjects.ts
      // üstündeki ölçüm: ExamNetResult "Fen Bilimleri", "Sosyal" gibi
      // KİTAPÇIK BÖLÜMÜ adları taşıyor ve plana taşınınca "fenden 100 soru
      // çöz" gibi işlevsiz bir hedef üretiyordu).
      student.branchId
        ? prisma.lessonSlot.findMany({
            where: { branchId: student.branchId },
            select: { subject: true },
            distinct: ["subject"],
          })
        : Promise.resolve([] as { subject: string }[]),
    ]);

    // Ders bazlı net ortalaması — "hangi derste geride" sorusunun cevabı.
    const bySubject = new Map<string, { total: number; count: number; last: number | null }>();
    for (const n of nets) {
      const cur = bySubject.get(n.subject) ?? { total: 0, count: 0, last: null };
      cur.total += n.net;
      cur.count += 1;
      if (cur.last === null) cur.last = n.net; // orderBy desc — ilk gördüğümüz en yenisi
      bySubject.set(n.subject, cur);
    }

    const level = levelOfGrade(student.branch?.grade ?? null);
    const absentBySubject = new Map<string, number>();
    for (const a of attendance) absentBySubject.set(a.subject ?? "—", a._count._all);

    // ⚠️ EN ZAYIF ÖNCE — programa atılacak kazanım sırası budur
    // (teacher-student-card.ts'teki aynı karar).
    const nameCache = new Map<string, Map<string, string>>();
    const weakTopics = mastery
      .map((m) => {
        if (!nameCache.has(m.subject)) nameCache.set(m.subject, subtopicNameMap(m.subject));
        return {
          subject: m.subject,
          subtopicId: m.subtopicId,
          name: nameCache.get(m.subject)!.get(m.subtopicId) ?? m.subtopicId,
          score: m.masteryScore,
          assessedAt: m.assessedAt.toISOString(),
        };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 25);

    return NextResponse.json({
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        branchName: student.branch?.name ?? null,
        grade: student.branch?.grade ?? null,
        track: student.branch?.track ?? null,
      },
      subjects: [...bySubject.entries()]
        .map(([subject, v]) => ({
          subject,
          avgNet: Math.round((v.total / v.count) * 100) / 100,
          lastNet: v.last,
          examCount: v.count,
          absentCount: absentBySubject.get(subject) ?? 0,
          // Kitapçık bölümü mü (ör. TYT "Fen Bilimleri")? Arayüz bunu
          // net listesinde AÇIKLAR ama ders seçeneği olarak SUNMAZ.
          isAggregate: isAggregateSubject(subject, level),
          coversSubjects: isAggregateSubject(subject, level) ? expandSubject(subject, level) : [],
        }))
        .sort((a, b) => a.avgNet - b.avgNet),
      weakTopics,
      // ⚠️ Programda kullanılabilecek dersler TEK KAYNAKTAN (lib/subjects.ts):
      // kademenin gerçek dersleri + öğrencinin ders programındaki dersler.
      // Deneme sonuçlarındaki kitapçık bölümleri buraya GİRMEZ.
      subjectOptions: planningSubjects(
        student.branch?.grade ?? null,
        taught.map((t) => t.subject)
      ),
      level,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_program_context_failed", error);
  }
}

export const GET = withApiLogging("GET /api/guidance/students/[id]/program-context", handleGet);
