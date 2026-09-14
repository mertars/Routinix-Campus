import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getObjectStream } from "@/lib/server/r2";
import { requireSession, type Session } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/files/<r2-anahtarı> — soru/materyal/gider eki dosyalarını KENDİ
// alan adımızdan sunar (R2'den okuyup akıtarak).
//
// ⚠️ NEDEN BÖYLE: dosyalar önce R2'nin herkese açık adresinden
// (pub-xxx.r2.dev) veriliyordu ve hiç görünmüyordu — hem tarayıcı CSP'si o
// alan adını engelliyordu hem de kovanın herkese açık erişimi
// doğrulanamıyordu. Proxy ikisini de gereksiz kılar ve dosyaları oturum
// arkasına alır.
//
// ⚠️ GÜVENLİK (2026-09-15 denetimi): bu uç ÖNCE yalnızca `requireSession()`
// yapıyordu — yani kimliği doğrulanmış HERKES, eline geçen bir anahtarla
// BAŞKA BİR KURUMUN dosyasını indirebiliyordu; dahası bir öğrenci/veli
// `expenses/<uuid>` ile kurumun GİDER FATURASINI çekebiliyordu. Anahtarlar
// rastgele UUID olduğu için tahmin edilemez ama paylaşılan/geçmişte kalmış
// bir bağlantı sızdırmaya yeterdi. Artık her dosya, SAHİBİ olan satıra
// çözülür ve kurum + rol kontrolünden geçer.

/** Sadece bu ön ekler sunulur — kovadaki başka bir şeye erişim yok. */
const ALLOWED_PREFIXES = ["questions/", "materials/", "expenses/"] as const;

/**
 * Anahtarın sahibi olan satırı bulup erişime izin verilip verilmeyeceğini
 * söyler. Dosya URL'si veritabanında `/api/files/<key>` biçiminde saklanır
 * (bkz. lib/server/r2.ts > getPublicUrl).
 */
async function isAllowed(session: Session, key: string): Promise<boolean> {
  const url = `/api/files/${key}`;

  if (key.startsWith("expenses/")) {
    // Gider ekleri kurumun mali belgesidir — SADECE yönetici.
    if (session.role !== "ADMIN") return false;
    const expense = await prisma.expense.findFirst({
      where: { attachmentUrl: url },
      select: { institutionId: true },
    });
    return !!expense && expense.institutionId === session.institutionId;
  }

  if (key.startsWith("materials/")) {
    const material = await prisma.teacherMaterial.findFirst({
      where: { fileUrl: url },
      select: { branch: { select: { institutionId: true } } },
    });
    return !!material && material.branch.institutionId === session.institutionId;
  }

  // questions/ — öğrencinin sorduğu soru, öğretmenin yanıtı ya da
  // pop-quiz/soru bankası görseli olabilir; hepsi kurum içi ders içeriği.
  const [question, bank, quizQuestion] = await Promise.all([
    prisma.question.findFirst({
      where: { OR: [{ imageUrl: url }, { answerImageUrl: url }] },
      select: { teacher: { select: { institutionId: true } } },
    }),
    prisma.quizBankQuestion.findFirst({
      where: { imageUrl: url },
      select: { teacher: { select: { institutionId: true } } },
    }),
    prisma.quizQuestion.findFirst({
      where: { imageUrl: url },
      select: { quiz: { select: { teacher: { select: { institutionId: true } } } } },
    }),
  ]);

  const owner =
    question?.teacher.institutionId ??
    bank?.teacher.institutionId ??
    quizQuestion?.quiz.teacher.institutionId ??
    null;
  return owner === session.institutionId;
}

async function handleGet(_request: NextRequest, { params }: { params: { key: string[] } }) {
  const key = (params.key ?? []).join("/");
  try {
    const session = await requireSession();

    // Yol gezinme (..) ve izinsiz ön ek koruması.
    if (!key || key.includes("..") || !ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
    }

    // ⚠️ Sahiplik/kurum kontrolü — reddedilirse 404 (403 DEĞİL): 403,
    // "dosya var ama senin değil" diyerek başka kurumun dosyasının
    // VARLIĞINI sızdırırdı (session-guard'daki aynı gerekçe).
    if (!(await isAllowed(session, key))) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
    }

    const object = await getObjectStream(key);
    return new NextResponse(object.body, {
      headers: {
        "Content-Type": object.contentType,
        ...(object.contentLength ? { "Content-Length": String(object.contentLength) } : {}),
        // Dosya adları rastgele UUID; içerik asla değişmez. `private`:
        // paylaşılan bir CDN'de değil, yalnızca kullanıcının tarayıcısında.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.warn("file_serve_failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  }
}

export const GET = handleGet;
