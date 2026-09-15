import { Prisma } from "@prisma/client";
import { currentPreview } from "@/lib/server/preview/read-only";

// ----------------------------------------------------------------------------
// ÖNİZLEME YAZMA KİLİDİ (2. katman) — bkz. lib/server/preview/read-only.ts
// üstündeki iki katman açıklaması.
//
// Birinci katman (withApiLogging) HTTP yöntemine bakar; bu katman İŞE bakar.
// Yakaladığı gerçek boşluk: "GET ama içinde yazma yapan uç" (son görülme
// zamanı damgalamak, tembel kayıt oluşturmak gibi) — yöntem kontrolünden
// geçer ama veri değiştirir. Burada, önizleme kapsamındaysa, sorgu
// veritabanına HİÇ ULAŞMADAN reddedilir.
//
// ⚠️ Zincirde EN BAŞTA uygulanır (bkz. lib/server/prisma.ts) — böylece
// deleteArchive'ın arşiv yazması da dahil, aşağıdaki HER katmanın yazma
// çağrısı bu kilitten geçer.
// ----------------------------------------------------------------------------

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

export class PreviewReadOnlyError extends Error {
  readonly code = "PREVIEW_READ_ONLY";
  constructor(model: string | undefined, operation: string) {
    super(`Önizleme oturumu salt okunurdur — ${model ?? "?"}.${operation} reddedildi.`);
    this.name = "PreviewReadOnlyError";
  }
}

export const previewReadOnlyGuard = Prisma.defineExtension((client) =>
  client.$extends({
    name: "previewReadOnlyGuard",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (WRITE_OPERATIONS.has(operation) && currentPreview()) {
            throw new PreviewReadOnlyError(model, operation);
          }
          return query(args);
        },
      },
    },
  })
);
