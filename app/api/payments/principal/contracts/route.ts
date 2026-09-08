import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { currentAcademicYear } from "@/lib/payments/academic-year";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { createShareToken, renderContractContent } from "@/lib/server/contracts/contract-service";

export const dynamic = "force-dynamic";

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

// GET — kurumun sözleşmeleri (en yeni önce).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const status = request.nextUrl.searchParams.get("status");
    const contracts = await prisma.studentContract.findMany({
      where: {
        institutionId: session.institutionId,
        ...(status === "DRAFT" || status === "SENT" || status === "SIGNED" || status === "CANCELLED" ? { status } : {}),
      },
      include: { student: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      contracts: contracts.map((c) => ({
        id: c.id,
        title: c.title,
        studentName: `${c.student.firstName} ${c.student.lastName}`,
        branchName: c.student.branch.name,
        status: c.status,
        totalAmount: c.totalAmount ? Number(c.totalAmount) : null,
        installmentCount: c.installmentCount,
        shareToken: c.shareToken,
        expiresAt: c.expiresAt.toISOString(),
        signerName: c.signerName,
        signedAt: c.signedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("contracts_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { studentId, templateId, totalAmount?, installmentCount?, academicYear? }
// Şablonun O ANDAKİ içeriği yer tutucuları doldurulmuş şekilde sözleşmeye
// KOPYALANIR (bkz. schema > StudentContract.content gerekçesi).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const studentId = body?.studentId as string | undefined;
    const templateId = body?.templateId as string | undefined;
    const totalAmount = body?.totalAmount != null ? Number(body.totalAmount) : null;
    const installmentCount = body?.installmentCount != null ? Number(body.installmentCount) : null;
    const academicYear = (body?.academicYear as string | undefined)?.trim() || currentAcademicYear();

    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });
    if (!templateId) return NextResponse.json({ error: "templateId zorunludur." }, { status: 400 });
    if (totalAmount != null && (!Number.isFinite(totalAmount) || totalAmount <= 0)) {
      return NextResponse.json({ error: "totalAmount pozitif bir sayı olmalı." }, { status: 400 });
    }

    const [student, template, institution] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: {
          institutionId: true,
          firstName: true,
          lastName: true,
          studentNumber: true,
          branch: { select: { name: true } },
          parents: { include: { parent: { select: { firstName: true, lastName: true } } }, take: 1 },
        },
      }),
      prisma.contractTemplate.findUnique({ where: { id: templateId }, select: { institutionId: true, title: true, content: true } }),
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true } }),
    ]);

    if (!student || student.institutionId !== session.institutionId) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    if (!template || template.institutionId !== session.institutionId) return NextResponse.json({ error: "Şablon bulunamadı." }, { status: 404 });

    const parent = student.parents[0]?.parent;
    const content = renderContractContent(template.content, {
      kurum_adi: institution?.name ?? "",
      ogrenci_adi: `${student.firstName} ${student.lastName}`,
      ogrenci_no: student.studentNumber,
      sinif: student.branch.name,
      veli_adi: parent ? `${parent.firstName} ${parent.lastName}` : "—",
      tutar: totalAmount != null ? formatTRY(totalAmount) : "—",
      taksit_sayisi: installmentCount != null ? String(installmentCount) : "—",
      tarih: new Date().toLocaleDateString("tr-TR"),
      ogrenim_yili: academicYear,
    });

    const { token, expiresAt } = createShareToken();
    const contract = await prisma.studentContract.create({
      data: {
        institutionId: session.institutionId,
        studentId,
        templateId,
        title: template.title,
        content,
        totalAmount,
        installmentCount,
        shareToken: token,
        expiresAt,
        createdByAdminId: session.sub,
      },
    });

    return NextResponse.json({ contract: { id: contract.id, shareToken: contract.shareToken, status: contract.status } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("contract_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PATCH — { id, action: "send" | "cancel" }
async function handlePatch(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const id = body?.id as string | undefined;
    const action = body?.action as string | undefined;
    if (!id || (action !== "send" && action !== "cancel")) {
      return NextResponse.json({ error: "id ve action ('send' | 'cancel') zorunludur." }, { status: 400 });
    }

    const existing = await prisma.studentContract.findUnique({ where: { id }, select: { institutionId: true, status: true } });
    if (!existing || existing.institutionId !== session.institutionId) return NextResponse.json({ error: "Sözleşme bulunamadı." }, { status: 404 });
    if (existing.status === "SIGNED") return NextResponse.json({ error: "İmzalanmış sözleşme değiştirilemez." }, { status: 400 });

    const updated = await prisma.studentContract.update({
      where: { id },
      data: { status: action === "send" ? "SENT" : "CANCELLED" },
    });
    return NextResponse.json({ contract: { id: updated.id, status: updated.status } });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("contract_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/contracts", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/contracts", handlePost);
export const PATCH = withApiLogging("PATCH /api/payments/principal/contracts", handlePatch);
