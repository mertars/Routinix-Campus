import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import {
  requireSession,
  requireInstitution,
  assertTeacherOwnsStudent,
} from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { getStudent360 } from "@/lib/server/student-360/student-360";

export const dynamic = "force-dynamic";

// GET /api/students/[id]/360 — beş modülün o öğrenci hakkında bildiği her şey.
//
// Erişim: aynı kurumdaki yönetici, ya da o öğrenciye ders veren öğretmen.
// Öğrenci/veli buraya giremez — kendi panellerinde zaten kendi görünümleri
// var ve bu kart personel içindir.
//
// ⚠️ Öğretmene FİNANS DÖNMEZ. Ödeme Takip modülünün kendisi öğretmene
// kapalı; borcu bu karttan sızdırmak o kararı anlamsızlaştırırdı.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      select: { id: true, institutionId: true },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    // Kurum sınırı DAİMA önce — başka kurumun kaydı "yok" görünmeli.
    requireInstitution(session, student.institutionId);

    let includeFinance: boolean;
    if (session.role === "ADMIN") {
      includeFinance = true;
    } else if (session.role === "TEACHER") {
      await assertTeacherOwnsStudent(session.sub, student.id);
      includeFinance = false;
    } else {
      throw new AuthError("Bu işlem için yetkiniz yok.", "FORBIDDEN_ROLE", 403);
    }

    const data = await getStudent360(student.id, { includeFinance });
    if (!data) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("student_360_failed", error);
  }
}

export const GET = withApiLogging("GET /api/students/[id]/360", handleGet);
