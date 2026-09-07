import { randomBytes } from "crypto";
import { prisma } from "@/lib/server/prisma";
import { renderTemplate } from "@/lib/server/sms/template-parser";

const DEFAULT_EXPIRY_DAYS = 30;

// Yeni bir kurumda "Sözleşmeler" sekmesi bomboş açılmasın diye ilk okumada
// tohumlanan varsayılan şablon. Kurum bunu düzenleyebilir/yenisini
// ekleyebilir; hukuki metin sorumluluğu kuruma aittir (bu sadece iskelet).
export const DEFAULT_CONTRACT_TEMPLATE = {
  title: "Öğrenci Kayıt Sözleşmesi",
  content: `ÖĞRENCİ KAYIT SÖZLEŞMESİ

1. TARAFLAR
İşbu sözleşme, {kurum_adi} (bundan sonra "Kurum" olarak anılacaktır) ile öğrenci velisi {veli_adi} (bundan sonra "Veli" olarak anılacaktır) arasında {tarih} tarihinde düzenlenmiştir.

2. ÖĞRENCİ BİLGİLERİ
Öğrenci Adı Soyadı: {ogrenci_adi}
Öğrenci No: {ogrenci_no}
Sınıf / Şube: {sinif}

3. EĞİTİM ÜCRETİ VE ÖDEME PLANI
{ogrenim_yili} eğitim-öğretim yılı toplam ücreti {tutar} olarak belirlenmiştir. Ödeme {taksit_sayisi} taksit halinde yapılacaktır. Taksit vadeleri Kurum tarafından Veli'ye bildirilen ödeme planında yer almaktadır.

4. TARAFLARIN YÜKÜMLÜLÜKLERİ
4.1. Kurum, eğitim-öğretim hizmetini ilan ettiği program ve takvim çerçevesinde sunmayı taahhüt eder.
4.2. Veli, yukarıda belirtilen ücreti vadesinde ödemeyi kabul ve taahhüt eder.
4.3. Vadesinde ödenmeyen taksitler için Kurum, Veli'ye bildirimde bulunma ve mevzuatın izin verdiği ölçüde gecikme faizi uygulama hakkını saklı tutar.

5. KAYIT İPTALİ VE İADE
Kayıt iptali talepleri yazılı olarak yapılır. İade koşulları, ilgili mevzuat ve Kurum'un ilan ettiği iptal politikası çerçevesinde uygulanır.

6. KİŞİSEL VERİLER
Taraflar, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında verilerin yalnızca eğitim-öğretim faaliyetinin yürütülmesi amacıyla işleneceğini kabul eder.

7. YÜRÜRLÜK
İşbu sözleşme, Veli tarafından elektronik ortamda imzalandığı anda yürürlüğe girer.`,
};

export type ContractParams = {
  kurum_adi: string;
  ogrenci_adi: string;
  ogrenci_no: string;
  sinif: string;
  veli_adi: string;
  tutar: string;
  taksit_sayisi: string;
  tarih: string;
  ogrenim_yili: string;
};

export function renderContractContent(templateContent: string, params: ContractParams): string {
  return renderTemplate(templateContent, params as unknown as Record<string, string>);
}

export function createShareToken(): { token: string; expiresAt: Date } {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRY_DAYS);
  return { token, expiresAt };
}

export type ContractResolution =
  | { ok: true; contract: NonNullable<Awaited<ReturnType<typeof findContractByToken>>> }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "CANCELLED" };

function findContractByToken(token: string) {
  return prisma.studentContract.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      expiresAt: true,
      totalAmount: true,
      installmentCount: true,
      signerName: true,
      signerRelation: true,
      signatureData: true,
      signedAt: true,
      student: { select: { firstName: true, lastName: true } },
      institution: { select: { name: true } },
    },
  });
}

// BİLEREK requireSession() İÇERMEZ — velinin oturumu yoktur, tek kimlik
// doğrulaması token'ın kendisidir (bkz. resolveReportCardShareLink'teki
// aynı gerekçe).
export async function resolveContractToken(token: string): Promise<ContractResolution> {
  const contract = await findContractByToken(token);
  if (!contract) return { ok: false, reason: "NOT_FOUND" };
  if (contract.status === "CANCELLED") return { ok: false, reason: "CANCELLED" };
  // İmzalanmış sözleşme süresi geçse de GÖRÜNTÜLENEBİLİR olmalı — veli
  // imzaladığı metne sonradan da ulaşabilmeli. Süre sınırı yalnızca HENÜZ
  // imzalanmamış sözleşmeler için bir güvenlik önlemidir.
  if (contract.status !== "SIGNED" && contract.expiresAt < new Date()) return { ok: false, reason: "EXPIRED" };
  return { ok: true, contract };
}
