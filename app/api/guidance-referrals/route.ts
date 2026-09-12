import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution, assertTeacherOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// POST /api/guidance-referrals — Risk Alarmı sekmesindeki manuel "Rehberliğe
// Sevk Et" akışının hedefi (bkz. components/teacher/tabs/risk-referral.tsx).
// GuidanceNote'tan (serbest metin, FK'sız authorName) BİLEREK ayrı: burada
// teacherId GERÇEK bir Teacher kaydına bağlı FK'dır ve durum TAKİP
// EDİLEBİLİR (PENDING/REVIEWED). Artık Rehberlik personası da (bkz.
// lib/server/auth/jwt.ts) oluşturabiliyor — kimliği ZATEN gerçek bir Teacher
// kaydı (subject="Rehberlik"), teacherId FK'sı sorunsuz dolar. Bu veriyi
// artık GERÇEKTEN okuyan bir kuyruk var: GET /api/guidance-referrals (bkz.
// aşağıdaki handleGet) + /guidance panelindeki Sevk Kuyruğu.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "guidance");

    const body = await request.json();
    const { studentId, reason } = body as { studentId?: string; reason?: string };
    if (!studentId || !reason?.trim()) {
      return NextResponse.json({ error: "studentId ve reason zorunludur." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    // Rehberlik, sınıfa/şubeye bağlı olmadan kurum genelinde çalışır —
    // sahiplik kontrolü SADECE gerçek bir sınıf öğretmeni için anlamlı.
    if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, studentId);

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
    return apiFailure("guidance_referral_create_failed", error);
  }
}

// GET /api/guidance-referrals?status=PENDING|REVIEWED — Sevk Kuyruğu (bkz.
// components/guidance/referral-queue.tsx). Bu kaydı okuyan İLK uç — POST'un
// yorumundaki "ayrı bir PART'ta yapılacak" ekran artık budur. Kurum geneli,
// öğrenci/sevk eden öğretmen adıyla birlikte döner; status verilmezse hepsi.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal", "guidance");

    const statusParam = request.nextUrl.searchParams.get("status");
    const status = statusParam === "PENDING" || statusParam === "REVIEWED" ? statusParam : undefined;
    const limitParam = Number(request.nextUrl.searchParams.get("limit"));
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(100, limitParam) : undefined;

    const referrals = await prisma.guidanceReferral.findMany({
      where: { student: { institutionId: session.institutionId }, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: limit } : {}),
      include: {
        student: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } },
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({
      referrals: referrals.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: `${r.student.firstName} ${r.student.lastName}`,
        branchName: r.student.branch?.name ?? "",
        teacherName: `${r.teacher.firstName} ${r.teacher.lastName}`,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_referrals_list_failed", error);
  }
}

export const POST = withApiLogging("POST /api/guidance-referrals", handlePost);
export const GET = withApiLogging("GET /api/guidance-referrals", handleGet);
