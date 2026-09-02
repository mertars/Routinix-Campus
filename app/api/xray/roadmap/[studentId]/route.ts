import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { buildRoadmapForSubject } from "@/lib/server/xray/roadmap";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/roadmap/[studentId]?subject= — Faz Q: /api/xray/my-roadmap
// SADECE öğrencinin kendi verisine erişim sağlıyordu (session.sub) — yönetici
// bu "reçete" metnini şimdiye kadar SADECE PDF indirerek görebiliyordu.
// Bu uç AYNI hesaplamayı (bkz. lib/server/xray/roadmap.ts) yönetici/
// öğretmen/veli için EKRANDA gösterir — sahiplik kuralı /api/xray/report/
// [studentId] ile BİREBİR aynı. RESMİ dildeki `advice`/`overallAdvice`
// alanlarını döner (studioNote/studioSummary SADECE öğrenci ekranı içindir).
async function handleGet(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();

    const student = await prisma.student.findUnique({ where: { id: params.studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, params.studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, params.studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, params.studentId);

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });

    const roadmap = await buildRoadmapForSubject(params.studentId, subject);
    return NextResponse.json(roadmap);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_roadmap_failed", { studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/roadmap/[studentId]", handleGet);
