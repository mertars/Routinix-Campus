import { NextRequest, NextResponse } from "next/server";
import { saveQuestionImage, MAX_QUESTION_IMAGE_BYTES } from "@/lib/server/uploads/save-question-image";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// POST /api/uploads/question-image — multipart/form-data: image. Genel
// amaçlı görsel yükleme ucu — Pop-Quiz'in soru fotoğrafları (bkz.
// components/teacher/tabs/pop-quiz.tsx) VE Soru Bankası'na toplu ekleme
// (bkz. material-library.tsx) İKİSİ DE bunu kullanır; Soru Çözüm'ün
// kendi /api/questions'ı (öğrenci gönderimi, ayrı bir DB kaydı oluşturur)
// BİLEREK ayrı kalır — burası SADECE dosyayı kaydedip URL döner, hiçbir
// tabloya yazmaz.
//
// ⚠️ Pop-Quiz'in QuizQuestion/QuizBankQuestion.imageLabel alanı ESKİDEN
// sadece dosya adı METNİYDİ — gerçek görsel hiç yüklenmiyordu (bkz.
// prisma/schema.prisma > QuizBankQuestion yorumu). Bu uç o boşluğu
// kapatır — aynı gerçek yükleme yardımcısını (saveQuestionImage) kullanır.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "image (dosya) zorunludur." }, { status: 400 });
    }
    if (image.size > MAX_QUESTION_IMAGE_BYTES) {
      return NextResponse.json({ error: "Dosya çok büyük." }, { status: 400 });
    }

    const imageUrl = await saveQuestionImage(image);
    return NextResponse.json({ imageUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("question_image_upload_failed", error);
  }
}

export const POST = withApiLogging("POST /api/uploads/question-image", handlePost);
