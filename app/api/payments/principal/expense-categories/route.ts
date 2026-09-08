import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// Kurumun hiç kategorisi yoksa ilk okumada tohumlanan varsayılan set — bir
// eğitim kurumunun gerçekte en sık kullandığı kalemler. Kurum bunları
// silemez/yeniden adlandıramaz DEĞİL: sıradan kayıtlar, POST ile yenisi
// eklenebilir (silme Faz 2.1).
const DEFAULT_CATEGORIES = ["Personel Maaş", "Kira", "Fatura (Elektrik/Su/Doğalgaz)", "Kırtasiye & Malzeme", "Servis & Ulaşım", "Bakım & Onarım", "Tanıtım & Pazarlama", "Diğer"];

async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    let categories = await prisma.expenseCategory.findMany({
      where: { institutionId: session.institutionId, isActive: true },
      orderBy: { name: "asc" },
    });

    if (categories.length === 0) {
      await prisma.expenseCategory.createMany({
        data: DEFAULT_CATEGORIES.map((name) => ({ institutionId: session.institutionId, name })),
        skipDuplicates: true,
      });
      categories = await prisma.expenseCategory.findMany({
        where: { institutionId: session.institutionId, isActive: true },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json({ categories: categories.map((c) => ({ id: c.id, name: c.name })) });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("expense_categories_list_failed", error);
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const name = (body?.name as string | undefined)?.trim();
    if (!name) return NextResponse.json({ error: "name zorunludur." }, { status: 400 });

    const existing = await prisma.expenseCategory.findFirst({ where: { institutionId: session.institutionId, name } });
    if (existing) return NextResponse.json({ error: "Bu kategori zaten var." }, { status: 409 });

    const category = await prisma.expenseCategory.create({ data: { institutionId: session.institutionId, name } });
    return NextResponse.json({ category: { id: category.id, name: category.name } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("expense_category_create_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/expense-categories", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/expense-categories", handlePost);
