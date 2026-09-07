import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET ?studentId= — yapılandırma önizlemesi: kaç taksit kapanacak, ne kadar
// kalan borç yeniden bölünecek. Yönetici "yapılandır"a basmadan önce
// rakamı görmeli.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });

    const open = await prisma.installment.findMany({
      where: { institutionId: session.institutionId, studentId, status: { in: ["PENDING", "PARTIALLY_PAID"] } },
      include: { payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
    });

    const remaining = open.reduce((sum, i) => sum + (Number(i.amount) - i.payments.reduce((s, p) => s + Number(p.amount), 0)), 0);
    return NextResponse.json({
      openCount: open.length,
      remainingAmount: Math.round(remaining * 100) / 100,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("restructure_preview_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { studentId, installmentCount, startDate, reason, titlePrefix? }
//
// Öğrencinin ödenmemiş/kısmi ödenmiş taksitlerini KAPATIR (CANCELLED) ve
// kalan borcu yeni bir plana böler.
//
// Neden "kapat + yeniden oluştur": kısmi ödenmiş bir taksitin tutarını
// düşürmek, o taksite bağlı tahsilatın tutarla uyumunu bozar ve makbuz
// geçmişini anlamsız kılar. Eski taksitler İPTAL olarak durur (tahsilatlar
// onlara bağlı kalır, makbuzlar geçerliliğini korur), yeni plan yalnızca
// KALAN tutarı kapsar — toplam alacak değişmez.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const studentId = body?.studentId as string | undefined;
    const installmentCount = Number(body?.installmentCount);
    const startDate = body?.startDate ? new Date(body.startDate) : new Date();
    const reason = (body?.reason as string | undefined)?.trim();
    const titlePrefix = (body?.titlePrefix as string | undefined)?.trim() || "Yapılandırılmış Borç";

    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });
    if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) {
      return NextResponse.json({ error: "Taksit sayısı 1-36 arası olmalı." }, { status: 400 });
    }
    if (Number.isNaN(startDate.getTime())) return NextResponse.json({ error: "Geçerli bir başlangıç tarihi gerekli." }, { status: 400 });
    if (!reason) return NextResponse.json({ error: "Yapılandırma gerekçesi zorunludur." }, { status: 400 });

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student || student.institutionId !== session.institutionId) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const open = await prisma.installment.findMany({
      where: { institutionId: session.institutionId, studentId, status: { in: ["PENDING", "PARTIALLY_PAID"] } },
      include: { payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
    });
    if (open.length === 0) return NextResponse.json({ error: "Yapılandırılacak açık taksit yok." }, { status: 400 });

    const remaining = Math.round(open.reduce((sum, i) => sum + (Number(i.amount) - i.payments.reduce((s, p) => s + Number(p.amount), 0)), 0) * 100) / 100;
    if (remaining <= 0) return NextResponse.json({ error: "Kalan borç bulunmuyor." }, { status: 400 });

    const per = Math.floor((remaining / installmentCount) * 100) / 100;
    const last = Math.round((remaining - per * (installmentCount - 1)) * 100) / 100;

    await prisma.$transaction(async (tx) => {
      await tx.installment.updateMany({ where: { id: { in: open.map((i) => i.id) } }, data: { status: "CANCELLED" } });

      await tx.installment.createMany({
        data: Array.from({ length: installmentCount }, (_, k) => {
          const dueDate = new Date(startDate);
          dueDate.setMonth(dueDate.getMonth() + k);
          return {
            institutionId: session.institutionId,
            studentId,
            title: `${titlePrefix} - Taksit ${k + 1}/${installmentCount}`,
            amount: k === installmentCount - 1 ? last : per,
            dueDate,
          };
        }),
      });

      await tx.installmentAdjustment.create({
        data: {
          institutionId: session.institutionId,
          studentId,
          type: "RESTRUCTURE",
          affectedCount: open.length,
          amount: remaining,
          newDueDate: startDate,
          reason,
          createdByAdminId: session.sub,
        },
      });
    });

    return NextResponse.json({ closedCount: open.length, restructuredAmount: remaining, newCount: installmentCount }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("restructure_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/restructure", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/restructure", handlePost);
