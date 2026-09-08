import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { toFriendlyDbError } from "@/lib/server/prisma-errors";

// API uçlarının ORTAK son çaresi.
//
// Önceden her uç aynı iki satırı tekrarlıyordu: logla, "Beklenmeyen
// hata" + 500 dön. Sorun şuydu — hataların önemli bir kısmı aslında
// beklenen ve AÇIKLANABİLİR durumlardı (silinemeyen kayıt, geçersiz
// enum, benzersizlik ihlali); müdür ekranda sadece "Beklenmeyen hata"
// görüp ne yapacağını bilemiyordu.
//
// Buradaki tek değişiklik: 500'e düşmeden önce hatayı tanımaya çalış.
// Tanınırsa doğru durum kodu ve NE YAPILACAĞINI söyleyen bir mesaj
// döner; tanınmazsa davranış eskisiyle birebir aynıdır.
//
// `deleting` verilirse silme engeli mesajı özneyle kurulur:
// "Öğrenci silinemez: bağlı taksit planı var."
export function apiFailure(logKey: string, error: unknown, context?: { deleting?: string }): NextResponse {
  const friendly = toFriendlyDbError(error, context);
  const detail = error instanceof Error ? error.message : String(error);

  if (friendly) {
    // Bu bir sunucu arızası değil; uyarı seviyesinde loglanır ki
    // gerçek 500'ler log içinde kaybolmasın.
    logger.warn(logKey, { error: detail, status: friendly.status });
    return NextResponse.json({ error: friendly.message }, { status: friendly.status });
  }

  logger.error(logKey, { error: detail });
  return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
}
