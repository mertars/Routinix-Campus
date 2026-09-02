import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { pickRandomTestFromPool } from "@/lib/server/xray/practice-pool";
import { resolveTargetStudentIds, type AssignmentTarget } from "@/lib/server/xray/assignment-target";
import { resolveUnitLabel, resolveUnitSubtopicIds } from "@/lib/server/xray/unit-label";
import { requireSession, requireRole, requireInstitution, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-assignments?studentId=X — bir öğrencinin tüm
// Test 1 atamaları (geçmiş + bekleyen). Öğrenci SADECE kendi atamalarını
// görebilir (bkz. /student panelindeki bekleyen testler bildirimi);
// yönetici atama geçmişini görüntülemek için kullanır. Bkz.
// comprehension-assignments'taki BİREBİR AYNI desen (Faz H — Test 1 artık
// Test 2 gibi yönetici atamalı).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, studentId);
    else requireRole(session, "principal");

    const variant = request.nextUrl.searchParams.get("variant");
    const assignments = await prisma.xrayPracticeAttempt.findMany({
      where: variant ? { studentId, variant } : { studentId },
      orderBy: { assignedAt: "desc" },
      select: { id: true, subject: true, subtopicId: true, variant: true, status: true, assignedAt: true, completedAt: true },
    });

    const withNames = assignments.map((a) => ({ ...a, subtopicName: resolveUnitLabel(a.subject, a.subtopicId, a.variant) }));

    return NextResponse.json({ assignments: withNames });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_assignments_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/xray/practice-assignments — { subject, subtopicId, target } —
// yöneticinin Test 1 (Konu Bilgisi) ataması. Faz L: target
// {type:"student"|"branch"|"grade"} olabilir — bir şubenin/sınıf
// seviyesinin TAMAMINA tek istekle atanabilir (bkz. resolveTargetStudentIds).
// Havuzdan RASTGELE seçim HER ÖĞRENCİ İÇİN AYRI AYRI ve ATAMA ANINDA
// yapılır (bkz. lib/server/xray/practice-pool.ts) ve
// XrayPracticeAttemptQuestion'a sabitlenir — öğrenci ne zaman açarsa açsın
// AYNI soruları görür, ama AYNI toplu atamadaki İKİ öğrenci FARKLI
// sorularla karşılaşabilir (kasıtlı — sınıf içi kopya riskini azaltır).
// Aynı öğrenci aynı konudan TEKRAR atanabilir (her seferinde YENİ bir
// rastgele seçimle, @@unique yok).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { subject, subtopicId, target, variant } = body as { subject?: string; subtopicId?: string; target?: AssignmentTarget; variant?: string };
    if (!subject?.trim() || !subtopicId?.trim() || !target) {
      return NextResponse.json({ error: "subject, subtopicId ve target zorunludur." }, { status: 400 });
    }
    const resolvedVariant = variant?.trim() || "genel";

    // Faz Z16 — "genel" için gelen subtopicId aslında bir
    // TEMA (topicId) id'sidir (bkz. practice-tests route.ts ve
    // lib/server/xray/unit-label.ts) — 30 soru TÜM alt konulara dağıldığı
    // için havuz sorgusu o temanın TÜM alt konularını kapsamalı, tek bir
    // subtopicId'yle sınırlı kalırsa öğrenciye 30 yerine sadece o payın
    // düştüğü birkaç soru (örn. 8) gider.
    const scopeSubtopicIds = resolveUnitSubtopicIds(subject.trim(), subtopicId.trim(), resolvedVariant);
    if (scopeSubtopicIds.length === 0) return NextResponse.json({ error: "Geçersiz konu." }, { status: 400 });

    // Faz Z6: variant filtresi ZORUNLU — aksi halde "genel" (tema geneli,
    // 30 soru) ve "alt_konu" (tek alt konu, 10 soru) havuzları AYNI
    // subtopicId altında karışırdı (ikisi de aynı tabloya yazıyor).
    const pool = await prisma.xrayPracticeQuestion.findMany({
      where: { subject: subject.trim(), subtopicId: { in: scopeSubtopicIds }, variant: resolvedVariant },
      select: { id: true, kazanimId: true, order: true, testId: true },
    });
    if (pool.length === 0) return NextResponse.json({ error: "Bu konu için soru havuzu boş." }, { status: 400 });

    const studentIds = await resolveTargetStudentIds(session.institutionId, target);
    if (studentIds.length === 0) return NextResponse.json({ error: "Hedeflenen kapsamda öğrenci bulunamadı." }, { status: 400 });

    let created = 0;
    for (const studentId of studentIds) {
      const selection = pickRandomTestFromPool(pool);
      await prisma.xrayPracticeAttempt.create({
        data: {
          studentId,
          subject: subject.trim(),
          subtopicId: subtopicId.trim(),
          variant: resolvedVariant,
          assignedById: session.sub,
          questions: { create: selection.map((s) => ({ questionId: s.id, order: s.order })) },
        },
      });
      created++;
    }

    return NextResponse.json({ created }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_assignment_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-assignments", handleGet);
export const POST = withApiLogging("POST /api/xray/practice-assignments", handlePost);
