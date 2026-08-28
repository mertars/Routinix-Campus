import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { onboardInstitution } from "@/lib/server/platform/onboard-institution";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requirePlatformSession } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET: platform sahibinin gördüğü TEK liste — tüm kurumlar + öğrenci sayısı.
// Bu, mevcut requireSession/requireInstitution modelinin (bkz.
// lib/server/auth/session-guard.ts) BİLEREK dışındadır: kurum-scope'lu
// hiçbir route buraya erişemez, platform oturumu da kurum-scope'lu hiçbir
// route'a erişemez (bkz. app/api/platform/login > ayrı cookie/JWT).
async function handleGet() {
  try {
    await requirePlatformSession();
    const institutions = await prisma.institution.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        // Pasifleştirilmiş (bkz. Student/Teacher.isActive) öğrenci/öğretmenler
        // burada sayılmaz — bkz. institutions/[id]/route.ts'teki aynı gerekçe,
        // bu liste kurulum ekranındaki AYNI ücretlendirme sayısını gösterir.
        _count: { select: { students: { where: { isActive: true } }, teachers: { where: { isActive: true } }, branches: true } },
      },
    });
    return NextResponse.json({
      institutions: institutions.map((i) => ({
        id: i.id,
        name: i.name,
        slug: i.slug,
        isActive: i.isActive,
        createdAt: i.createdAt,
        studentCount: i._count.students,
        teacherCount: i._count.teachers,
        branchCount: i._count.branches,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("platform_institutions_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

type CreateBody = { name?: string; adminName?: string; adminTitle?: string; adminPhone?: string; adminEmail?: string };

async function handlePost(request: NextRequest) {
  try {
    const session = await requirePlatformSession();
    const body = (await request.json()) as CreateBody;

    const { institution, admin } = await onboardInstitution({
      name: body.name ?? "",
      actorId: session.sub,
      adminName: body.adminName ?? "",
      adminTitle: body.adminTitle ?? "",
      adminPhone: body.adminPhone ?? "",
      adminEmail: body.adminEmail ?? "",
    });

    return NextResponse.json(
      {
        institution: { id: institution.id, name: institution.name, slug: institution.slug },
        admin: { username: admin.username, password: admin.password },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("platform_institution_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/platform/institutions", handleGet);
export const POST = withApiLogging("POST /api/platform/institutions", handlePost);
