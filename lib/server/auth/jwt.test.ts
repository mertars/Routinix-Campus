import { describe, it, expect } from "vitest";
import {
  ROLE_ID_BY_AUTH_ROLE,
  REDIRECT_BY_AUTH_ROLE,
  signSessionToken,
  verifySessionToken,
  type AuthRole,
} from "./jwt";

const ALL_ROLES: AuthRole[] = ["STUDENT", "TEACHER", "ADMIN", "PARENT"];

describe("ROLE_ID_BY_AUTH_ROLE", () => {
  it("dört AuthRole'ün tamamı için bir eşleme tanımlar", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_ID_BY_AUTH_ROLE[role]).toBeDefined();
    }
  });

  // Regresyon testi: ADMIN -> "admin" (yerine "principal" olması gerekirken)
  // eşlemesi bu oturumda bulunup düzeltilen gerçek bir prod hatasıydı —
  // TÜM yönetici girişlerini role-guard.ts'te ROLE_MISMATCH ile
  // reddediyordu. Bu, o hatanın bir daha asla geri gelmemesini garanti eder.
  it("ADMIN 'principal'e eşlenir (admin'e DEĞİL)", () => {
    expect(ROLE_ID_BY_AUTH_ROLE.ADMIN).toBe("principal");
  });

  it("her role için REDIRECT_BY_AUTH_ROLE tanımlıdır", () => {
    for (const role of ALL_ROLES) {
      expect(REDIRECT_BY_AUTH_ROLE[role]).toBeDefined();
    }
  });

  // Kampüs V2: Yönetici/Öğretmen artık doğrudan kendi paneline değil,
  // ÖNCE 3'lü modül seçim ekranına (Launcher/Hub) düşer.
  it("ADMIN ve TEACHER /hub'a yönlenir (henüz tek modülleri olan STUDENT/PARENT ise kendi panellerine)", () => {
    expect(REDIRECT_BY_AUTH_ROLE.ADMIN).toBe("/hub");
    expect(REDIRECT_BY_AUTH_ROLE.TEACHER).toBe("/hub");
    expect(REDIRECT_BY_AUTH_ROLE.STUDENT).toBe("/student");
    expect(REDIRECT_BY_AUTH_ROLE.PARENT).toBe("/parent");
  });
});

describe("signSessionToken / verifySessionToken", () => {
  const basePayload = {
    sub: "std_1",
    role: "STUDENT" as const,
    phone: "5550000000",
    name: "Test Öğrenci",
    institutionId: "inst_1",
  };

  it("imzalanan token doğrulandığında AYNI payload'ı geri verir", async () => {
    const token = await signSessionToken(basePayload);
    const verified = await verifySessionToken(token);
    expect(verified).toMatchObject(basePayload);
  });

  it("bozuk/rastgele bir token için null döner (çökmez)", async () => {
    const verified = await verifySessionToken("bu-gecerli-bir-jwt-degil");
    expect(verified).toBeNull();
  });

  it("değiştirilmiş (tampered) bir token imza doğrulamasını geçemez", async () => {
    const token = await signSessionToken(basePayload);
    const tampered = token.slice(0, -4) + "aaaa";
    const verified = await verifySessionToken(tampered);
    expect(verified).toBeNull();
  });

  // Regresyon testi: jose'de setExpirationTime()'a düz bir sayı (saniye
  // cinsinden TTL) verilmesi MUTLAK bir epoch olarak yorumlanıyordu — bu
  // oturumda bulunan gerçek bir hataydı ve her token'ı İMZALANDIĞI AN
  // zaten süresi dolmuş hale getiriyordu ("OTP token süresi doldu" hatası).
  // Bu test, exp claim'inin her zaman ŞU ANDAN SONRA olduğunu garanti eder.
  it("exp claim'i her zaman gelecekte olur (imzalandığı an değil)", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = await signSessionToken(basePayload);
    const [, payloadB64] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    expect(decoded.exp).toBeGreaterThan(nowSeconds);
  });
});
