import { NextRequest, NextResponse } from "next/server";
import type { DiscountType, DiscountValueType } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import { DISCOUNT_TYPE_LABEL, applyDiscounts, getActiveDiscounts } from "@/lib/server/payments/discount-service";

export const dynamic = "force-dynamic";

const VALID_TYPES: DiscountType[] = ["SIBLING", "MERIT", "EARLY_REGISTRATION", "STAFF_CHILD", "FINANCIAL_AID", "OTHER"];

// GET ?studentId=&academicYear=  — tek öğrencinin indirimleri (+ liste
// fiyatı verilirse hesaplanmış net).
// GET (parametresiz) — kurum geneli burs/indirim özeti: kime, ne kadar.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");
    const institutionId = session.institutionId;

    const studentId = request.nextUrl.searchParams.get("studentId");
    const academicYear = request.nextUrl.searchParams.get("academicYear") ?? "2025-2026";
    const listAmountParam = Number(request.nextUrl.searchParams.get("listAmount"));

    if (studentId) {
      const discounts = await getActiveDiscounts(institutionId, studentId, academicYear);
      const calculation = Number.isFinite(listAmountParam) && listAmountParam > 0 ? applyDiscounts(listAmountParam, discounts) : null;
      return NextResponse.json({
        discounts: discounts.map((d) => ({ ...d, label: DISCOUNT_TYPE_LABEL[d.type] ?? d.type })),
        calculation,
      });
    }

    const rows = await prisma.studentDiscount.findMany({
      where: { institutionId, isActive: true },
      include: {
        student: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } },
        approvedByAdmin: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    // "Ne kadar burs dağıttık" — yalnızca plana UYGULANMIŞ indirimler
    // sayılır (appliedDiscount dolu olanlar); henüz plan üretilmemiş bir
    // indirim tanımı gerçek bir maliyet değildir.
    const byType = new Map<string, { count: number; amount: number }>();
    let grantedTotal = 0;
    // ⚠️ Liste fiyatı, aynı plana uygulanan HER indirim satırına ayrı ayrı
    // yazılır (2 indirim = aynı 100.000 iki kez). Doğrudan toplanırsa liste
    // cirosu şişer ve indirim ORANI olduğundan düşük çıkar. Bu yüzden
    // öğrenci + uygulama anı bazında TEKİLLEŞTİRİLİYOR.
    const listByApplication = new Map<string, number>();
    for (const r of rows) {
      const applied = r.appliedDiscount ? Number(r.appliedDiscount) : 0;
      grantedTotal += applied;
      if (r.appliedListAmount && r.appliedAt) {
        listByApplication.set(`${r.studentId}|${r.appliedAt.toISOString()}`, Number(r.appliedListAmount));
      }
      const cur = byType.get(r.type) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += applied;
      byType.set(r.type, cur);
    }
    const listTotal = [...listByApplication.values()].reduce((s, v) => s + v, 0);

    return NextResponse.json({
      summary: {
        grantedTotal,
        listTotal,
        discountRate: listTotal > 0 ? (grantedTotal / listTotal) * 100 : 0,
        studentCount: new Set(rows.map((r) => r.studentId)).size,
        byType: [...byType.entries()]
          .map(([type, v]) => ({ type, label: DISCOUNT_TYPE_LABEL[type] ?? type, count: v.count, amount: v.amount }))
          .sort((a, b) => b.amount - a.amount),
      },
      discounts: rows.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: `${r.student.firstName} ${r.student.lastName}`,
        branchName: r.student.branch.name,
        type: r.type,
        label: DISCOUNT_TYPE_LABEL[r.type] ?? r.type,
        valueType: r.valueType,
        value: Number(r.value),
        academicYear: r.academicYear,
        reason: r.reason,
        appliedDiscount: r.appliedDiscount ? Number(r.appliedDiscount) : null,
        appliedListAmount: r.appliedListAmount ? Number(r.appliedListAmount) : null,
        approvedBy: `${r.approvedByAdmin.firstName} ${r.approvedByAdmin.lastName}`,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("discounts_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { studentId, type, valueType, value, academicYear?, reason? }
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const studentId = body?.studentId as string | undefined;
    const type = body?.type as DiscountType | undefined;
    const valueType = body?.valueType as DiscountValueType | undefined;
    const value = Number(body?.value);
    const academicYear = (body?.academicYear as string | undefined)?.trim() || "2025-2026";
    const reason = (body?.reason as string | undefined)?.trim() || null;

    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });
    if (!type || !VALID_TYPES.includes(type)) return NextResponse.json({ error: "Geçersiz indirim türü." }, { status: 400 });
    if (valueType !== "PERCENTAGE" && valueType !== "FIXED") return NextResponse.json({ error: "valueType geçersiz." }, { status: 400 });
    if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: "value pozitif bir sayı olmalı." }, { status: 400 });
    if (valueType === "PERCENTAGE" && value > 100) return NextResponse.json({ error: "Yüzde 100'den büyük olamaz." }, { status: 400 });

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student || student.institutionId !== session.institutionId) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const discount = await prisma.studentDiscount.create({
      data: {
        institutionId: session.institutionId,
        studentId,
        type,
        valueType,
        value,
        academicYear,
        reason,
        approvedByAdminId: session.sub,
      },
    });
    await recordPaymentAudit({
      session,
      action: "DISCOUNT_GRANTED",
      targetType: "StudentDiscount",
      targetId: discount.id,
      // İndirim henüz bir plana uygulanmadığı için parasal karşılığı
      // burada 0'dır; oran/tutar metadata'da durur. Tutar plan
      // oluşturulurken netleşir (INSTALLMENT_PLAN_CREATED izinde görünür).
      amount: 0,
      summary: `${DISCOUNT_TYPE_LABEL[type] ?? type} · ${valueType === "PERCENTAGE" ? `%${value}` : `${value} ₺`} · ${academicYear}`,
      metadata: { studentId, type, valueType, value, academicYear },
    });

    return NextResponse.json({ discount: { id: discount.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("discount_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PATCH — { id, isActive:false } ile indirimi kaldır. Silme YOK: geçmişte
// uygulanmış bir indirimin izi (kim onayladı, ne kadar) korunmalı.
async function handlePatch(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const id = body?.id as string | undefined;
    if (!id) return NextResponse.json({ error: "id zorunludur." }, { status: 400 });

    const existing = await prisma.studentDiscount.findUnique({ where: { id }, select: { institutionId: true } });
    if (!existing || existing.institutionId !== session.institutionId) return NextResponse.json({ error: "İndirim bulunamadı." }, { status: 404 });

    await prisma.studentDiscount.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("discount_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/discounts", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/discounts", handlePost);
export const PATCH = withApiLogging("PATCH /api/payments/principal/discounts", handlePatch);
