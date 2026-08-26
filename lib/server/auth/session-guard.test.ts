import { describe, it, expect } from "vitest";
import { requireRole, requireInstitution, assertOwnsSelf, type Session } from "./session-guard";
import { AuthError } from "./errors";

// Bu testler SADECE saf, senkron guard fonksiyonlarını kapsar
// (requireRole/requireInstitution/assertOwnsSelf). assertTeacherOwnsStudent
// ve assertParentOwnsStudent gerçek bir Prisma sorgusu çalıştırdığı için
// birim test kapsamı dışıdır — o ikisi Playwright e2e'de (bkz. e2e/) gerçek
// bir veritabanına karşı dolaylı olarak doğrulanır.
function fakeSession(overrides: Partial<Session> = {}): Session {
  return {
    sub: "std_1",
    role: "STUDENT",
    phone: "5550000000",
    name: "Test Kullanıcı",
    institutionId: "inst_1",
    ...overrides,
  };
}

describe("requireRole", () => {
  it("oturumun rolü izin verilenler arasındaysa geçer", () => {
    expect(() => requireRole(fakeSession({ role: "TEACHER" }), "teacher")).not.toThrow();
  });

  it("birden fazla izin verilen rolden biri eşleşirse geçer", () => {
    expect(() => requireRole(fakeSession({ role: "ADMIN" }), "teacher", "principal")).not.toThrow();
  });

  it("rol eşleşmiyorsa FORBIDDEN_ROLE koduyla 403 fırlatır", () => {
    try {
      requireRole(fakeSession({ role: "STUDENT" }), "principal");
      expect.fail("requireRole hata fırlatmalıydı");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).code).toBe("FORBIDDEN_ROLE");
      expect((error as AuthError).status).toBe(403);
    }
  });
});

describe("requireInstitution", () => {
  it("kayıt aynı kuruma aitse geçer", () => {
    expect(() => requireInstitution(fakeSession({ institutionId: "inst_a" }), "inst_a")).not.toThrow();
  });

  // Kritik güvenlik davranışı: kurumlar-arası bir kayda erişim denemesi
  // 403 DEĞİL 404 döner — aksi halde "kayıt var ama erişemiyorsun" yanıtı
  // başka bir kurumun verisinin VARLIĞINI sızdırırdı.
  it("kayıt başka bir kuruma aitse NOT_FOUND koduyla 404 fırlatır (403 değil)", () => {
    try {
      requireInstitution(fakeSession({ institutionId: "inst_a" }), "inst_b");
      expect.fail("requireInstitution hata fırlatmalıydı");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).code).toBe("NOT_FOUND");
      expect((error as AuthError).status).toBe(404);
    }
  });
});

describe("assertOwnsSelf", () => {
  it("hedef id oturumun kendi id'siyse geçer", () => {
    expect(() => assertOwnsSelf(fakeSession({ sub: "std_1" }), "std_1")).not.toThrow();
  });

  it("hedef id başka bir kayıtsa NOT_FOUND koduyla 404 fırlatır (403 değil)", () => {
    try {
      assertOwnsSelf(fakeSession({ sub: "std_1" }), "std_2");
      expect.fail("assertOwnsSelf hata fırlatmalıydı");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).code).toBe("NOT_FOUND");
      expect((error as AuthError).status).toBe(404);
    }
  });
});
