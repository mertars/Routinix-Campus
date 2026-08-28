import { NextRequest, NextResponse } from "next/server";
import { listAlumniProfiles, createAlumniProfile } from "@/lib/server/admin/alumni";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET: yönetici panelindeki mezun listesi (düzenleme amaçlı) — herkese açık
// gurur tablosu görünümü için bkz. GET /api/alumni.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const profiles = await listAlumniProfiles(session.institutionId);
    return NextResponse.json({ profiles });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_alumni_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const body = (await request.json()) as {
      studentId?: string;
      graduationYear?: number;
      highSchoolRank?: string;
      admittedTo?: string;
      examScope?: "YKS" | "LGS";
      isMentor?: boolean;
      mentorNote?: string;
      contactPhone?: string;
    };
    const profile = await createAlumniProfile({
      institutionId: session.institutionId,
      actorId: session.sub,
      studentId: body.studentId ?? "",
      graduationYear: Number(body.graduationYear),
      highSchoolRank: body.highSchoolRank,
      admittedTo: body.admittedTo ?? "",
      examScope: body.examScope === "LGS" ? "LGS" : "YKS",
      isMentor: !!body.isMentor,
      mentorNote: body.mentorNote,
      contactPhone: body.contactPhone,
    });
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_alumni_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/alumni", handleGet);
export const POST = withApiLogging("POST /api/admin/alumni", handlePost);
