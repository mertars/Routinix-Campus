// Prisma/veritabanı kısıt hatalarını KULLANICININ ANLAYACAĞI yanıtlara
// çevirir.
//
// Testte müdür, ödeme kaydı olan bir öğrenciyi silmeye çalıştığında
// yalnızca "Beklenmeyen hata" gördü. Oysa engelin sebebi belliydi ve
// doğru davranış buydu (mali geçmiş silinmemeli) — eksik olan tek şey
// bunu SÖYLEMEKTİ. Aynı sınıf hata birkaç uçta daha var: geçersiz bir
// enum değeri 400 yerine 500 dönüyordu.
//
// Buradaki eşleme sadece "hangi kural çiğnendi"yi söyler; hangi kaydın
// neden korunduğu gibi alana özgü açıklamalar çağıran tarafta verilir
// (bkz. describeForeignKey kullanımı).

import { $Enums } from "@prisma/client";

type PrismaLikeError = { code?: string; meta?: Record<string, unknown>; message?: string; name?: string };

export function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as PrismaLikeError).code;
  return typeof code === "string" ? code : null;
}

export type FriendlyError = { message: string; status: number };

// Bir kaydın hangi tabloya bağlı olduğu yüzünden silinemediğini,
// müdürün tanıdığı isimlerle anlatır.
const RELATION_LABELS: Record<string, string> = {
  Installment: "taksit planı",
  Payment: "tahsilat kaydı",
  AttendanceRecord: "yoklama kaydı",
  ExamNetResult: "deneme sonucu",
  StudentContract: "sözleşmesi",
  GuidanceNote: "rehberlik notu",
  HomeworkSubmission: "ödev kaydı",
  LessonSlot: "ders programı kaydı",
  StudentEnrollment: "kayıt dönemi",
  PayrollItem: "bordro kaydı",
  StaffAdvance: "avans kaydı",
};

function relationFromMessage(message: string): string | null {
  // Postgres metni ŞÖYLEDİR:
  //   update or delete on table "Student" violates RESTRICT setting of
  //   foreign key constraint "Installment_studentId_fkey" on table "Installment"
  //
  // ⚠️ Aranan tablo SİLİNEN değil, BAĞLI olandır. `on table "..."`
  // deseni metinde İKİ KEZ geçer ve ilki silinen tablodur — bu yüzden
  // önce KISIT ADINDAN ("Installment_studentId_fkey") okunur, ancak o
  // bulunamazsa SON `on table` eşleşmesine düşülür.
  const byConstraint = message.match(/"([A-Za-z]+)_[A-Za-z]+_fkey"/);
  if (byConstraint?.[1]) return RELATION_LABELS[byConstraint[1]] ?? null;

  const allTables = [...message.matchAll(/on table "([A-Za-z]+)"/g)];
  const last = allTables.at(-1)?.[1];
  return last ? (RELATION_LABELS[last] ?? null) : null;
}

// Bilinen bir kısıt hatasıysa anlaşılır bir yanıt döner; değilse null
// (çağıran taraf kendi genel hatasını verir).
export function toFriendlyError(error: unknown, context?: { deleting?: string }): FriendlyError | null {
  const code = prismaErrorCode(error);
  if (!code) return null;
  const message = (error as PrismaLikeError).message ?? "";

  switch (code) {
    case "P2002": {
      const target = (error as PrismaLikeError).meta?.target;
      const fields = Array.isArray(target) ? target.join(", ") : typeof target === "string" ? target : null;
      return {
        message: fields ? `Bu kayıt zaten var (benzersiz olması gereken alan: ${fields}).` : "Bu kayıt zaten var.",
        status: 409,
      };
    }
    case "P2003":
    case "P2014": {
      const relation = relationFromMessage(message);
      const what = context?.deleting ?? "Bu kayıt";
      return {
        message: relation
          ? `${what} silinemez: bağlı ${relation} var. Silmek yerine pasifleştirin — geçmiş kayıtlar korunur.`
          : `${what} silinemez: buna bağlı başka kayıtlar var. Silmek yerine pasifleştirin.`,
        status: 409,
      };
    }
    case "P2025":
      return { message: "Kayıt bulunamadı.", status: 404 };
    default:
      return null;
  }
}

// Bir enum tipinin geçerli değerleri. Prisma tüm enum'ları çalışma
// anında da dışa verdiği için (41 tane) bunları route başına elle
// yazmaya gerek yok — hata mesajı "Expected AnnouncementCategory"
// dediğinde listeyi buradan okuyup kullanıcıya gösterebiliyoruz.
function enumValues(typeName: string): string[] | null {
  const table = $Enums as unknown as Record<string, Record<string, string> | undefined>;
  const found = table[typeName];
  return found ? Object.values(found) : null;
}

// Geçersiz/eksik alan hataları (PrismaClientValidationError).
//
// ⚠️ Bu hatanın message'ı SORGUNUN TAMAMINI yankılar — gönderilen
// değerler ve sunucudaki dosya yolu dahil. Bu yüzden metin İSTEMCİYE
// ASLA olduğu gibi dönmez; yalnızca alan adı ve beklenen tip çıkarılır.
function toValidationError(error: unknown): FriendlyError | null {
  const err = error as PrismaLikeError;
  if (err?.name !== "PrismaClientValidationError") return null;
  const message = err.message ?? "";

  const invalid = message.match(/Invalid value for argument `(\w+)`(?:\.\s*Expected (\w+))?/);
  if (invalid) {
    const field = invalid[1];
    const values = invalid[2] ? enumValues(invalid[2]) : null;
    return {
      message: values?.length
        ? `"${field}" alanı geçersiz. Geçerli değerler: ${values.join(", ")}`
        : `"${field}" alanına geçersiz bir değer gönderildi.`,
      status: 400,
    };
  }

  const missing = message.match(/Argument `(\w+)` is missing/);
  if (missing) return { message: `"${missing[1]}" alanı zorunludur.`, status: 400 };

  const unknown = message.match(/Unknown argument `(\w+)`/);
  if (unknown) return { message: `"${unknown[1]}" alanı tanınmıyor.`, status: 400 };

  // Tanınmayan bir doğrulama hatası: yine de 500 değil 400 — kusur
  // istekte, sunucuda değil. Ham metin sızdırılmaz.
  return { message: "Gönderilen veri geçersiz.", status: 400 };
}

// Ham veritabanı hatalarında (Prisma kodu taşımayan, örn. RESTRICT
// ihlali doğrudan Postgres'ten geldiğinde) metinden anlam çıkarır.
export function toFriendlyDbError(error: unknown, context?: { deleting?: string }): FriendlyError | null {
  const direct = toFriendlyError(error, context);
  if (direct) return direct;

  const validation = toValidationError(error);
  if (validation) return validation;

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("violates RESTRICT setting of foreign key") || message.includes("foreign key constraint")) {
    const relation = relationFromMessage(message);
    const what = context?.deleting ?? "Bu kayıt";
    return {
      message: relation
        ? `${what} silinemez: bağlı ${relation} var. Silmek yerine pasifleştirin — geçmiş kayıtlar korunur.`
        : `${what} silinemez: buna bağlı başka kayıtlar var. Silmek yerine pasifleştirin.`,
      status: 409,
    };
  }
  return null;
}
