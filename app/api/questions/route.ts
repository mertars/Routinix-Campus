import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { saveQuestionImage, MAX_QUESTION_IMAGE_BYTES } from "@/lib/server/uploads/save-question-image";
import { notifyTeacherBySms } from "@/lib/server/notifications/teacher-sms-queue";
import { requireSession, requireRole, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// POST /api/questions — öğrenci KENDİSİ, çözemediği bir sorunun fotoğrafını
// seçtiği öğretmene gönderir (multipart/form-data: teacherId, subject,
// studentNote?, image). studentId body'den değil oturumdan alınır.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "student");
    const studentId = session.sub;

    const formData = await request.formData();
    const teacherId = formData.get("teacherId");
    const subject = formData.get("subject");
    const studentNote = formData.get("studentNote");
    const image = formData.get("image");

    if (typeof teacherId !== "string" || !teacherId) {
      return NextResponse.json({ error: "teacherId zorunludur." }, { status: 400 });
    }
    if (typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json({ error: "subject zorunludur." }, { status: 400 });
    }
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Soru fotoğrafı zorunludur." }, { status: 400 });
    }
    if (!image.type.startsWith("image/")) {
      return NextResponse.json({ error: "Yalnızca görsel dosyaları yüklenebilir." }, { status: 400 });
    }
    if (image.size > MAX_QUESTION_IMAGE_BYTES) {
      return NextResponse.json({ error: "Görsel 8MB'dan büyük olamaz." }, { status: 400 });
    }

    // teacherId'nin AYNI kurumda gerçekten var olduğunu doğrula — yoksa ham
    // Prisma FK hatası yerine anlaşılır bir 404 döner (çakışan/geçersiz ID kontrolü).
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true, institutionId: true, mobilePhone: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }

    const imageUrl = await saveQuestionImage(image);

    const question = await prisma.question.create({
      data: {
        studentId,
        teacherId,
        subject: subject.trim(),
        imageUrl,
        studentNote: typeof studentNote === "string" && studentNote.trim() ? studentNote.trim() : null,
      },
      include: {
        student: { select: { firstName: true, lastName: true } },
        teacher: { select: { firstName: true, lastName: true, mobilePhone: true } },
      },
    });

    try {
      await notifyTeacherBySms(
        question.teacher.mobilePhone,
        `${question.student.firstName} ${question.student.lastName} size ${question.subject} dersinden yeni bir soru gönderdi.`
      );
    } catch (notifyError) {
      // Bildirim başarısız olsa bile soru zaten kaydedildi — kullanıcıya
      // hata göstermeye gerek yok, sadece logla.
      logger.warn("question_notify_failed", { questionId: question.id, error: notifyError instanceof Error ? notifyError.message : String(notifyError) });
    }

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("question_create_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/questions?teacherId=...  veya  ?studentId=...  (biri zorunlu —
// aksi halde sistemdeki tüm soruların dışarı sızmasını engellemek için 400 döner)
// teacherId: sadece o öğretmenin kendisi ya da yönetici. studentId: öğrencinin
// kendisi / danışman-branş öğretmeni / velisi / yönetici.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    const studentId = request.nextUrl.searchParams.get("studentId");

    if (!teacherId && !studentId) {
      return NextResponse.json({ error: "teacherId veya studentId parametrelerinden biri zorunludur." }, { status: 400 });
    }

    if (teacherId) {
      if (session.role === "TEACHER") {
        if (session.sub !== teacherId) throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
      } else {
        requireRole(session, "principal");
      }
      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
      if (!teacher || teacher.institutionId !== session.institutionId) {
        return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
      }
    } else {
      const student = await prisma.student.findUnique({ where: { id: studentId! }, select: { institutionId: true } });
      if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
      requireInstitution(session, student.institutionId);
      if (session.role === "STUDENT") assertOwnsSelf(session, studentId!);
      else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, studentId!);
      else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, studentId!);
    }

    const where = teacherId ? { teacherId } : { studentId: studentId! };

    const questions = await prisma.question.findMany({
      where,
      include: {
        student: { select: { firstName: true, lastName: true } },
        teacher: { select: { firstName: true, lastName: true, subject: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("questions_list_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/questions", handlePost);
export const GET = withApiLogging("GET /api/questions", handleGet);
