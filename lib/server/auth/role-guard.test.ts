import { describe, it, expect } from "vitest";
import { assertRoleMatches } from "./role-guard";
import { AuthError } from "./errors";

describe("assertRoleMatches", () => {
  it("expectedRole verilmemişse (login sayfası rol seçmeden geldiğinde) kontrolü atlar", () => {
    expect(() => assertRoleMatches("TEACHER", undefined)).not.toThrow();
    expect(() => assertRoleMatches("TEACHER", null)).not.toThrow();
  });

  it("hesabın gerçek rolü beklenen rolle eşleşiyorsa geçer", () => {
    expect(() => assertRoleMatches("TEACHER", "teacher")).not.toThrow();
    expect(() => assertRoleMatches("STUDENT", "student")).not.toThrow();
    expect(() => assertRoleMatches("PARENT", "parent")).not.toThrow();
  });

  // Regresyon testi: ADMIN -> "principal" eşlemesi bu oturumda bulunup
  // düzeltilen gerçek bir prod hatasıydı (her yönetici girişini
  // ROLE_MISMATCH ile reddediyordu). ROLE_ID_BY_AUTH_ROLE üzerinden tek bir
  // kaynaktan geliyor olması bu testin bir daha asla kırılmamasını sağlar.
  it("ADMIN hesabı 'principal' beklenen rolüyle eşleşir", () => {
    expect(() => assertRoleMatches("ADMIN", "principal")).not.toThrow();
  });

  it("rol uyuşmazlığında ROLE_MISMATCH koduyla 403 AuthError fırlatır", () => {
    try {
      assertRoleMatches("STUDENT", "teacher");
      expect.fail("assertRoleMatches hata fırlatmalıydı");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).code).toBe("ROLE_MISMATCH");
      expect((error as AuthError).status).toBe(403);
    }
  });
});
