import { ROLE_ID_BY_AUTH_ROLE, type RoleId } from "./jwt";
import type { AuthRole } from "./otp";
import { AuthError } from "./errors";

const ROLE_LABEL_TR: Record<RoleId, string> = {
  principal: "Yönetici",
  teacher: "Öğretmen",
  student: "Öğrenci",
  parent: "Veli",
};

// Beklenen rol (login sayfasının ?role= parametresinden gelir) ile hesabın
// GERÇEK rolü eşleşmiyorsa akışı burada, en başta keser. Tek gerçek kaynak
// ROLE_ID_BY_AUTH_ROLE (jwt.ts) — daha önce her route kendi
// `role.toLowerCase().replace("_","")` dönüşümünü yapıyordu, bu da
// AuthRole "ADMIN" için "admin" üretip hiçbir zaman "principal" ile
// eşleşmiyordu (Yönetici girişini her zaman ROLE_MISMATCH olarak reddeden
// asıl hataydı). Artık tüm route'lar bu tek fonksiyonu kullanıyor.
export function assertRoleMatches(accountRole: AuthRole, expectedRole?: RoleId | null): void {
  if (!expectedRole) return;
  if (ROLE_ID_BY_AUTH_ROLE[accountRole] !== expectedRole) {
    throw new AuthError(
      `Bu telefon numarası ${ROLE_LABEL_TR[expectedRole]} rolüne ait değil. Lütfen kendi rolünüz üzerinden giriş yapın.`,
      "ROLE_MISMATCH",
      403
    );
  }
}
