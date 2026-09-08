import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { ensureDefaultCategories } from "@/lib/server/exams/categories";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/exam-categories — kurumun deneme klasörleri + her birindeki
// deneme sayısı. Varsayılan set ilk çağrıda kurulur (bkz.
// ensureDefaultCategories — yalnızca bir kez).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    await ensureDefaultCategories(session.institutionId);

    const [categories, examCounts, groupCount, uncategorizedCount] = await Promise.all([
      prisma.examCategory.findMany({ where: { institutionId: session.institutionId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      prisma.exam.groupBy({ by: ["categoryId"], where: { institutionId: session.institutionId, categoryId: { not: null } }, _count: { _all: true } }),
      prisma.examGroup.count({ where: { institutionId: session.institutionId } }),
      prisma.exam.count({ where: { institutionId: session.institutionId, categoryId: null } }),
    ]);

    const countByCategory = new Map(examCounts.map((c) => [c.categoryId, c._count._all]));

    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        sortOrder: c.sortOrder,
        // YKS klasörü tekil deneme değil, TYT+AYT eşleşmesi sayar.
        examCount: c.kind === "YKS_PAIR" ? groupCount : (countByCategory.get(c.id) ?? 0),
      })),
      uncategorizedCount,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("exam_categories_list_failed", error);
  }
}

// POST /api/exam-categories — { name }. Kuruma özel yeni klasör. Yeni
// kategoriler listenin SONUNA eklenir (mevcut en yüksek sortOrder + 10).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Klasör adı zorunludur." }, { status: 400 });
    if (name.length > 40) return NextResponse.json({ error: "Klasör adı çok uzun (en fazla 40 karakter)." }, { status: 400 });

    const last = await prisma.examCategory.findFirst({
      where: { institutionId: session.institutionId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const category = await prisma.examCategory.create({
      data: { institutionId: session.institutionId, name, sortOrder: (last?.sortOrder ?? 0) + 10 },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Bu isimde bir klasör zaten var." }, { status: 409 });
    }
    return apiFailure("exam_category_create_failed", error);
  }
}

export const GET = withApiLogging("GET /api/exam-categories", handleGet);
export const POST = withApiLogging("POST /api/exam-categories", handlePost);
