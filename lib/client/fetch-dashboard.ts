// Yönetici panelinin 6 farklı yerden çağırdığı /api/admin/dashboard için TEK
// güvenli fetch sarmalayıcısı. Neon gibi sunucusuz Postgres sağlayıcıları
// bir süre boşta kalınca bağlantıyı askıya alır ("scale to zero") — o
// yüzden ilk istek ara sıra geçici olarak 500/bağlantı hatası verebilir
// (gerçek bir kod hatası değil, altyapının doğal davranışı). Bu sarmalayıcı:
// 1) res.ok kontrolü yapmadan hata gövdesini gerçek veri sanıp state'e
//    yazmayı önler (önceki hatanın kök nedeni buydu),
// 2) ilk deneme başarısız olursa bir kez daha dener (Neon'un "uyanması"
//    için kısa bir gecikmeyle), gerçek/kalıcı hatalarda ise düzgün fırlatır.
export async function fetchDashboard<T>(segment: string, options?: { retry?: boolean }): Promise<T> {
  const url = `/api/admin/dashboard?segment=${encodeURIComponent(segment)}`;
  const attempt = async (): Promise<T> => {
    const res = await fetch(url);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new Error("Sunucudan geçersiz yanıt alındı.");
    }
    if (!res.ok) {
      const message = (body as { error?: string })?.error ?? "Panel verisi yüklenemedi.";
      throw new Error(message);
    }
    return body as T;
  };

  try {
    return await attempt();
  } catch (error) {
    if (options?.retry === false) throw error;
    // Neon "uyanırken" tek seferlik kısa bekleme + yeniden deneme.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return attempt();
  }
}
