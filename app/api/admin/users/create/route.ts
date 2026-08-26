import { NextRequest, NextResponse } from "next/server";
import type { AdminAuthorityLevel } from "@prisma/client";
import { AdminCreateError, createStudentAccount, createTeacherAccount, createAdminAccount } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

type CreateBody = {
  role?: "STUDENT" | "TEACHER" | "ADMIN";
  fullName?: string;
  nationalId?: string;
  // öğrenci
  branchId?: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  healthNote?: string;
  // öğretmen
  subject?: string;
  advisorBranchId?: string;
  // öğretmen + yönetici ortak
  mobilePhone?: string;
  email?: string;
  // yönetici
  title?: string;
  authorityLevel?: AdminAuthorityLevel;
};

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = (await request.json()) as CreateBody;
    const { role, fullName } = body;

    if (!role || !fullName?.trim()) {
      return NextResponse.json({ error: "role ve fullName zorunludur." }, { status: 400 });
    }

    if (role === "STUDENT") {
      const account = await createStudentAccount({
        institutionId: session.institutionId,
        actorId: session.sub,
        fullName,
        nationalId: body.nationalId ?? "",
        branchId: body.branchId ?? "",
        phone: body.phone ?? "",
        parentName: body.parentName ?? "",
        parentPhone: body.parentPhone ?? "",
        healthNote: body.healthNote,
      });
      return NextResponse.json({ id: account.id, role: "STUDENT", username: account.username, password: account.password }, { status: 201 });
    }

    if (role === "TEACHER") {
      const account = await createTeacherAccount({
        institutionId: session.institutionId,
        actorId: session.sub,
        fullName,
        nationalId: body.nationalId ?? "",
        subject: body.subject ?? "",
        mobilePhone: body.mobilePhone ?? "",
        email: body.email,
        advisorBranchId: body.advisorBranchId,
      });
      return NextResponse.json(
        { id: account.id, role: "TEACHER", username: account.username, password: account.password, institutionalCode: account.institutionalCode },
        { status: 201 }
      );
    }

    if (role === "ADMIN") {
      const account = await createAdminAccount({
        institutionId: session.institutionId,
        actorId: session.sub,
        fullName,
        title: body.title ?? "",
        mobilePhone: body.mobilePhone ?? "",
        email: body.email ?? "",
        authorityLevel: body.authorityLevel,
      });
      return NextResponse.json({ id: account.id, role: "ADMIN", username: account.username, password: account.password }, { status: 201 });
    }

    return NextResponse.json({ error: "Geçersiz role değeri." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error("admin_user_create_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/users/create", handlePost);
