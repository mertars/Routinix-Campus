import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/alumni — Mezun Gurur Tablosu, kurumdaki HERKESE (yönetici,
// öğretmen, öğrenci, veli) açık salt-okunur bir liste — rol kısıtlaması
// YOK, sadece aynı kurumla sınırlı. Öğrencinin kendi taleplerinin durumunu
// görebilmesi için bkz. GET /api/mentor-requests.
async function handleGet() {
  try {
    const session = await requireSession();
    const profiles = await prisma.alumniProfile.findMany({
      where: { student: { institutionId: session.institutionId } },
      include: { student: { select: { firstName: true, lastName: true } } },
      orderBy: { graduationYear: "desc" },
    });
    return NextResponse.json({
      profiles: profiles.map((p) => ({
        id: p.id,
        name: `${p.student.firstName} ${p.student.lastName}`,
        graduationYear: p.graduationYear,
        highSchoolRank: p.highSchoolRank,
        admittedTo: p.admittedTo,
        examScope: p.examScope,
        isMentor: p.isMentor,
        mentorNote: p.mentorNote,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("alumni_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/alumni", handleGet);
