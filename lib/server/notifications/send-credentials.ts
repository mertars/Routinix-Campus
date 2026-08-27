import { createSmsProvider } from "@/lib/server/sms/provider-factory";

// Yeni oluşturulan bir kullanıcının giriş bilgilerini SMS ile gönderir.
// Şifre hiçbir yerde düz metin olarak saklanmaz — bu fonksiyon sadece
// oluşturma anında istemcinin hafızasında bir kere görünen şifreyi iletir.
export async function sendCredentialsBySms(phone: string, name: string, username: string, password: string) {
  const provider = createSmsProvider();
  // ⚠️ Giriş SADECE telefon + şifre ile yapılır (bkz. app/login,
  // findAccountByPhone) — "Kullanıcı Adı" (öğrenci no/T.C. no) giriş
  // ekranında HİÇ istenmez. Eski metin bunu tersine söylüyordu (öğrenciye
  // "Kullanıcı Adı" ile giriş yapması gerekiyormuş izlenimi veriyordu),
  // gerçek kullanıcılar için kafa karıştırıcıydı — bu yüzden telefon
  // numarasını (giriş için gereken asıl bilgi) mesaja ekleyip vurguluyoruz.
  const message = `Sayın ${name}, Routinix Kampüs giriş bilgileriniz — Telefon: ${phone} / Geçici Şifre: ${password} (Kayıt No: ${username}). Giriş ekranında bu telefon numarası ve şifreyle devam edin, ilk girişte yeni bir şifre belirlemeniz istenecek.`;
  return provider.send(phone, message);
}

export type BulkUser = { phone: string; name: string; username: string; password: string };

// Toplu içe aktarma (bkz. app/api/admin/import/bulk) sonrası üretilen tüm
// geçici şifreleri tek tek SMS ile gönderir. Bir kullanıcının gönderimi
// başarısız olsa bile diğerleri denenmeye devam eder ("parçalı kayıt" —
// aynı disiplin bulk-import'un kendisinde de geçerlidir).
export async function sendBulkCredentials(users: BulkUser[]) {
  const errors: { phone: string; error: string }[] = [];
  let sentCount = 0;

  for (const user of users) {
    const result = await sendCredentialsBySms(user.phone, user.name, user.username, user.password);
    if (result.success) {
      sentCount += 1;
    } else {
      errors.push({ phone: user.phone, error: result.error ?? "SMS gönderilemedi." });
    }
  }

  return { success: errors.length === 0, sentCount, failedCount: errors.length, errors };
}
