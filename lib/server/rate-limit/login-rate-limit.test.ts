import { describe, it, expect, beforeEach } from "vitest";
import {
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  MAX_LOGIN_ATTEMPTS_PER_IP,
} from "./general-rate-limit";

// Bu testler bir GÜVENLİK BOŞLUĞUNDAN ve onu kapatırken az kalsın
// açacağım bir KULLANILABİLİRLİK hatasından doğdu.
//
// Boşluk: telefon bazlı kilit (5 hata → 15 dk) tek bir hesabı korur ama
// ŞİFRE PÜSKÜRTMEYİ durdurmaz — saldırgan tek şifreyi yüzlerce farklı
// numarada dener, hiçbir numara kilitlenmez. Ölçüldü: 10 farklı
// numaraya yapılan denemenin hiçbiri engellenmedi.
//
// Az kalsın açacağım hata: ilk düzeltmem HER giriş denemesini sayıyordu.
// Dershanenin NAT'lı tek IP'si arkasından ders başında giriş yapan
// 20 kişilik bir sınıfın 11'incisinden sonrası engellenirdi. Doğru
// kural "çok giriş" değil "çok BAŞARISIZ giriş".
let ipSayaci = 0;
function yeniIp(): string {
  ipSayaci += 1;
  return `10.0.0.${ipSayaci}`;
}

describe("giriş IP sınırı", () => {
  let ip: string;
  beforeEach(() => {
    ip = yeniIp();
  });

  it("temiz bir IP serbesttir", () => {
    expect(checkLoginRateLimit(ip).allowed).toBe(true);
  });

  // Asıl korunan davranış: BAŞARILI girişler sayaca işlemez.
  it("başarılı girişler sayılmaz — sınıfça giriş kırılmaz", () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS_PER_IP * 3; i++) {
      expect(checkLoginRateLimit(ip).allowed).toBe(true);
    }
  });

  it("sınırı aşan BAŞARISIZ denemeden sonra engellenir", () => {
    for (let i = 0; i <= MAX_LOGIN_ATTEMPTS_PER_IP; i++) recordFailedLoginAttempt(ip);
    const sonuc = checkLoginRateLimit(ip);
    expect(sonuc.allowed).toBe(false);
    if (!sonuc.allowed) expect(sonuc.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("sınırın ALTINDAKİ hatalar engellemez — parmağı kayan kullanıcı kilitlenmez", () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS_PER_IP - 1; i++) recordFailedLoginAttempt(ip);
    expect(checkLoginRateLimit(ip).allowed).toBe(true);
  });

  it("bir IP'nin sayacı diğerini etkilemez", () => {
    const digeri = yeniIp();
    for (let i = 0; i <= MAX_LOGIN_ATTEMPTS_PER_IP; i++) recordFailedLoginAttempt(ip);
    expect(checkLoginRateLimit(ip).allowed).toBe(false);
    expect(checkLoginRateLimit(digeri).allowed).toBe(true);
  });

  it("sınır, püskürtmeyi durduracak kadar dar ama insan hatasına yer bırakacak kadar geniş", () => {
    expect(MAX_LOGIN_ATTEMPTS_PER_IP).toBeGreaterThanOrEqual(5);
    expect(MAX_LOGIN_ATTEMPTS_PER_IP).toBeLessThanOrEqual(30);
  });
});
