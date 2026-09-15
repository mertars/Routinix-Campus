import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { recordAuditLog } from "@/lib/server/audit/audit-log";

export const dynamic = "force-dynamic";

// DANIŞMAN ATAMA — Student.advisorTeacherId'nin TEK yazma yolu.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15: "bu danışmanlık sistemde nasıl seçiliyor
// bunu ben bile bilmiyorum"): cevabı "hiçbir yerden" idi. Alan şemada vardı,
// her yerde OKUNUYORDU ama prisma/seed.ts dışında hiçbir şey YAZMIYORDU —
// ne form, ne API. İki somut sonucu vardı:
//   1. Gündem her gün "N öğrencinin danışman öğretmeni yok" diyordu ama
//      düzeltmenin yolu YOKTU (düzeltilemeyen bir uyarı gürültüdür).
//   2. Röntgen'in otomatik sevki (lib/server/xray/auto-referral.ts) sevki
//      student.advisorTeacherId'ye yolluyor; null olduğu için o sevkler
//      SESSİZCE hiçbir yere gitmiyordu.
//
// ⚠️ ŞUBE DANIŞMANI ile karıştırma: Branch.advisorId ayrı bir kavramdır ve
// öğretmen kartından atanır (bkz. lib/server/admin/create-user.ts >
// advisorBranchId). Burası ÖĞRENCİ bazlı danışman — "bu öğrenciyle özel
// olarak şu hoca ilgilensin".

async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const branchId = request.nextUrl.searchParams.get("branchId");
    const onlyMissing = request.nextUrl.searchParams.get("onlyMissing") === "1";

    const students = await prisma.student.findMany({
      where: {
        institutionId: session.institutionId,
        isActive: true,
        ...(branchId ? { branchId } : {}),
        ...(onlyMissing ? { advisorTeacherId: null } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        branch: { select: { id: true, name: true } },
        advisorTeacher: { select: { id: true, firstName: true, lastName: true, subject: true } },
      },
      orderBy: [{ firstName: "asc" }],
      take: 500,
    });

    return NextResponse.json({
      students: students.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        branchId: s.branch?.id ?? null,
        branchName: s.branch?.name ?? null,
        advisorId: s.advisorTeacher?.id ?? null,
        advisorName: s.advisorTeacher ? `${s.advisorTeacher.firstName} ${s.advisorTeacher.lastName}` : null,
        advisorSubject: s.advisorTeacher?.subject ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("student_advisors_list_failed", error);
  }
}

const assignSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1).max(500),
  // null => danışmanı kaldır
  advisorTeacherId: z.string().min(1).nullable(),
});

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const parsed = assignSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Öğrenci listesi ve danışman zorunludur." }, { status: 400 });
    }
    const { studentIds, advisorTeacherId } = parsed.data;

    // ⚠️ Öğretmen KENDİ KURUMUNDAN olmalı — istemciden gelen id'ye
    // güvenilmez (CLAUDE.md: "HİÇBİR API route client'tan gelen id'ye
    // güvenmez"). Aksi halde başka kurumun öğretmeni danışman yapılabilirdi.
    if (advisorTeacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: advisorTeacherId, institutionId: session.institutionId, isActive: true },
        select: { id: true },
      });
      if (!teacher) return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }

    // Aynı gerekçe öğrenciler için de: updateMany'nin where'i kurumla
    // DARALTILIR, yani başka kurumun öğrencisi id listesine sızsa bile
    // güncellenmez (sessizce atlanır, sayı farkından da anlaşılır).
    const result = await prisma.student.updateMany({
      where: { id: { in: studentIds }, institutionId: session.institutionId },
      data: { advisorTeacherId },
    });

    await recordAuditLog({
      institutionId: session.institutionId,
      actorId: session.sub,
      actorRole: "ADMIN",
      action: "USER_UPDATED",
      targetType: "Student",
      targetId: `${result.count} öğrenci`,
      metadata: { advisorTeacherId, count: result.count, requested: studentIds.length },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("student_advisors_assign_failed", error);
  }
}

export const GET = withApiLogging("GET /api/admin/student-advisors", handleGet);
export const POST = withApiLogging("POST /api/admin/student-advisors", handlePost);
