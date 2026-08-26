import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/admin/users/directory?role=STUDENT|TEACHER&query=&branchId=&subject=
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const role = request.nextUrl.searchParams.get("role") ?? "STUDENT";
    const query = request.nextUrl.searchParams.get("query")?.trim();
    const branchId = request.nextUrl.searchParams.get("branchId");
    const subject = request.nextUrl.searchParams.get("subject");

    if (role === "TEACHER") {
      const teachers = await prisma.teacher.findMany({
        where: {
          institutionId: session.institutionId,
          subject: subject || undefined,
          OR: query
            ? [
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } },
                { institutionalCode: { contains: query, mode: "insensitive" } },
              ]
            : undefined,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          subject: true,
          mobilePhone: true,
          institutionalCode: true,
          advisorBranches: { select: { name: true } },
        },
        orderBy: [{ firstName: "asc" }],
      });
      return NextResponse.json({
        teachers: teachers.map((t) => ({
          id: t.id,
          firstName: t.firstName,
          lastName: t.lastName,
          subject: t.subject,
          mobilePhone: t.mobilePhone,
          institutionalCode: t.institutionalCode,
          branchNames: t.advisorBranches.map((b) => b.name),
        })),
        total: teachers.length,
      });
    }

    const students = await prisma.student.findMany({
      where: {
        institutionId: session.institutionId,
        branchId: branchId || undefined,
        OR: query
          ? [{ firstName: { contains: query, mode: "insensitive" } }, { lastName: { contains: query, mode: "insensitive" } }, { studentNumber: { contains: query, mode: "insensitive" } }]
          : undefined,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentNumber: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ firstName: "asc" }],
    });

    return NextResponse.json({
      students: students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        studentNumber: s.studentNumber,
        branchId: s.branch.id,
        branchName: s.branch.name,
      })),
      total: students.length,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_directory_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/users/directory", handleGet);
