import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RELATIONSHIP_LABEL: Record<string, string> = { MOTHER: "Anne", FATHER: "Baba", GUARDIAN: "Vasi" };

// GET /api/exams/send-targets/[studentId] — bkz. xray/send-targets AYNI
// şekil, tek fark rol kapsamı: Ölçme Değerlendirme'de teacher+principal
// EŞİT yetkili (bkz. modülün genel gerekçesi) — Röntgen'deki uç BİLEREK
// sadece principal'e açık kalsın diye burası AYRI tutuldu, o davranışı
// değiştirmeden.
async function handleGet(_request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const student = await prisma.student.findUnique({
      where: { id: params.studentId },
      select: {
        institutionId: true,
        firstName: true,
        lastName: true,
        phone: true,
        parents: { select: { parent: { select: { id: true, firstName: true, lastName: true, mobilePhone: true, relationship: true } } } },
      },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    return NextResponse.json({
      studentName: `${student.firstName} ${student.lastName}`,
      studentPhone: student.phone,
      parents: student.parents.map((link) => ({
        id: link.parent.id,
        name: `${link.parent.firstName} ${link.parent.lastName}`,
        phone: link.parent.mobilePhone,
        relationshipLabel: RELATIONSHIP_LABEL[link.parent.relationship] ?? link.parent.relationship,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_send_targets_failed", { studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/send-targets/[studentId]", handleGet);
