import { createSmsProvider } from "@/lib/server/sms/provider-factory";

// Yeni oluşturulan bir kullanıcının giriş bilgilerini SMS ile gönderir.
// Şifre hiçbir yerde düz metin olarak saklanmaz — bu fonksiyon sadece
// oluşturma anında istemcinin hafızasında bir kere görünen şifreyi iletir.
export async function sendCredentialsBySms(phone: string, name: string, username: string, password: string) {
  const provider = createSmsProvider();
  const message = `Sayın ${name}, Routinix Kampüs giriş bilgileriniz — Kullanıcı Adı: ${username} / Şifre: ${password}. Lütfen ilk girişte şifrenizi değiştirin.`;
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
