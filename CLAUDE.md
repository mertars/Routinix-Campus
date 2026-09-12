# Routinix Kampüs — Proje Kuralları

Türkçe dershane/kurs merkezi yönetim sistemi. Next.js App Router + TypeScript + Prisma (Neon Postgres) + Tailwind + Framer Motion. Beş modül tek çatı altında: ERP (Yönetici/Öğretmen/Veli/Öğrenci panelleri), Akademik Röntgen, Ölçme Değerlendirme, Video Ders Merkezi, Ödeme Takip.

## Veri güvenliği — ASLA ihlal edilmeyecek kurallar

🚨 **Test verisi temizliği SADECE ID'ye göre yapılır, İÇERİK/ETİKETE göre ASLA.** `deleteMany`/`updateMany` çağrısında `title`/`weekLabel`/`name` gibi bir alana göre filtre kurmak YASAK — kısa/genel bir etiket (ör. "1. Hafta") gerçek bir kayıtla çakışabilir ve fark edilmeden gerçek veri silinir (2026-09-12'de tam olarak bu oldu, Arslan Dershaneleri'nde 12 gerçek satır böyle silindi, geri alınamadı). Kural:
1. Oluşturulan her test kaydının API'nin döndürdüğü GERÇEK `id`'si saklanır.
2. Temizlik SADECE `WHERE id IN (o id'ler)` ile yapılır.
3. Silmeden ÖNCE SELECT ile ne silineceği gösterilir, beklenmeyen bir sayı çıkarsa DURULUR.
4. Mümkünse gerçek isimli kullanıcılar yerine açıkça "test" olduğu belli, kimseyle çakışmayacak ayrı bir hesap kullanılır.

**Test kurumları — hangisi ne için:**
- **Arslan Dershaneleri** — SUNUM/demo kurumu. Test verisi YAZILMAZ, kirletilmez, buradan hiçbir şey silinmez.
- **Kontrol Dershanesi** — kalıcı sistem testi kurumu (12 şube, 12 öğretmen, ~108 öğrenci). Yeni test buradan yapılır.
- **Zirve Kurs Merkezi** — ödeme paneli testleri için kalıcı test kurumu, silinmez.
- Diğerleri (Meridyen, Ensar, Hız Testi, Yıldız) — eski test kalıntıları, dokunma.

**Asla fabrikasyon veri yazma.** Sahte müşteri/kullanım sayıları, uydurma test sonuçları, gerçekmiş gibi gösterilen mock veri YOK. Bir özelliğin çalıştığını kanıtlamak için gerçek bir API çağrısı/gerçek ekran görüntüsü kullan.

## Çalışma yöntemi

- **Önce ölç, sonra iddia et.** Bir şeyin çalıştığını/bozuk olduğunu söylemeden önce gerçek bir istekle/ekran görüntüsüyle kanıtla.
- **Düzeltmeden sonra AYNI testi tekrarla** — sonucun gerçekten değiştiğini göster.
- Migration'lar `prisma migrate dev` ile gerçek Neon veritabanına uygulanır; şema değişikliği sonrası **`npx prisma generate` + ÇALIŞAN `next dev` sürecini yeniden başlat** (Node, `@prisma/client`'ı process başına önbelleğe alır, dev sunucu yeniden başlamadan yeni alanlar görünmez).
- Her değişiklikten sonra `npx tsc --noEmit` ve `npx eslint <değişen dosyalar>` temiz olmalı.
- Commit sonrası `origin/main`'e doğrudan push edilir, sormadan (özel bir istek olmadıkça feature branch/preview YOK).
- Git commit'leri `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` ile biter.

## Mimari desenler

- **"Kaynak kaydı" (source registry) deseni**: yeni bir modül/sekme/kaynak eklerken dağınık if/else yerine kendi kendini tanımlayan bir dizi girdisi eklenir (bkz. `lib/modules.ts` > `MODULES`, `lib/erp-tabs.ts`, `app/teacher/page.tsx` > `TABS`, `lib/server/agenda/sources/*.ts`). Yeni bir şey eklemek dizide bir satır olmalı, mevcut kodu dallandırmak değil.
- **Rol tabanlı yetkilendirme**: `requireSession`/`requireRole`/`assertTeacherOwnsStudent`/`assertTeacherTeachesBranch` (`lib/server/auth/session-guard.ts`) — HİÇBİR API route client'tan gelen id'ye güvenmez, oturumdan (`session.sub`) alır.
- **Middleware `/api/*`'yi korumaz** (`middleware.ts`'in matcher'ı bilerek hariç tutar) — her API route kendi `requireSession`/`requireRole`'üyle kendini korur.
- **İstanbul saat dilimi güvenli tarih matematiği**: `lib/server/agenda/tr-time.ts`, `lib/attendance/date-key.ts`. Vercel UTC'de çalışıyor, bu kod tabanında geçmişte gerçek zaman dilimi kaymalı veri bozulması yaşandı — yeni bir tarih/saat alanı eklerken bu dosyalardaki deseni takip et, ham `new Date()`/`setHours(0,0,0,0)` YAZMA.
- **Gerçek dosya yükleme**: `lib/server/uploads/save-question-image.ts`, `save-teacher-material.ts`, `save-expense-attachment.ts` — Cloudflare R2'ye (`lib/server/r2.ts`'in `putObject`/`getPublicUrl`/`publicUrlToKey`) yazar, kalıcı bir herkese açık URL döner. Yeni bir dosya yükleme akışı gerekiyorsa BUNLARI yeniden kullan, yeni bir yükleme yardımcısı YAZMA.
  - 🚨 **ASLA `public/uploads/...` gibi yerel diske YAZMA.** Vercel'in serverless fonksiyonları `/tmp` DIŞINDA salt-okunurdur ve `/tmp` bile çağrılar arasında paylaşılmaz — yerel diske yazan bir yükleme `next dev`'de MÜKEMMEL çalışır ama üretimde sessizce başarısız olur/kalıcı olmaz. 2026-09-13'te Pop-Quiz/Ders Materyali/Soru Çözüm fotoğrafları TAM OLARAK bu yüzden üretimde çalışmıyordu (yerel testte "çalışıyor" göründüğü için başta fark edilmedi) — R2'ye taşınarak düzeltildi.
- **Türkçe iyelik eki**: `lib/tr-suffix.ts` > `trPossessive()` — sayıdan sonra sabit `'i` YAZMA, sayının okunuşuna göre değişir (2'si, 3'ü, 40'ı).

## Tasarım sistemi

- Renk paleti: `cream`/`cream-card`/`cream-muted`, `espresso`/`espresso-muted`, `midnight`/`midnight-card` (dark mode), `brand-*` (marka rengi, tonlu). Her yeni bileşen HEM light HEM dark varyantını (`dark:` prefix) tanımlar.
- `cn()` (`lib/utils.ts`) ile koşullu class birleştirme — ham template string YOK.
- Framer Motion: kart girişleri `initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}`, hover `whileHover={{scale:1.005,y:-2}}` — mevcut sekmelerdeki deseni tekrarla.
- İkon seti: `lucide-react`.
- **Mobil öncelik zorunlu** — çoğu öğretmen/öğrenci/veli telefondan giriyor. Dokunma hedefleri `min-h-[44px]`, yatay taşma YOK (geniş tablo/liste kendi `overflow-x-auto` konteynerinde), `sm:`/`md:` breakpoint'leriyle masaüstünde genişleyen ama mobilde tek sütun düzen.
- Yorumlar Türkçe, KOD NE yaptığını değil (isimler zaten söylüyor) NEDEN böyle olduğunu açıklar — özellikle geçmişte bulunan bir hatanın/kararın gerekçesi.

## Doğrulama

Kontrol Dershanesi'ndeki gerçek hesaplarla, gerçek bir oturum jetonu üretip (`signSessionToken`, bkz. `lib/server/auth/jwt.ts`) canlı `next dev` sunucusuna karşı gerçek istekler at; UI değişiklikleri için Playwright ile gerçek ekran görüntüsü al. Sahte/varsayımsal "çalışıyor olmalı" raporu YOK.
