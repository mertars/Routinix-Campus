import { NextRequest, NextResponse } from "next/server";
import { listStudentDirectory, listTeacherDirectory } from "@/lib/server/admin/directory";
import { requirePlatformSession, requirePlatformInstitution } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// app/api/admin/users/directory/route.ts'in platform-sahibi eşdeğeri.
async function handleGet(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePlatformSession();
    await requirePlatformInstitution(params.id);

    const role = request.nextUrl.searchParams.get("role") ?? "STUDENT";
    const query = request.nextUrl.searchParams.get("query")?.trim() ?? undefined;
    const branchId = request.nextUrl.searchParams.get("branchId") ?? undefined;
    const subject = request.nextUrl.searchParams.get("subject") ?? undefined;
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

    if (role === "TEACHER") {
      const teachers = await listTeacherDirectory(params.id, { query, subject, includeInactive });
      return NextResponse.json({ teachers, total: teachers.length });
    }

    const students = await listStudentDirectory(params.id, { query, branchId, includeInactive });
    return NextResponse.json({ students, total: students.length });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("platform_directory_failed", error);
  }
}

export const GET = withApiLogging("GET /api/platform/institutions/[id]/users/directory", handleGet);
