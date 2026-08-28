import { NextRequest, NextResponse } from "next/server";
import { listStudentDirectory, listTeacherDirectory } from "@/lib/server/admin/directory";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/admin/users/directory?role=STUDENT|TEACHER&query=&branchId=&subject=&includeInactive=1
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const role = request.nextUrl.searchParams.get("role") ?? "STUDENT";
    const query = request.nextUrl.searchParams.get("query")?.trim() ?? undefined;
    const branchId = request.nextUrl.searchParams.get("branchId") ?? undefined;
    const subject = request.nextUrl.searchParams.get("subject") ?? undefined;
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

    if (role === "TEACHER") {
      const teachers = await listTeacherDirectory(session.institutionId, { query, subject, includeInactive });
      return NextResponse.json({ teachers, total: teachers.length });
    }

    const students = await listStudentDirectory(session.institutionId, { query, branchId, includeInactive });
    return NextResponse.json({ students, total: students.length });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_directory_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/users/directory", handleGet);
