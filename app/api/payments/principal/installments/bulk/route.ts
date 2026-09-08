import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { currentAcademicYear } from "@/lib/payments/academic-year";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import { createInstallmentPlan, findStudentsWithExistingPlan } from "@/lib/server/payments/plan-service";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

const MAX_STUDENTS = 500;

// GET ?branchId= — toplu atama önizlemesi: bu şubede kimin planı var,
// kimin yok.
//
// Önizleme olmadan müdür "60 öğrenciye plan kur" düğmesine kaç kişilik
// bir borç yazacağını bilmeden basar. Borç yazmak tahsilattan çok daha
// zor geri alınır.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const branchId = request.nextUrl.searchParams.get("branchId");

    const students = await prisma.student.findMany({
      where: { institutionId: session.institutionId, isActive: true, ...(branchId ? { branchId } : {}) },
      select: { id: true, firstName: true, lastName: true, branch: { select: { id: true, name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    const withPlan = await findStudentsWithExistingPlan(session.institutionId, students.map((s) => s.id));

    const branches = await prisma.branch.findMany({
      where: { institutionId: session.institutionId },
      select: { id: true, name: true, grade: true },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      branches,
      students: students.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        branchId: s.branch.id,
        branchName: s.branch.name,
        hasPlan: withPlan.has(s.id),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("bulk_plan_preview_failed", error);
  }
}

// POST — { studentIds[], totalAmount, installmentCount, startDate, titlePrefix?, academicYear? }
//
// Her öğrenci KENDİ indirimleriyle hesaplanır; toplu atama indirimleri
// ezmez (kardeş indirimi olan öğrenci daha az borçlanır).
//
// Planı OLAN öğrenciler atlanır ve ayrıca raporlanır — ikinci bir plan
// borcu iki katına çıkarırdı ve bu sessizce olsaydı aylarca fark
// edilmezdi.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const studentIds: string[] = Array.isArray(body?.studentIds)
      ? [...new Set(body.studentIds.filter((x: unknown) => typeof x === "string"))] as string[]
      : [];
    const listAmount = Number(body?.totalAmount);
    const installmentCount = Number(body?.installmentCount);
    const startDate = body?.startDate ? new Date(body.startDate) : new Date();
    const titlePrefix = (body?.titlePrefix as string | undefined)?.trim() || "Eğitim Ücreti";
    const academicYear = (body?.academicYear as string | undefined)?.trim() || currentAcademicYear();

    if (studentIds.length === 0) return NextResponse.json({ error: "En az bir öğrenci seçilmelidir." }, { status: 400 });
    if (studentIds.length > MAX_STUDENTS) {
      return NextResponse.json({ error: `Tek seferde en fazla ${MAX_STUDENTS} öğrenciye plan kurulabilir.` }, { status: 400 });
    }
    if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) {
      return NextResponse.json({ error: "installmentCount 1-36 arası bir tam sayı olmalı." }, { status: 400 });
    }
    if (!Number.isFinite(listAmount) || listAmount <= 0) {
      return NextResponse.json({ error: "totalAmount pozitif bir sayı olmalı." }, { status: 400 });
    }
    if (Number.isNaN(startDate.getTime())) return NextResponse.json({ error: "startDate geçerli bir tarih olmalı." }, { status: 400 });

    // Kurum sahipliği TEK sorguda doğrulanır — öğrenci başına sorgu
    // atmak 500 öğrencide 500 gidiş dönüş demekti.
    const owned = await prisma.student.findMany({
      where: { id: { in: studentIds }, institutionId: session.institutionId },
      select: { id: true, firstName: true, lastName: true },
    });
    const ownedIds = new Set(owned.map((s) => s.id));
    const foreign = studentIds.filter((id) => !ownedIds.has(id));
    if (foreign.length > 0) return NextResponse.json({ error: "Seçimde bu kuruma ait olmayan öğrenci var." }, { status: 404 });

    const withPlan = await findStudentsWithExistingPlan(session.institutionId, studentIds);
    const targets = owned.filter((s) => !withPlan.has(s.id));

    const created: { studentId: string; name: string; netAmount: number }[] = [];
    const failed: { studentId: string; name: string; error: string }[] = [];

    for (const student of targets) {
      try {
        const result = await createInstallmentPlan({
          institutionId: session.institutionId,
          studentId: student.id,
          listAmount,
          installmentCount,
          startDate,
          titlePrefix,
          academicYear,
        });
        created.push({ studentId: student.id, name: `${student.firstName} ${student.lastName}`, netAmount: result.netAmount });
      } catch (planError) {
        // Bir öğrencinin hatası diğerlerini DURDURMAZ; hangi öğrencide
        // ne olduğu ayrıca raporlanır.
        failed.push({
          studentId: student.id,
          name: `${student.firstName} ${student.lastName}`,
          error: planError instanceof Error ? planError.message : "Bilinmeyen hata",
        });
      }
    }

    if (created.length > 0) {
      await recordPaymentAudit({
        session,
        action: "INSTALLMENT_PLAN_CREATED",
        targetType: "Institution",
        targetId: session.institutionId,
        amount: created.reduce((sum, c) => sum + c.netAmount, 0),
        summary: `Toplu plan · ${created.length} öğrenci × ${installmentCount} taksit · liste ${listAmount.toFixed(2)} ₺`,
        metadata: {
          studentCount: created.length,
          installmentCount,
          listAmount,
          skippedExisting: withPlan.size,
          failedCount: failed.length,
        },
      });
    }

    return NextResponse.json(
      {
        createdCount: created.length,
        created,
        skippedExisting: owned.filter((s) => withPlan.has(s.id)).map((s) => `${s.firstName} ${s.lastName}`),
        failed,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("bulk_plan_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/installments/bulk", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/installments/bulk", handlePost);
