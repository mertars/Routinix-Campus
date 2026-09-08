import { prisma } from "@/lib/server/prisma";
import { AuthError } from "@/lib/server/auth/errors";
import type { PaymentRole } from "@/lib/payments/payment-roles";

export type { PaymentRole };

// Ödeme modülü yetki kapısı.
//
// ⚠️ Yetki OTURUM TOKEN'INDA DEĞİL, her istekte VERİTABANINDAN okunur.
// Bir sorgu maliyeti var ama karşılığı önemli: müdür bir yöneticinin
// para yetkisini kestiği anda etki eder — token'a gömülseydi, kişi
// çıkış yapana (7 güne) kadar tam yetkiyle işlem yapmayı sürdürürdü.
// Yetki kesme genelde ACİL bir durumda yapılır; gecikme kabul edilemez.
export async function requirePaymentRole(
  session: { sub: string; institutionId: string },
  minimum: Exclude<PaymentRole, "NONE">
): Promise<PaymentRole> {
  const admin = await prisma.admin.findUnique({
    where: { id: session.sub },
    select: { paymentRole: true, institutionId: true },
  });
  if (!admin || admin.institutionId !== session.institutionId) {
    throw new AuthError("Bu işlem için yetkiniz yok.", "FORBIDDEN_ROLE", 403);
  }

  const role = admin.paymentRole as PaymentRole;
  if (role === "NONE") {
    throw new AuthError("Ödeme modülüne erişim yetkiniz yok.", "FORBIDDEN_ROLE", 403);
  }
  if (minimum === "FULL" && role !== "FULL") {
    // Mesaj GENEL tutulur: bu kapı yalnızca para çıkışını değil, borç
    // yazmayı (taksit planı) ve ücret tanımlamayı da kapsıyor —
    // "para çıkaran işlem" demek o durumlarda yanlış olurdu.
    throw new AuthError(
      "Bu işlem için ödeme modülünde tam yetki gerekiyor. Tahsildar yetkisiyle yapılamaz.",
      "FORBIDDEN_ROLE",
      403
    );
  }
  return role;
}
