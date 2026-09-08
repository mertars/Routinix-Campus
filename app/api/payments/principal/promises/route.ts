import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

export type PromiseState = "PENDING" | "KEPT" | "BROKEN" | "CLOSED";

// GET ?studentId= (opsiyonel) — ödeme sözleri, durumları HESAPLANMIŞ olarak.
//
// Durum saklanmaz: söz verildikten SONRA yapılan tahsilatlar toplanır ve
// vaat edilen tutarı karşılıyorsa söz "tutuldu" sayılır. Böylece veli
// ödediği anda söz kendiliğinden kapanır; kimsenin elle işaretlemesi
// gerekmez ve durum bayatlamaz.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");
    const institutionId = session.institutionId;
    const studentId = request.nextUrl.searchParams.get("studentId");

    const promises = await prisma.paymentPromise.findMany({
      where: { institutionId, ...(studentId ? { studentId } : {}) },
      include: {
        student: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } },
        createdByAdmin: { select: { firstName: true, lastName: true } },
      },
      orderBy: { promisedDate: "asc" },
      take: 200,
    });

    // Sözü olan öğrencilerin, söz tarihinden sonraki tahsilatları TEK
    // sorguda çekilir (söz başına ayrı sorgu atmamak için).
    const studentIds = [...new Set(promises.map((p) => p.studentId))];
    const payments =
      studentIds.length > 0
        ? await prisma.payment.findMany({
            where: { institutionId, studentId: { in: studentIds }, status: "COMPLETED" },
            select: { studentId: true, amount: true, paidAt: true },
          })
        : [];

    const now = new Date();
    const rows = promises.map((p) => {
      const paidSince = payments
        .filter((x) => x.studentId === p.studentId && x.paidAt >= p.createdAt)
        .reduce((sum, x) => sum + Number(x.amount), 0);
      const promised = Number(p.promisedAmount);

      let state: PromiseState;
      if (p.closedAt) state = "CLOSED";
      else if (paidSince >= promised - 0.009) state = "KEPT";
      else if (p.promisedDate < now) state = "BROKEN";
      else state = "PENDING";

      return {
        id: p.id,
        studentId: p.studentId,
        studentName: `${p.student.firstName} ${p.student.lastName}`,
        branchName: p.student.branch.name,
        promisedAmount: promised,
        paidSince,
        promisedDate: p.promisedDate.toISOString(),
        note: p.note,
        state,
        closedReason: p.closedReason,
        createdBy: `${p.createdByAdmin.firstName} ${p.createdByAdmin.lastName}`,
        createdAt: p.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      promises: rows,
      summary: {
        pending: rows.filter((r) => r.state === "PENDING").length,
        broken: rows.filter((r) => r.state === "BROKEN").length,
        kept: rows.filter((r) => r.state === "KEPT").length,
        // Bugün ve öncesinde vadesi dolan, hâlâ ödenmemiş sözler — müdürün
        // "bugün kimi aramalıyım" listesi.
        dueToday: rows.filter((r) => r.state === "BROKEN" || (r.state === "PENDING" && new Date(r.promisedDate).toDateString() === now.toDateString())).length,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("promises_list_failed", error);
  }
}

// POST — { studentId, promisedAmount, promisedDate, note? }
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");

    const body = await request.json().catch(() => null);
    const studentId = body?.studentId as string | undefined;
    const promisedAmount = Number(body?.promisedAmount);
    const promisedDate = body?.promisedDate ? new Date(body.promisedDate) : null;
    const note = (body?.note as string | undefined)?.trim() || null;

    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });
    if (!Number.isFinite(promisedAmount) || promisedAmount <= 0) return NextResponse.json({ error: "Tutar pozitif bir sayı olmalı." }, { status: 400 });
    if (!promisedDate || Number.isNaN(promisedDate.getTime())) return NextResponse.json({ error: "Geçerli bir söz tarihi gerekli." }, { status: 400 });

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student || student.institutionId !== session.institutionId) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const promise = await prisma.paymentPromise.create({
      data: { institutionId: session.institutionId, studentId, promisedAmount, promisedDate, note, createdByAdminId: session.sub },
    });
    return NextResponse.json({ promise: { id: promise.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("promise_create_failed", error);
  }
}

// PATCH — { id, closedReason } ile sözü elle kapat (veli vazgeçti,
// yapılandırmaya gidildi vb.).
async function handlePatch(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");

    const body = await request.json().catch(() => null);
    const id = body?.id as string | undefined;
    const closedReason = (body?.closedReason as string | undefined)?.trim() || null;
    if (!id) return NextResponse.json({ error: "id zorunludur." }, { status: 400 });

    const existing = await prisma.paymentPromise.findUnique({ where: { id }, select: { institutionId: true } });
    if (!existing || existing.institutionId !== session.institutionId) return NextResponse.json({ error: "Söz bulunamadı." }, { status: 404 });

    await prisma.paymentPromise.update({ where: { id }, data: { closedAt: new Date(), closedReason } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("promise_close_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/promises", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/promises", handlePost);
export const PATCH = withApiLogging("PATCH /api/payments/principal/promises", handlePatch);
