import { createSmsProvider } from "@/lib/server/sms/provider-factory";

// Yeni oluşturulan bir kullanıcının giriş bilgilerini SMS ile gönderir.
// Şifre hiçbir yerde düz metin olarak saklanmaz — bu fonksiyon sadece
// oluşturma anında istemcinin hafızasında bir kere görünen şifreyi iletir.
export async function sendCredentialsBySms(phone: string, name: string, username: string, password: string) {
  const provider = createSmsProvider();
  const message = `Sayın ${name}, Routinix Kampüs giriş bilgileriniz — Kullanıcı Adı: ${username} / Şifre: ${password}. Lütfen ilk girişte şifrenizi değiştirin.`;
  return provider.send(phone, message);
}
