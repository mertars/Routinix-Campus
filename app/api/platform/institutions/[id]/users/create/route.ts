import { NextRequest, NextResponse } from "next/server";
import type { AdminAuthorityLevel } from "@prisma/client";
import { AdminCreateError, createStudentAccount, createTeacherAccount, createAdminAccount } from "@/lib/server/admin/create-user";
import { requirePlatformSession, requirePlatformInstitution } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// app/api/admin/users/create/route.ts'in platform-sahibi eşdeğeri — kurum
// yöneticisine hiç giriş yapmadan, seçilen KURUM için tek tek kullanıcı
// oluşturur. AYNI lib/server/admin/create-user.ts fonksiyonlarını çağırır.
type CreateBody = {
  role?: "STUDENT" | "TEACHER" | "ADMIN";
  fullName?: string;
  nationalId?: string;
  branchId?: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  healthNote?: string;
  subject?: string;
  advisorBranchId?: string;
  mobilePhone?: string;
  email?: string;
  title?: string;
  authorityLevel?: AdminAuthorityLevel;
};

async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePlatformSession();
    await requirePlatformInstitution(params.id);

    const body = (await request.json()) as CreateBody;
    const { role, fullName } = body;

    if (!role || !fullName?.trim()) {
      return NextResponse.json({ error: "role ve fullName zorunludur." }, { status: 400 });
    }

    if (role === "STUDENT") {
      const account = await createStudentAccount({
        institutionId: params.id,
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
        institutionId: params.id,
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
        institutionId: params.id,
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
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("platform_user_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/platform/institutions/[id]/users/create", handlePost);
