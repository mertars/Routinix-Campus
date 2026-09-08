import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import {
  EnrollmentError,
  createEnrollment,
  listRenewalCandidates,
  RENEWAL_WINDOW_DAYS,
  defaultEndDate,
  currentAcademicYear,
} from "@/lib/server/enrollment/enrollment-service";

export const dynamic = "force-dynamic";

// GET ?studentId=  → o öğrencinin TÜM kayıt geçmişi (yıl yıl)
// GET (parametresiz) → süresi dolmak üzere olan kayıtlar (yenileme listesi)
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const studentId = request.nextUrl.searchParams.get("studentId");
    if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
      if (!student || student.institutionId !== session.institutionId) {
        return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
      }
      // Geçmiş yıllar SİLİNMEZ — en yeniden eskiye doğru tüm zincir.
      const rows = await prisma.studentEnrollment.findMany({
        where: { studentId },
        orderBy: { academicYear: "desc" },
        select: {
          id: true,
          academicYear: true,
          startDate: true,
          endDate: true,
          status: true,
          listAmount: true,
          installmentCount: true,
          note: true,
        },
      });
      return NextResponse.json({
        enrollments: rows.map((r) => ({
          ...r,
          startDate: r.startDate.toISOString(),
          endDate: r.endDate.toISOString(),
          listAmount: r.listAmount != null ? Number(r.listAmount) : null,
        })),
      });
    }

    const windowParam = Number(request.nextUrl.searchParams.get("days"));
    const windowDays = Number.isFinite(windowParam) && windowParam > 0 ? Math.floor(windowParam) : RENEWAL_WINDOW_DAYS;
    const candidates = await listRenewalCandidates(session.institutionId, windowDays);

    return NextResponse.json({
      candidates,
      windowDays,
      currentAcademicYear: currentAcademicYear(),
      suggestedEndDate: defaultEndDate(currentAcademicYear()).toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("enrollments_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { studentId, academicYear?, startDate?, endDate?, listAmount?, installmentCount?, note? }
// Yeni kayıt dönemi açar. Taksit planı AYRI kurulur (ödeme paneli veya
// kullanıcı ekleme ekranı) — burası anlaşmanın kaydıdır.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const studentId = body?.studentId as string | undefined;
    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student || student.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    }

    const academicYear = (body?.academicYear as string | undefined)?.trim() || currentAcademicYear();
    const startDate = body?.startDate ? new Date(body.startDate) : new Date();
    const endDate = body?.endDate ? new Date(body.endDate) : defaultEndDate(academicYear);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Tarihler geçerli olmalı." }, { status: 400 });
    }

    const enrollment = await createEnrollment({
      institutionId: session.institutionId,
      studentId,
      academicYear,
      startDate,
      endDate,
      listAmount: body?.listAmount != null ? Number(body.listAmount) : null,
      installmentCount: body?.installmentCount != null ? Number(body.installmentCount) : null,
      note: (body?.note as string | undefined)?.trim() || null,
      createdByAdminId: session.sub,
    });

    return NextResponse.json({ id: enrollment.id, academicYear: enrollment.academicYear }, { status: 201 });
  } catch (error) {
    if (error instanceof EnrollmentError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("enrollment_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/enrollments", handleGet);
export const POST = withApiLogging("POST /api/enrollments", handlePost);
