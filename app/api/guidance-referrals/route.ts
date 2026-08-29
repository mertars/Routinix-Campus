import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution, assertTeacherOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/guidance-referrals — Risk Alarmı sekmesindeki manuel "Rehberliğe
// Sevk Et" akışının hedefi (bkz. components/teacher/tabs/risk-referral.tsx).
// GuidanceNote'tan (serbest metin, FK'sız authorName) BİLEREK ayrı: burada
// teacherId GERÇEK bir Teacher kaydına bağlı FK'dır ve durum TAKİP
// EDİLEBİLİR (PENDING/REVIEWED) — bu yüzden SADECE öğretmen oluşturabilir
// (yöneticinin/rehberliğin kendi "öğretmen kimliği" yok, bkz. şema notu).
// Bu veri şimdilik sadece kaydedilir — Rehberlikçi tarafının PENDING/REVIEWED
// kuyruğunu gösteren ekranı ayrı bir PART'ta yapılacak.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

    const body = await request.json();
    const { studentId, reason } = body as { studentId?: string; reason?: string };
    if (!studentId || !reason?.trim()) {
      return NextResponse.json({ error: "studentId ve reason zorunludur." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    await assertTeacherOwnsStudent(session.sub, studentId);

    const guidanceReferral = await prisma.guidanceReferral.create({
      data: { studentId, teacherId: session.sub, reason: reason.trim() },
    });

    await recordAuditLog({
      institutionId: student.institutionId,
      actorId: session.sub,
      actorRole: session.role,
      action: "GUIDANCE_REFERRAL_CREATED",
      targetType: "Student",
      targetId: studentId,
      metadata: { reason: guidanceReferral.reason },
    });

    return NextResponse.json({ guidanceReferral }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("guidance_referral_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/guidance-referrals", handlePost);
