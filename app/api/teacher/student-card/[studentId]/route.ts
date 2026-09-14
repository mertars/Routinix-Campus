import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole, assertTeacherOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { getTeacherStudentCard } from "@/lib/server/student-360/teacher-student-card";

export const dynamic = "force-dynamic";

// GET /api/teacher/student-card/[studentId] — öğretmenin KENDİ DERSİ
// açısından öğrenci kartı.
//
// ⚠️ /api/student-360 ile karıştırma: o kart kurum geneli yönetici
// görüşüdür (finans dahil). Bu uç öğretmene ÖZEL ve dersiyle SINIRLI —
// finans hiç hesaplanmaz (bkz. servis dosyasındaki gizlilik notu).
//
// Yetki: yalnızca gerçekten o öğrencinin dersine giren öğretmen
// (assertTeacherOwnsStudent — danışmanlık / şubede ders verme).
async function handleGet(_request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    await assertTeacherOwnsStudent(session.sub, params.studentId);

    const card = await getTeacherStudentCard(session.sub, params.studentId);
    if (!card) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    return NextResponse.json({ card });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("teacher_student_card_failed", error);
  }
}

export const GET = withApiLogging("GET /api/teacher/student-card/[studentId]", handleGet);
