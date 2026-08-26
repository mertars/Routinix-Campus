import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/students?branchId=X  veya  ?branchIds=x,y,z — bir veya birden
// fazla şubenin tam öğrenci rosteri (Yoklama, Ödev Kontrol Matrisi, Öğretmen
// Röntgeni gibi sınıf-bazlı ekranları beslemek için). Öğretmen/yönetici içindir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const branchId = request.nextUrl.searchParams.get("branchId");
    const branchIdsParam = request.nextUrl.searchParams.get("branchIds");
    const branchIds = branchIdsParam
      ? branchIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
      : branchId
        ? [branchId]
        : [];
    if (branchIds.length === 0) {
      return NextResponse.json({ error: "branchId veya branchIds parametresi zorunludur." }, { status: 400 });
    }
    const students = await prisma.student.findMany({
      where: { branchId: { in: branchIds }, institutionId: session.institutionId },
      select: { id: true, firstName: true, lastName: true, branchId: true, branch: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return NextResponse.json({ students: students.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, branchId: s.branchId, branchName: s.branch.name })) });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("students_list_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/students", handleGet);
