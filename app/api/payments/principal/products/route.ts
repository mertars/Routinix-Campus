import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";

export const dynamic = "force-dynamic";

// GET — ürün/etkinlik listesi + her biri için katılımcı ve tahsilat özeti.
// Özet, ürüne bağlı Installment satırlarından türetilir (ayrı bir sayaç
// tutulmaz — bkz. schema > Product'ın üstündeki "tek alacak defteri" notu).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const products = await prisma.product.findMany({
      where: { institutionId: session.institutionId, isActive: true },
      include: {
        installments: {
          select: { id: true, amount: true, status: true, payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      products: products.map((p) => {
        const assignedCount = p.installments.length;
        const expected = p.installments.reduce((s, i) => s + Number(i.amount), 0);
        const collected = p.installments.reduce((s, i) => s + i.payments.reduce((x, pay) => x + Number(pay.amount), 0), 0);
        const paidCount = p.installments.filter((i) => i.status === "PAID").length;
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          description: p.description,
          price: Number(p.price),
          eventDate: p.eventDate?.toISOString() ?? null,
          capacity: p.capacity,
          assignedCount,
          paidCount,
          expected,
          collected,
        };
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("products_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { name, type, price, description?, eventDate?, capacity? }
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const name = (body?.name as string | undefined)?.trim();
    const type = body?.type as "PRODUCT" | "EVENT" | undefined;
    const price = Number(body?.price);
    const description = (body?.description as string | undefined)?.trim() || null;
    const eventDate = body?.eventDate ? new Date(body.eventDate) : null;
    const capacity = body?.capacity != null && body.capacity !== "" ? Number(body.capacity) : null;

    if (!name) return NextResponse.json({ error: "name zorunludur." }, { status: 400 });
    if (type !== "PRODUCT" && type !== "EVENT") return NextResponse.json({ error: "type PRODUCT veya EVENT olmalı." }, { status: 400 });
    if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: "price pozitif bir sayı olmalı." }, { status: 400 });
    if (eventDate && Number.isNaN(eventDate.getTime())) return NextResponse.json({ error: "eventDate geçerli bir tarih olmalı." }, { status: 400 });
    if (capacity != null && (!Number.isInteger(capacity) || capacity <= 0)) return NextResponse.json({ error: "capacity pozitif bir tam sayı olmalı." }, { status: 400 });

    const product = await prisma.product.create({
      data: { institutionId: session.institutionId, name, type, price, description, eventDate, capacity },
    });
    return NextResponse.json({ product: { id: product.id, name: product.name } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("product_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/products", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/products", handlePost);
