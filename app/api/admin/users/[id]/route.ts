import { NextRequest, NextResponse } from "next/server";
import { getEditableStudent, getEditableTeacher, updateStudentAccount, updateTeacherAccount } from "@/lib/server/admin/update-user";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET: bir öğrenci/öğretmenin DÜZENLENEBİLİR ham alanlarını döner (bkz.
// components/principal/user-management/edit-user-modal.tsx) — bunu
// [id]/analytics/route.ts ile KARIŞTIRMAYIN, o türetilmiş performans
// verisi döner, bu ise formu doldurmak için ham kayıt alanlarını döner.
async function handleGet(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const role = request.nextUrl.searchParams.get("role");
    if (role === "STUDENT") {
      const student = await getEditableStudent(params.id, session.institutionId);
      return NextResponse.json({ student });
    }
    if (role === "TEACHER") {
      const teacher = await getEditableTeacher(params.id, session.institutionId);
      return NextResponse.json({
        teacher: { ...teacher, advisorBranchId: teacher.teachingBranches[0]?.id ?? "" },
      });
    }
    return NextResponse.json({ error: "role 'STUDENT' veya 'TEACHER' olmalı." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_user_edit_fetch_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

type PatchBody = {
  role?: "STUDENT" | "TEACHER";
  fullName?: string;
  branchId?: string;
  phone?: string;
  healthNote?: string;
  subject?: string;
  mobilePhone?: string;
  email?: string;
  advisorBranchId?: string;
};

async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = (await request.json()) as PatchBody;
    if (body.role === "STUDENT") {
      await updateStudentAccount({
        id: params.id,
        institutionId: session.institutionId,
        actorId: session.sub,
        fullName: body.fullName ?? "",
        branchId: body.branchId ?? "",
        phone: body.phone ?? "",
        healthNote: body.healthNote,
      });
      return NextResponse.json({ ok: true });
    }
    if (body.role === "TEACHER") {
      await updateTeacherAccount({
        id: params.id,
        institutionId: session.institutionId,
        actorId: session.sub,
        fullName: body.fullName ?? "",
        subject: body.subject ?? "",
        mobilePhone: body.mobilePhone ?? "",
        email: body.email,
        advisorBranchId: body.advisorBranchId,
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "role 'STUDENT' veya 'TEACHER' olmalı." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_user_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/users/[id]", handleGet);
export const PATCH = withApiLogging("PATCH /api/admin/users/[id]", handlePatch);
