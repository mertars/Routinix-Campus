import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { pickRandomTestFromPool } from "@/lib/server/xray/practice-pool";
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

    const assignments = await prisma.xrayPracticeAttempt.findMany({
      where: { studentId },
      orderBy: { assignedAt: "desc" },
      select: { id: true, subject: true, subtopicId: true, status: true, assignedAt: true, completedAt: true },
    });

    const withNames = assignments.map((a) => {
      const topics = CURRICULUM_TREE[a.subject] ?? [];
      const name = topics.flatMap((t) => t.subtopics).find((s) => s.id === a.subtopicId)?.name ?? a.subtopicId;
      return { ...a, subtopicName: name };
    });

    return NextResponse.json({ assignments: withNames });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_assignments_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/xray/practice-assignments — { studentId, subject, subtopicId } —
// yöneticinin bir öğrenciye Test 1 (Konu Bilgisi) ataması. Havuzdan
// RASTGELE seçim ATAMA ANINDA yapılır (bkz. lib/server/xray/practice-pool.ts)
// ve XrayPracticeAttemptQuestion'a sabitlenir — öğrenci ne zaman açarsa
// açsın AYNI soruları görür. Aynı öğrenci aynı konudan TEKRAR atanabilir
// (her seferinde YENİ bir rastgele seçimle, @@unique yok).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { studentId, subject, subtopicId } = body as { studentId?: string; subject?: string; subtopicId?: string };
    if (!studentId || !subject?.trim() || !subtopicId?.trim()) {
      return NextResponse.json({ error: "studentId, subject ve subtopicId zorunludur." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    const pool = await prisma.xrayPracticeQuestion.findMany({
      where: { subject: subject.trim(), subtopicId: subtopicId.trim() },
      select: { id: true, kazanimId: true, order: true, testId: true },
    });
    if (pool.length === 0) return NextResponse.json({ error: "Bu konu için soru havuzu boş." }, { status: 400 });

    const selection = pickRandomTestFromPool(pool);

    const attempt = await prisma.xrayPracticeAttempt.create({
      data: {
        studentId,
        subject: subject.trim(),
        subtopicId: subtopicId.trim(),
        assignedById: session.sub,
        questions: { create: selection.map((s) => ({ questionId: s.id, order: s.order })) },
      },
    });

    return NextResponse.json({ attemptId: attempt.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_assignment_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-assignments", handleGet);
export const POST = withApiLogging("POST /api/xray/practice-assignments", handlePost);
