import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// Statik optimizasyona (build-zamanı önbellekleme) girmesin — öğretmen
// listesi her istek anında veritabanından okunmalı.
export const dynamic = "force-dynamic";

// GET /api/teachers — öğrencinin "Soru Sor"/"Birebir Etüt" öğretmen
// seçicilerini besler. ?branchId= verilirse SADECE o şubede ders veren
// öğretmenler döner (teachingBranches — bkz. prisma/schema.prisma).
// ?excludeSubject= ile belirli bir branş (örn. "Rehberlik") dışlanabilir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const branchId = request.nextUrl.searchParams.get("branchId");
    const excludeSubject = request.nextUrl.searchParams.get("excludeSubject");
    const subject = request.nextUrl.searchParams.get("subject");

    const teachers = await prisma.teacher.findMany({
      where: {
        institutionId: session.institutionId,
        ...(branchId ? { teachingBranches: { some: { id: branchId } } } : {}),
        ...(excludeSubject ? { subject: { not: excludeSubject } } : {}),
        ...(subject ? { subject } : {}),
      },
      select: { id: true, firstName: true, lastName: true, subject: true },
      orderBy: [{ subject: "asc" }, { firstName: "asc" }],
    });
    return NextResponse.json({ teachers });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teachers_list_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/teachers", handleGet);
