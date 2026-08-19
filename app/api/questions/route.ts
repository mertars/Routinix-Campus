import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { saveQuestionImage, MAX_QUESTION_IMAGE_BYTES } from "@/lib/server/uploads/save-question-image";
import { notifyTeacherBySms } from "@/lib/server/notifications/teacher-sms-queue";
import { withApiLogging, logger } from "@/lib/logger";

// POST /api/questions — öğrenci, çözemediği bir sorunun fotoğrafını seçtiği
// öğretmene gönderir (multipart/form-data: studentId, teacherId, subject,
// studentNote?, image).
async function handlePost(request: NextRequest) {
  try {
    const formData = await request.formData();
    const studentId = formData.get("studentId");
    const teacherId = formData.get("teacherId");
    const subject = formData.get("subject");
    const studentNote = formData.get("studentNote");
    const image = formData.get("image");

    if (typeof studentId !== "string" || !studentId) {
      return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });
    }
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

    // studentId/teacherId ilişkisel bütünlüğünü baştan doğrula — yoksa ham
    // Prisma FK hatası yerine anlaşılır bir 404 döner (çakışan/geçersiz ID kontrolü).
    const [student, teacher] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, select: { id: true } }),
      prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true, mobilePhone: true } }),
    ]);
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    if (!teacher) return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });

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
    logger.error("question_create_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/questions?teacherId=...  veya  ?studentId=...  (biri zorunlu —
// aksi halde sistemdeki tüm soruların dışarı sızmasını engellemek için 400 döner)
async function handleGet(request: NextRequest) {
  try {
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    const studentId = request.nextUrl.searchParams.get("studentId");

    if (!teacherId && !studentId) {
      return NextResponse.json({ error: "teacherId veya studentId parametrelerinden biri zorunludur." }, { status: 400 });
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
    logger.error("questions_list_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/questions", handlePost);
export const GET = withApiLogging("GET /api/questions", handleGet);
