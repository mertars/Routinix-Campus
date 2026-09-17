"use client";

// "PANELE GİR" — yöneticinin bir kullanıcının panelini açması.
//
// ⚠️ Tek yerde: tuş üç ayrı listede (öğrenci satırı, öğretmen satırı,
// veli listesi) görünüyor; akışın (uç + hata mesajı + yönlendirme) üç
// kopyası olsaydı biri güncellenip diğerleri geride kalırdı.
//
// Yönlendirme window.location ile yapılır, router.push ile DEĞİL: kimlik
// artık sunucu tarafında farklı bir kullanıcıdır ve istemcideki RSC
// önbelleği hâlâ yöneticinin ağacını taşır — tam sayfa yükleme, sunucunun
// yeni kimlikle baştan render etmesini garanti eder.
export async function enterPanel(
  role: "teacher" | "student" | "parent" | "guidance",
  userId: string,
  options: { write?: boolean; reload?: boolean } = {}
): Promise<string | null> {
  const res = await fetch("/api/admin/impersonate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, userId, write: options.write === true }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return data?.error ?? "Panele girilemedi.";
  // reload:false → çerez değişti ama aynı sayfada kalınacak (mod değiştirme).
  window.location.href = options.reload === false ? window.location.href : data.url;
  return null;
}
