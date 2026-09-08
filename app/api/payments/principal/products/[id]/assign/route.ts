import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET — bu ürüne atanmış öğrenciler ve ödeme durumları.
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const product = await prisma.product.findUnique({ where: { id: params.id }, select: { institutionId: true, name: true } });
    if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
    requireInstitution(session, product.institutionId);

    const rows = await prisma.installment.findMany({
      where: { productId: params.id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, branch: { select: { name: true } } } },
        payments: { where: { status: "COMPLETED" }, select: { amount: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      participants: rows.map((r) => {
        const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
        return {
          installmentId: r.id,
          studentId: r.studentId,
          studentName: `${r.student.firstName} ${r.student.lastName}`,
          branchName: r.student.branch.name,
          amount: Number(r.amount),
          paidAmount: paid,
          status: r.status,
          dueDate: r.dueDate.toISOString(),
        };
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("product_participants_failed", error);
  }
}

// POST — { studentIds: string[], dueDate? }
// Seçilen her öğrenciye ürün fiyatı kadar BİR taksit satırı açar. Zaten
// atanmış öğrenciler ATLANIR (aynı ürün iki kez borçlandırılmaz).
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      select: { institutionId: true, name: true, price: true, capacity: true, type: true, eventDate: true },
    });
    if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
    requireInstitution(session, product.institutionId);

    const body = await request.json().catch(() => null);
    const studentIds = Array.isArray(body?.studentIds) ? body.studentIds.filter((id: unknown) => typeof id === "string") : [];
    if (studentIds.length === 0) return NextResponse.json({ error: "studentIds zorunludur." }, { status: 400 });

    const dueDate = body?.dueDate ? new Date(body.dueDate) : (product.eventDate ?? new Date());
    if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: "dueDate geçerli bir tarih olmalı." }, { status: 400 });

    // Tenant kontrolü + zaten atanmışları çıkar.
    const [validStudents, alreadyAssigned, currentCount] = await Promise.all([
      prisma.student.findMany({ where: { id: { in: studentIds }, institutionId: session.institutionId }, select: { id: true } }),
      prisma.installment.findMany({ where: { productId: params.id, studentId: { in: studentIds } }, select: { studentId: true } }),
      prisma.installment.count({ where: { productId: params.id } }),
    ]);
    const assignedSet = new Set(alreadyAssigned.map((a) => a.studentId));
    const targets = validStudents.filter((s) => !assignedSet.has(s.id));
    if (targets.length === 0) return NextResponse.json({ error: "Seçilen öğrencilerin tamamı zaten atanmış." }, { status: 400 });

    if (product.capacity != null && currentCount + targets.length > product.capacity) {
      return NextResponse.json(
        { error: `Kontenjan yetersiz: ${product.capacity} kişilik kontenjanda ${currentCount} dolu, ${targets.length} kişi eklenemez.` },
        { status: 400 }
      );
    }

    await prisma.installment.createMany({
      data: targets.map((s) => ({
        institutionId: session.institutionId,
        studentId: s.id,
        productId: params.id,
        title: product.name,
        amount: product.price,
        dueDate,
      })),
    });

    return NextResponse.json({ assignedCount: targets.length, skippedCount: studentIds.length - targets.length }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("product_assign_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/products/[id]/assign", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/products/[id]/assign", handlePost);
