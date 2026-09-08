import { describe, it, expect } from "vitest";
import { toFriendlyError, toFriendlyDbError } from "./prisma-errors";

describe("toFriendlyError", () => {
  it("benzersizlik ihlalini alan adıyla anlatır", () => {
    const r = toFriendlyError({ code: "P2002", meta: { target: ["nationalId"] } });
    expect(r?.status).toBe(409);
    expect(r?.message).toContain("nationalId");
  });

  it("kayıt bulunamadıyı 404 yapar", () => {
    expect(toFriendlyError({ code: "P2025" })?.status).toBe(404);
  });

  it("tanımadığı kodda null döner — çağıran kendi hatasını versin", () => {
    expect(toFriendlyError({ code: "P9999" })).toBeNull();
    expect(toFriendlyError(new Error("düz hata"))).toBeNull();
  });
});

describe("toFriendlyDbError", () => {
  // Testte gerçekten görülen hata: ödeme kaydı olan öğrenci silinmek
  // istenince Postgres RESTRICT ihlali fırlatıyor ve müdür yalnızca
  // "Beklenmeyen hata" görüyordu.
  const restrict = new Error(
    'update or delete on table "Student" violates RESTRICT setting of foreign key constraint "Installment_studentId_fkey" on table "Installment"'
  );

  it("bağlı kaydın TÜRÜNÜ söyler ve ne yapılacağını önerir", () => {
    const r = toFriendlyDbError(restrict, { deleting: "Öğrenci" });
    expect(r?.status).toBe(409);
    expect(r?.message).toContain("taksit planı");
    expect(r?.message).toContain("pasifleştirin");
    expect(r?.message).toContain("Öğrenci");
  });

  it("tanımadığı tabloda da genel ama anlaşılır bir mesaj verir", () => {
    const r = toFriendlyDbError(
      new Error('violates RESTRICT setting of foreign key constraint "Foo_barId_fkey" on table "Foo"')
    );
    expect(r?.status).toBe(409);
    expect(r?.message).toContain("pasifleştirin");
  });

  it("ilgisiz hatada null döner", () => {
    expect(toFriendlyDbError(new Error("ağ hatası"))).toBeNull();
  });
});

describe("toFriendlyDbError — geçersiz alan (PrismaClientValidationError)", () => {
  // Gerçek metin ölçülerek alındı: geçersiz bir enum değeri gönderildiğinde
  // Prisma kod TAŞIMAYAN bir hata fırlatıyor, bu yüzden tüm uçlarda 500'e
  // düşüyordu. Mesaj sorgunun tamamını yankılıyor — sızdırılmamalı.
  const invalidEnum = Object.assign(
    new Error(
      'Invalid `prisma.announcement.create()` invocation in\n/Users/mert/Desktop/routinixcampus/app/api/x/route.ts:7:31\n\n  data: {\n    institutionId: "cmtsoiezq0000jllpjbp8uvtq",\n    category: "SAÇMA_DEĞER",\n  }\n\nInvalid value for argument `category`. Expected AnnouncementCategory.'
    ),
    { name: "PrismaClientValidationError" }
  );

  it("500 değil 400 döner — kusur istekte", () => {
    expect(toFriendlyDbError(invalidEnum)?.status).toBe(400);
  });

  it("alan adını ve GEÇERLİ DEĞERLERİ söyler", () => {
    const m = toFriendlyDbError(invalidEnum)!.message;
    expect(m).toContain("category");
    expect(m).toContain("GENERAL");
    expect(m).toContain("EMERGENCY");
  });

  it("sorgu içeriğini ve sunucu dosya yolunu SIZDIRMAZ", () => {
    const m = toFriendlyDbError(invalidEnum)!.message;
    expect(m).not.toContain("cmtsoiezq0000jllpjbp8uvtq");
    expect(m).not.toContain("SAÇMA_DEĞER");
    expect(m).not.toContain("/Users/");
    expect(m).not.toContain("prisma.announcement");
  });

  it("eksik zorunlu alanı adıyla söyler", () => {
    const err = Object.assign(new Error("Argument `title` is missing."), {
      name: "PrismaClientValidationError",
    });
    const r = toFriendlyDbError(err);
    expect(r?.status).toBe(400);
    expect(r?.message).toContain("title");
  });

  it("tanımadığı doğrulama hatasında bile 500'e düşmez", () => {
    const err = Object.assign(new Error("bambaşka bir doğrulama metni"), {
      name: "PrismaClientValidationError",
    });
    expect(toFriendlyDbError(err)?.status).toBe(400);
    expect(toFriendlyDbError(err)?.message).not.toContain("bambaşka");
  });
});
