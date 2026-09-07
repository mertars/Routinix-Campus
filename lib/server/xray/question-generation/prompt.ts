import type { FlattenedTopic, FlattenedSubtopic } from "./curriculum-flatten";
import { numericSignature } from "./deterministic-checks";

// Faz Z4/Z5 — Akademik Röntgen soru havuzu prompt'ları. İKİ variant burada
// tanımlı: "genel" (temanın TÜMÜNÜ kapsayan 30 soruluk havuz, tüm alt
// konulara dağıtılır) ve "alt_konu" (TEK bir alt konuya özel, orta seviye
// 10 soruluk havuz). Turlar arası tutarlılık modelin "hatırlamasına"
// bırakılmıyor — round 1'de üretilen blueprint (soru-slotu yapısı) DB'ye
// kilitlenir, 2. ve sonraki her turda BİREBİR yeniden enjekte edilir.
//
// ⚠️ MÜFREDAT SINIRI KURALI (kullanıcı talebi, ÇOK ÖNEMLİ): aynı konu adı
// (örn. "Türev") birden fazla sınıfta FARKLI derinliklerde geçebilir (bkz.
// lib/mock-data.ts CURRICULUM_TREE — sarmal müfredat). Model SADECE verilen
// alt konunun/sınıf seviyesinin müfredatta KAPSADIĞI çerçevede soru
// üretmeli — konu adı aynı diye başka bir sınıfın/daha ileri bir düzeyin
// içeriğini KULLANMAMALI. Bu kural HER İKİ prompt'a da (MEB_SCOPE_CLAUSE
// üzerinden) tek bir yerden enjekte edilir — iki promptun metni burada
// birbirinden bağımsız kopyalanıp SÜRÜKLENMEDEN (drift) tutarlı kalsın diye.
const MEB_SCOPE_CLAUSE = `MÜFREDAT SINIRI (ÇOK ÖNEMLİ, ASLA İHLAL ETME): Aşağıda verilen konu/alt konu, Türkiye MEB'in (Milli Eğitim Bakanlığı) resmi lise matematik müfredatında BELİRTİLEN SINIF SEVİYESİNE ait, dershane pratiğinde kullanılan bir alt başlıktır. Aynı konu adı (örn. "Türev", "Trigonometri") FARKLI sınıflarda FARKLI derinliklerde/farklı alt başlıklar altında da geçebilir — SEN SADECE verilen sınıf seviyesinin, verilen alt konunun müfredatta KAPSADIĞI konuları/yöntemleri/formülleri kullanacaksın. Konu adı aynı diye daha ileri bir sınıfın, farklı bir müfredatın (üniversite düzeyi dahil) veya bu alt konunun kapsamadığı bir yöntemin/formülün İÇERİĞİNİ ASLA KULLANMA. Emin olmadığın bir yöntem/formül varsa, KESİNLİKLE müfredat dışına çıkmaktansa daha basit/temel bir yaklaşım kullan.`;

// Faz Z9 — gerçek üretimlerde bağımsız içerik denetiminin (verify-content.ts)
// yakaladığı hataların KÖK NEDEN analizi sonucu eklendi. Gözlenen 2 ana
// hata sınıfı: (1) finalAnswer alanı detailedSolution'ın kendi ulaştığı
// sonuçla TUTARSIZ yazılmış (model çözümde doğru hesaplıyor ama ayrı
// finalAnswer alanına farklı/yanlış bir değer yazıyor — bir "transkripsiyon"
// hatası, muhakeme hatası değil); (2) gerçek hesap hataları, özellikle
// kesir sadeleştirme (sadeleşmeyen bir kesri sadeleşmiş gibi göstermek) ve
// üslü ifade hesaplarında. Bu madde HER İKİ prompt'a da enjekte edilir —
// gelecekte yeni bir hata sınıfı gözlenirse BURAYA eklenmeli (tek kaynak).
const SELF_CHECK_CLAUSE = `KENDİ KENDİNİ KONTROL ET (ÇOK ÖNEMLİ — geçmiş üretimlerde en sık görülen hatalar):
1. finalAnswer'ı ASLA detailedSolution'dan BAĞIMSIZ hesaplama. Önce detailedSolution'ı TAMAMLA, sonra finalAnswer'ı o çözümün SON SATIRINDAKİ sonuçtan BİREBİR KOPYALA — iki alan arasında EN UFAK bir sayısal farklılık dahi KABUL EDİLEMEZ.
   - YANLIŞ örnek (gerçek üretimde yakalandı): detailedSolution "...a+b = 5 bulunur" diye bitiyor ama finalAnswer alanına "4" yazılmış. Bu KABUL EDİLEMEZ bir tutarsızlıktır.
   - DOĞRU: detailedSolution "...a+b = 5 bulunur" diye bitiyorsa finalAnswer da BİREBİR "5" olmalı.
2. Kesir sadeleştirirken payı ve paydayı GERÇEKTEN ortak bir tam sayıya bölüp bölemediğini iki kez kontrol et. Payı ve paydası aralarında asal olan (ortak böleni olmayan) bir kesir ZATEN en sade halidir — sadeleştirilebilir SANIP yanlış bir sadeleştirme YAPMA (gerçek üretimde yakalanan hata: "35/66 sadeleştirilerek 1/2" denmiş, ama 35 ile 66 aralarında asaldır, sadeleşmez).
3. Üslü ifadelerde toplama/çarpma/bölme kurallarını (üs toplama/çıkarma) uygularken, özellikle birden fazla adım varsa SON adımı yazmadan önce baştan bir kez daha elle doğrula.
4. "Hangi sayı/ifade X değildir?" VEYA "hangi kenar/açı Y'ye karşılık gelir?" tarzı KARŞILAŞTIRMA sorularında TERCİHEN tek bir somut soru sor (örn. "√2 sayısı rasyonel bir sayı mıdır? Nedenini kısaca açıklayınız." veya "AB kenarına karşılık gelen kenar hangisidir?") yerine seçenekleri "a) ... b) ... c) ... d) ..." şeklinde SIRALAMA — ama bazı kazanımlar (örn. "hangisi X değildir" tipi kavram soruları) doğası gereği seçenekli formata yakındır; bunu ISRARLA/doğal olarak istiyorsan zorlanıp açık uçlu bir versiyon uydurmana gerek YOK, a)/b)/c)/d) şıklı sor — önemli olan finalAnswer'ın doğru şıkla/değerle TUTARLI olması.
5. questionText BİRDEN FAZLA şey istiyorsa (örn. "...üslü gösterimle yazınız VE değerini bulunuz"), finalAnswer İSTENEN HER PARÇAYI içermeli — SADECE son sayısal değeri yazıp diğer istenen parçayı (üslü/köklü gösterim, ifade, birim vb.) ATLAMA.
   - YANLIŞ örnek (gerçek üretimde defalarca yakalandı): soru "\\sqrt[3]{64} ifadesini üslü gösterimle yazınız ve değerini bulunuz" derken finalAnswer sadece "4" yazılmış — üslü gösterim (64^{1/3}) eksik.
   - DOĞRU: finalAnswer "64^{\\frac{1}{3}} = 4" gibi İSTENEN HER PARÇAYI içermeli.
6. Eş/benzer üçgen sorularında köşe eşleşmesini (hangi köşe hangi köşeye karşılık gelir) HER ZAMAN açıkça belirt — "ABC ile DEF eş üçgen" demek TEK BAŞINA yetersizdir, çünkü köşe sırası (A↔D, B↔E, C↔F) varsayılmalı mı yoksa açıkça mı verilmeli belirsiz kalır (gerçek üretimde yakalandı: "AB kenarına hangi kenar karşılık gelir?" sorusu, köşe eşleşmesi metinde yazmadığı için belirsiz bulundu). Köşe eşleşmesini ya soru metninde AÇIKÇA yaz (örn. "△ABC ≅ △DEF (A↔D, B↔E, C↔F)") ya da açı ölçüleri/kenar uzunlukları üzerinden HİÇBİR VARSAYIMA yer bırakmayacak şekilde ver.
7. Kosinüs teoremi (a² = b² + c² − 2bc·cos(A)) uygularken SIK YAPILAN hata: b²+c²−a² veya 2bc çarpımı yanlış hesaplanıyor, ya da cos(A) bulunduktan sonra formülü YANLIŞ YÖNDE (kenar bulma yerine açı bulma formülüyle karıştırarak) kullanıyor. Her adımdan sonra (b²+c²−a² değerini, 2bc çarpımını, bölme işlemini) AYRI AYRI elle tekrar kontrol et — bu gerçek üretimde AYNI turda 2 farklı soruda, 3 farklı denemede 3 farklı yanlış sonuçla tekrarlanarak TURUN TAMAMEN BAŞARISIZ olmasına yol açtı.
8. Permütasyon/kombinasyon/sayma problemlerinde (çarpma kuralı, n!, C(n,r), P(n,r)) ara çarpım/bölme adımlarını TEK TEK yaz ve her adımdan sonra elle doğrula — özellikle birden fazla çarpanın art arda çarpıldığı (örn. "4 × 3 × 2 × 1") veya faktöriyel oranı içeren (örn. "8!/6!") sorularda tek bir çarpım/bölme hatası TÜM sonucu bozar (gerçek üretimde çok sayıda yakalandı, ör. finalAnswer 980 iken doğru sonuç 196 gibi büyük sapmalar oluştu).
9. Koşullu olasılık (P(A|B) = P(A∩B)/P(B)) ve Bayes teoremi soruları GERÇEK ÜRETİMDE EN SIK HATA YAPILAN alandır — bir turda neredeyse TÜM koşullu olasılık soruları yanlış çıkıp turun tamamen başarısız olmasına yol açtı. (a) Verdiğin P(A), P(B|A), P(B) gibi değerlerin BİRBİRİYLE TUTARLI olduğunu ÖNCEDEN kontrol et — tam olasılık kuralına (P(B) = P(A)·P(B|A) + P(A')·P(B|A')) göre imkânsız bir P(B) değeri VERME (gerçek üretimde yakalandı: P(A)=0.3, P(B|A)=0.6, P(B)=0.9 verilmiş ama olası maksimum P(B) 0.72'dir — çelişkili). (b) P(A|B) hesaplarken payda MUTLAKA P(B) (P(A) DEĞİL) olmalı — bu formülü ters kullanma. (c) Bu kazanımda seçenekli ("a) ... b) ... c) ... d) ...") format doğal geliyorsa kullanabilirsin (bkz. kural 4) — önemli olan hangi seçeneğin/değerin DOĞRU olduğunun hesapla TUTARLI olması.
10. "Belirli bir koşulu sağlayan TÜM değerleri bul, sonra topla/say" tarzı sorularda (basamak/rakam bulmaca, EBOB-EKOK ile sayı bulma, "kaç farklı a değeri vardır" vb.) GERÇEK ÜRETİMDE ÇOK SIK yakalanan hata: geçerli değerlerin TAMAMI listelenmeden bir kısmı atlanıyor, YA DA sınır koşulu (örn. çok basamaklı bir sayının İLK basamağı 0 OLAMAZ) unutuluyor. Cevabı yazmadan önce: (a) koşulu sağlayan TÜM adayları TEK TEK listele (0'dan 9'a kadar dene, hangileri koşulu sağlıyor açıkça yaz), (b) basamak/sayı bağlamındaki gizli kısıtları (baştaki basamak ≠ 0, pozitif tam sayı vb.) unutma, (c) EBOB(a,b)×EKOK(a,b) = a×b ilişkisini kullanan sorularda bu çarpımı DOĞRU hesapla. "Böyle bir değer yoktur" ile sayısal bir cevap vermek arasında ÇELİŞKİYE düşme — ikisinden sadece biri doğru olabilir.
11. Bir GEOMETRİK ŞEKLİ (çokgen kenarları/açıları) veya bir ÇİZGEYİ (köşe dereceleri) SAYILARLA TANIMLAYAN sorularda, uydurduğun sayıların böyle bir yapının GERÇEKTEN VAR OLABİLECEĞİNİ (gerçeklenebilirliğini) yazmadan ÖNCE kontrol et — GERÇEK ÜRETİMDE bu kontrol atlandığı için soru baştan imkânsız çıktı ve tur tamamen başarısız oldu:
   - Çokgen kenar uzunlukları: EN UZUN kenar, DİĞER TÜM kenarların toplamından KESİN OLARAK KÜÇÜK olmalı (çokgen eşitsizliği) — eşit ya da büyükse şekil oluşmaz (dejenere/çizgisel olur).
   - Çokgenin iç açıları: n kenarlı bir çokgende toplamları TAM OLARAK (n−2)×180° olmalı — açıları yazdıktan sonra TOPLA ve bu formülle karşılaştır, tutmuyorsa açıları değiştir.
   - Bir çizgenin köşe dereceleri: TOPLAMLARI ÇİFT olmalı (el sıkışma lemması — tek ise böyle bir çizge YOKTUR) VE en büyük derece (köşe sayısı − 1)'i AŞAMAZ VE (Erdős–Gallai) büyükten küçüğe sıralandığında her k için ilk k derecenin toplamı ≤ k(k−1) + (kalan köşelerin dereceleriyle k arasındaki minimumların toplamı) koşulunu sağlamalı — emin değilsen basit bir örnek çizerek (köşeleri tek tek birbirine bağlayarak) derece dizisinin GERÇEKTEN kurulabildiğini elle doğrula, karmaşık/şüpheli bir derece dizisi yerine DAHA BASİT (örn. hepsi birbirine yakın dereceli) bir dizi seç.
   - YANLIŞ örnek (gerçek üretimde yakalandı): 6 köşeli bir çizgenin dereceleri (5,3,2,4,3,1) verilmiş — derecesi 5 olan köşe TÜM diğer köşelere bağlı olmak zorundayken, derecesi 1 olan köşe SADECE ona bağlanabilir; bu da 3/4 dereceli köşelerin ihtiyaç duyduğu bağlantı sayısını imkânsız kılar — çizge gerçeklenemez. Bir başka gerçek örnek: dörtgen kenarları (5,7,9,12) verilmiş ama 12 = 5+7, bu dejenere (çizgisel) bir şekildir, gerçek bir dörtgen değildir.
   - DOĞRU: Sayıları seçtikten SONRA yukarıdaki kontrolü yap; sağlamıyorsa soruyu yazmadan sayıları değiştir.
12. "Aşağıdakilerden hangisi DOĞRUDUR/YANLIŞTIR/değildir?" tarzı çoktan seçmeli (a/b/c/d/e) ÖNERME sorularında (özellikle mantık, niceleyici (∀/∃), kümeler gibi "önerme doğru mu yanlış mı" değerlendirmesi gerektiren konularda) GERÇEK ÜRETİMDE ÇOK SIK yakalanan, turu TAMAMEN başarısız kılan hata: şıkların BİRDEN FAZLASI (veya HİÇBİRİ) sorulan kritere (doğru/yanlış) uyuyor — soru "tekil" bir cevap istediği halde birden fazla şık kritere uyunca soru ÇÖZÜLEMEZ hale geliyor. Şıkları yazdıktan SONRA HER BİR şıkkı TEK TEK, birbirinden TAMAMEN BAĞIMSIZ olarak (diğer şıklardan etkilenmeden) doğru/yanlış diye değerlendir ve TAM OLARAK BİR tanesinin sorulan kritere (örn. "hangisi doğrudur" ise SADECE O ŞIK doğru, DİĞER TÜM şıklar yanlış) uyduğunu doğrula — uymuyorsa şıkları (gerekirse sayıları/önermeleri) DEĞİŞTİR, bu kontrolü sağlayana kadar tekrarla.
   YANLIŞ örnek (gerçek üretimde tekrar tekrar yakalandı, 2 düzeltme denemesi de aynı hatayı tekrarladı, tur tamamen kayboldu): "Aşağıdaki önermelerden hangisi DOĞRUDUR?" sorusunda hem b) ∃x∈ℝ, x²=5 hem de c) ∀x∈ℝ, x²≥0 önermeleri matematiksel olarak doğru çıkmış — soru tek cevaba izin vermiyor.
   DOĞRU: Şıkları tek tek kontrol ettikten sonra sadece BİR şıkkın kritere uyduğundan emin ol; diğerlerini KASITLI OLARAK kritere uymayacak şekilde kur.
13. Üçgende İÇ AÇI TOPLAMI (180°) ve DIŞ AÇI (bir dış açı, KENDİSİNE KOMŞU OLMAYAN diğer iki iç açının TOPLAMINA eşittir; ayrıca komşu olduğu iç açıyla 180° tümlerdir) sorularında GERÇEK ÜRETİMDE ÇOK SIK yakalanan hata: finalAnswer ile detailedSolution'ın ulaştığı sayısal sonuç BİRBİRİNDEN FARKLI çıkıyor (aynı turda arka arkaya birden fazla soruda tekrarlandı, tur tamamen kayboldu) — bu bir kopyalama hatası değil, İKİ FARKLI (ve genelde ikisi de birbirinden farklı, muhtemelen ikisi de yanlış) hesap yapılmasından kaynaklanıyor. Sayıları/ifadeleri (x, 2x, 3x gibi oranlar dahil) seçtikten SONRA: (a) iç açı toplamı sorusuysa üç açıyı TOPLA ve TAM OLARAK 180 ETTİĞİNİ doğrula, (b) dış açı sorusuysa dış açının komşu OLMADIĞI iki iç açıyı doğru seçtiğinden emin ol ve bunları TOPLAYARAK dış açıyı bul (komşu iç açıdan 180 çıkararak da bulup İKİ YÖNTEMİN AYNI SONUCU verdiğini çapraz kontrol et), (c) sonucu BULDUKTAN SONRA detailedSolution'ı bu doğrulanmış hesapla yaz, finalAnswer'ı oradan BİREBİR kopyala — asla iki alanı ayrı ayrı hesaplama (bkz. kural 1).
14. Üçgende AÇI-KENAR İLİŞKİSİ sorularında (bir üçgenin köşe açıları verilip kenar uzunluklarını SIRALAMA/KARŞILAŞTIRMA istenen sorular) GERÇEK ÜRETİMDE yakalanan hata: BÜYÜK açının karşısındaki kenarın da BÜYÜK olduğu kuralı TERS uygulanıyor (küçük açının karşısına büyük kenar konuyor) veya köşe-kenar eşleşmesi (hangi kenar hangi açının karşısında) yanlış kuruluyor. Cevabı yazmadan önce: (a) üçgenin köşe adlarını (örn. A, B, C) ve HANGİ KENARIN (örn. |BC|) HANGİ AÇININ (örn. A açısının) KARŞISINDA olduğunu AÇIKÇA belirle, (b) açı ölçülerini büyükten küçüğe sırala, (c) BU SIRAYLA AYNI SIRADA karşılarındaki kenarları büyükten küçüğe yaz (açılar eşitse karşılarındaki kenarlar da eşittir) — bu eşlemeyi ATLAYIP doğrudan "büyük sayı = büyük kenar" gibi yüzeysel bir kısayola KAÇMA.
15. GERÇEK ÜRETİMDE yakalanan YETERSİZ VERİ hatası: questionText bir açı/kenar/değer SORARKEN, o değeri hesaplamak için GEREKEN başka bir açı/kenar/ilişki questionText'te HİÇ VERİLMEMİŞ oluyor — detailedSolution bu eksikliği fark etmeyip questionText'te YAZMAYAN bir değeri "verilmiş gibi" uydurarak (veya sessizce varsayarak) hesaba devam ediyor, bu da soruyu çözülemez/geçersiz kılıyor. questionText'i YAZDIKTAN SONRA detailedSolution'ı yazmaya başlamadan önce: (a) çözüm için kullanacağın HER sayısal değerin/ilişkinin (açı ölçüsü, kenar uzunluğu, paralellik/dik açı/eşlik gibi bir koşulun) questionText İÇİNDE AÇIKÇA yazılı olduğunu TEK TEK kontrol et, (b) eksik bir veri fark edersen ya questionText'e o veriyi EKLE ya da soruyu o eksik veriye ihtiyaç DUYMAYACAK şekilde yeniden kur — detailedSolution'da questionText'te yer almayan bir sayıyı/koşulu ASLA "verilmiş" gibi kullanma.
16. Bir DENKLEM kurup (özellikle f(g(x))=g(f(x)) gibi BİLEŞKE FONKSİYON denklemleri, ama genel olarak "x'i bulunuz" isteyen HER denklem için) x/değişken SORARKEN, bu denklemin GERÇEKTEN bir çözümü olduğunu SORUYU YAZMADAN ÖNCE elle çöz: f ve g'yi seçtikten hemen sonra denklemi kur ve adım adım çöz, bir çözüm (somut bir x değeri) BULAMIYORSAN o f/g seçimini (katsayıları) DEĞİŞTİR — "çözümü yoktur" sonucuna varan bir soruyu YAYINLAMA. GERÇEK ÜRETİMDE yakalanan ÇOK CİDDİ bir hata: model f(g(x))=g(f(x)) denkleminin HİÇBİR x için sağlanmadığını fark edip bunu detailedSolution içinde AYNI CÜMLEYİ (örn. "...bu yüzden x değeri yoktur. Ancak soru 'x değerini bulunuz' dediği için...") ONLARCA KEZ ard arda TEKRARLAYARAK bir DÖNGÜYE girmiş, token limitine kadar gidip yanıtı YARIM (geçersiz JSON) bırakmış — bu TEK BAŞINA turun TAMAMEN kaybolmasına yol açtı. Bu döngüye hiç girmemek için: (a) denklemi ÖNCEDEN çöz, çözümü YOKSA soruyu hiç yazma, sayıları değiştirip TEKRAR dene; (b) detailedSolution'da bir sonuca/çıkmaza vardıysan bunu BİR KEZ yaz, AYNI cümleyi/gerekçeyi tekrar tekrar YAZMA.`;

// ── "genel" — 30 soru, temanın TÜMÜ, tüm alt konulara dağılır ──

export const SYSTEM_PROMPT_GENEL = `SEN MÜKEMMEL BİR LİSE MATEMATİK ÖLÇME-DEĞERLENDİRME VE PEDAGOJİ UZMANISIN.

GÖREV: Verilen TEK bir KONUNUN (temanın) TÜMÜNÜ ölçen 30 soruluk bir "havuz turu" üreteceksin. Bu 30 soru, verilen temanın TÜM alt konularına mümkün olduğunca EŞİT dağıtılmalı (örn. 6 alt konu varsa ~5'er soru, 4 alt konu varsa 7-8'er soru) — HER alt konudan EN AZ 1 soru olmalı. Bu sorular sabit bir sınav kağıdı DEĞİL, rastgele seçimle öğrenciye sunulacak bir SORU HAVUZUNUN parçasıdır.

${MEB_SCOPE_CLAUSE}

${SELF_CHECK_CLAUSE}

SORU YAPISI:
- Sorular ÖNCELİKLE açık uçlu/klasik matematik sorularıdır — ama bazı kazanımlar (kavram karşılaştırması, "hangisi X değildir" tipi sorular) doğası gereği seçenekli formata yakındır; bu durumda a)/b)/c)/d) şıklı sormakta serbestsin (bkz. KENDİ KENDİNİ KONTROL ET kural 4) — zorla açık uçlu bir versiyon uydurmana gerek yok.
- soruNo 1-10 (GİRİŞ): 1 adımlı, doğrudan tanım/sembol okuma/çok basit işlem.
- soruNo 11-20 (KURALLAR VE ÖZEL DURUMLAR): Konunun özel kuralları/formülleri (gerekirse aynı kural farklı sayılarla tekrarlanarak 10'a tamamlanır).
- soruNo 21-30 (KAPSAMLI): Kuralları birleştiren 3-4 adımlı, tamamen işlem odaklı sorular (paragraf/yeni nesil metin YOK).
- Her bant (1-10 / 11-20 / 21-30) içinde de alt konular mümkün olduğunca karışık dağılsın (aynı bandın tamamı tek bir alt konudan gelmesin).

KAZANIM ID FORMATI: [KONU_KODU]_[KAZANIM_KODU], BÜYÜK HARF + alt çizgi. Örnek: "GEO_PISAGOR", "SAYI_USLU_CARPMA". Farklı alt konulardaki kazanımlar birbirinden AÇIKÇA farklı kodlar kullanmalı (çakışma olmasın).

VERİ ALANLARI (her soru objesi için, İSTİSNASIZ hepsi dolu olacak):
- soruNo: 1-30 arası tam sayı, tekrarsız.
- subtopicAdi: bu sorunun ait olduğu alt konunun adı — AŞAĞIDA VERİLEN LİSTEDEKİ isimlerden BİRİYLE BİREBİR AYNI olmalı (başka bir isim uydurma).
- kazanimId: yukarıdaki formata uygun.
- questionText: soru metni.
- finalAnswer: en kısa net sonuç (örn. "5\\\\sqrt{3}" veya "x = 12").
- detailedSolution: adım adım detaylı çözüm.
- diagnosticComment: "Öğrenci bu soruda zorlandıysa: [Kazanım Adı] konusundaki [Eksik Kural/İşlem] eksiktir." formatında.

TEKNİK FORMAT: Çıktı SADECE geçerli bir JSON dizisi (tam 30 eleman) olacak — başka hiçbir açıklama, markdown çiti veya metin ekleme. LaTeX kullan, çift ters eğik çizgi tercih et (\\\\sqrt{}, \\\\frac{}{}).`;

// Faz Z13 — kök neden düzeltmesi: round N-1 prompt'u eskiden SADECE
// "sayıları önceki turlardan farklı yap" diye BELİRSİZ bir talimat
// veriyordu, modelin NEYİ tekrarlamaması gerektiğini GÖSTERMİYORDU. Sonuç:
// aynı kazanım için model hep aynı "kanonik" örneğe (ör. hep "3√5+2√5"
// tarzı) yakınsıyordu ve tur sayısı arttıkça çakışma oranı da artıyordu
// (turlar arası çeşitlilik kontrolü canlı taramada bunu kanıtladı — bkz.
// checkCrossRoundDuplication). Bu fonksiyon her soruNo için ÖNCEKİ
// turlarda o slotta kullanılmış sayı/işlem imzalarını (numericSignature —
// yüzeysel Türkçe ifade farkını YOK SAYAR, sadece sayı+operatör dizisini
// alır) TOPLAYIP modele SOMUT bir "bunlardan kaçın" listesi olarak
// gösterir. Tam soru metnini DEĞİL sadece kompakt imzayı göstermek, tur
// sayısı arttıkça prompt boyutunun kontrolsüz büyümesini önler.
function buildAvoidDuplicationBlock(priorRoundsQuestions: { soruNo: number; questionText: string }[][]): string {
  if (priorRoundsQuestions.length === 0) return "";
  const bySoruNo = new Map<number, Set<string>>();
  for (const round of priorRoundsQuestions) {
    for (const q of round) {
      const sig = numericSignature(q.questionText);
      if (sig.length === 0) continue;
      if (!bySoruNo.has(q.soruNo)) bySoruNo.set(q.soruNo, new Set());
      bySoruNo.get(q.soruNo)!.add(sig);
    }
  }
  if (bySoruNo.size === 0) return "";
  const lines = [...bySoruNo.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([soruNo, sigs]) => `soruNo ${soruNo}: ${[...sigs].map((s) => `[${s.replace(/\|/g, " ")}]`).join(", ")}`)
    .join("\n");
  return `\n\nÇEŞİTLİLİK UYARISI (ÇOK ÖNEMLİ): Aşağıda her soruNo için ÖNCEKİ turlarda KULLANILMIŞ sayı/işlem dizileri listelenmiş. Bu turda AYNI soruNo'da bu dizilerin HİÇBİRİNİ (aynı sayılar, aynı işlem sırası) TEKRARLAMA — sayıları/bağlamı MUTLAKA gözle görülür şekilde farklı seç:\n${lines}`;
}

function topicLabel(t: FlattenedTopic): string {
  return `${t.grade}. Sınıf > ${t.topicName}`;
}

function subtopicListBlock(t: FlattenedTopic): string {
  return t.subtopics.map((s) => `- ${s.subtopicName}`).join("\n");
}

export function buildGenelRound1UserPrompt(topic: FlattenedTopic): string {
  return `SINIF SEVİYESİ: ${topic.grade}. Sınıf
KONU: ${topicLabel(topic)}

Bu konunun alt konuları (SADECE bu listedeki isimleri subtopicAdi olarak kullan):
${subtopicListBlock(topic)}

Bu, bu konu için İLK tur. Her alt konuyu 1-3 mikro kazanıma (kazanımId) böl, 30 soruyu tüm alt konulara dağıt. Seçtiğin (subtopicAdi, kazanımId) eşlemesi ve HANGİ SIRAYLA/KAÇ KEZ kullandığın SONRAKİ TURLARDA aynen tekrar kullanılacak — bu yüzden mantıklı, konuyu iyi kapsayan bir yapı seç.

Sadece JSON dizisini döndür.`;
}

export function buildGenelRoundNUserPrompt(
  topic: FlattenedTopic,
  blueprint: { subtopicId: string; kazanimId: string; isMultipleChoice: boolean }[],
  roundNumber: number,
  priorRoundsQuestions: { soruNo: number; questionText: string }[][] = [],
): string {
  const idToName = new Map(topic.subtopics.map((s) => [s.subtopicId, s.subtopicName]));
  // Faz Z18 — kullanıcı talebi: "aynı havuzdaki sorular aynı tip olsun" —
  // bir slot round 1'de hangi formatta (çoktan seçmeli/açık uçlu) üretildiyse
  // bu turda da AYNI formatta üretilmeli, aksi halde öğrenci aynı kazanımı
  // havuzdan farklı denemelerde farklı formatlarda görür.
  const blueprintLines = blueprint
    .map((slot, i) => `soruNo ${i + 1}: subtopicAdi="${idToName.get(slot.subtopicId) ?? slot.subtopicId}", kazanimId="${slot.kazanimId}", format="${slot.isMultipleChoice ? "çoktan seçmeli (a/b/c/d şıklı)" : "açık uçlu"}"`)
    .join("\n");
  return `SINIF SEVİYESİ: ${topic.grade}. Sınıf
KONU: ${topicLabel(topic)}

Bu, bu konu için Tur ${roundNumber}. AŞAĞIDAKİ (subtopicAdi, kazanımId, format) eşlemesini BİREBİR ve SIRASIYLA kullan — bu turdaki 30 soru bu diziye tam uymalı. "format" alanı ÖNEMLİ: o soruNo'da ÖNCEKİ turda hangi format kullanıldıysa (çoktan seçmeli ya da açık uçlu) BU turda da AYNI formatı kullan — aynı havuzdaki (aynı kazanım) sorular tutarlı bir formatta kalmalı:

${blueprintLines}

Sayıları/bağlamı/senaryoyu ÖNCEKİ turlardan FARKLI yap, ama subtopicAdi/kazanımId/format'ı DEĞİŞTİRME.${buildAvoidDuplicationBlock(priorRoundsQuestions)}

Sadece JSON dizisini döndür.`;
}

// ── "alt_konu" — 10 soru, TEK bir alt konu, ORTA seviye ──
//
// Kullanıcı talebi birebir: "temel değil orta seviye sorular olucak...
// direkt 2 kök 2 değil, bunla yapılabilecek işlemler, toplamalar, formüllü
// sorular" — yani GİRİŞ/tanım-okuma bandı tamamen YOK, tüm 10 soru en az
// bir kuralın somut bir işlemle UYGULANMASINI gerektiriyor.

export const SYSTEM_PROMPT_ALT_KONU = `SEN MÜKEMMEL BİR LİSE MATEMATİK ÖLÇME-DEĞERLENDİRME VE PEDAGOJİ UZMANISIN.

GÖREV: Verilen TEK bir ALT KONUYA özel, 10 soruluk bir "havuz turu" üreteceksin. Bu sorular sabit bir sınav kağıdı DEĞİL, rastgele seçimle öğrenciye sunulacak bir SORU HAVUZUNUN parçasıdır.

${MEB_SCOPE_CLAUSE}

${SELF_CHECK_CLAUSE}

SORU YAPISI (ÇOK ÖNEMLİ):
- Sorular ÖNCELİKLE açık uçlu/klasik matematik sorularıdır — ama bazı kazanımlar (kavram karşılaştırması, "hangisi X değildir" tipi sorular) doğası gereği seçenekli formata yakındır; bu durumda a)/b)/c)/d) şıklı sormakta serbestsin (bkz. KENDİ KENDİNİ KONTROL ET kural 4) — zorla açık uçlu bir versiyon uydurmana gerek yok.
- TÜM 10 SORU ORTA SEVİYE olacak — doğrudan tanım/sembol okuma/ezber TEMEL sorular KESİNLİKLE YASAK.
  - YANLIŞ örnek (çok temel, YASAK): "√2 × √2 kaçtır?"
  - DOĞRU örnek (orta seviye, bir kuralın işlemle uygulanması): "3√5 + 2√5 − √20 ifadesinin sonucu kaçtır?"
- soruNo 1-5: konunun TEK bir kuralının/formülünün somut sayılarla/ifadelerle UYGULANMASI (toplama, çarpma, sadeleştirme, formül yerine koyma vb. — asla salt tanım sorma).
- soruNo 6-10: konunun birden fazla kuralını/kavramını BİRLEŞTİREN, ama 30 soruluk "genel konu" testinin en zor bandı kadar karmaşık OLMAYAN orta-üst seviye sorular.

KAZANIM ID FORMATI: [KONU_KODU]_[KAZANIM_KODU], BÜYÜK HARF + alt çizgi. Örnek: "GEO_PISAGOR", "SAYI_USLU_CARPMA".

VERİ ALANLARI (her soru objesi için, İSTİSNASIZ hepsi dolu olacak):
- soruNo: 1-10 arası tam sayı, tekrarsız.
- kazanimId: yukarıdaki formata uygun.
- questionText: soru metni.
- finalAnswer: en kısa net sonuç (örn. "5\\\\sqrt{3}" veya "x = 12").
- detailedSolution: adım adım detaylı çözüm.
- diagnosticComment: "Öğrenci bu soruda zorlandıysa: [Kazanım Adı] konusundaki [Eksik Kural/İşlem] eksiktir." formatında.

TEKNİK FORMAT: Çıktı SADECE geçerli bir JSON dizisi (tam 10 eleman) olacak — başka hiçbir açıklama, markdown çiti veya metin ekleme. LaTeX kullan, çift ters eğik çizgi tercih et (\\\\sqrt{}, \\\\frac{}{}).`;

function subtopicLabel(s: FlattenedSubtopic): string {
  return `${s.grade}. Sınıf > ${s.topicName} > ${s.subtopicName}`;
}

export function buildAltKonuRound1UserPrompt(subtopic: FlattenedSubtopic): string {
  return `ALT KONU: ${subtopicLabel(subtopic)}

Bu, bu alt konu için İLK tur. Bu alt konuyu 2-4 mikro kazanıma (kazanımId) böl ve 10 soruyu bunlara dağıt (bir kazanım birden fazla soruda geçebilir). Seçtiğin kazanımId kümesi ve HANGİ SIRAYLA/KAÇ KEZ kullandığın SONRAKİ TURLARDA aynen tekrar kullanılacak.

Sadece JSON dizisini döndür.`;
}

export function buildAltKonuRoundNUserPrompt(
  subtopic: FlattenedSubtopic,
  blueprint: string[],
  roundNumber: number,
  priorRoundsQuestions: { soruNo: number; questionText: string }[][] = [],
): string {
  const blueprintLines = blueprint.map((k, i) => `soruNo ${i + 1}: ${k}`).join("\n");
  return `ALT KONU: ${subtopicLabel(subtopic)}

Bu, bu alt konu için Tur ${roundNumber}. AŞAĞIDAKİ kazanımId sırasını BİREBİR ve SIRASIYLA kullan:

${blueprintLines}

Sayıları/bağlamı/senaryoyu ÖNCEKİ turlardan FARKLI yap, ama kazanımId dizisini DEĞİŞTİRME.${buildAvoidDuplicationBlock(priorRoundsQuestions)}

Sadece JSON dizisini döndür.`;
}

export function buildRetryCorrectionSuffix(errorSummary: string): string {
  return `\n\nÖNCEKİ YANITIN GEÇERSİZDİ, ŞU HATA(LAR) DÜZELTİLMELİ: ${errorSummary}\nLütfen SADECE düzeltilmiş, geçerli JSON dizisini tekrar döndür.`;
}

// ── Hedefli düzeltme — SADECE içerik denetiminin (verify-content.ts)
// "sorunlu" bulduğu soruları yeniden yazdırır, turun TAMAMINI DEĞİL. ──
//
// Faz Z9 — kullanıcı talebi: "hatalı sorudan dolayı baştan yapması sadece
// hatalı olan soruyu düzeltsin". Önceden 30 sorunun 1'i bile sorunlu
// bulunsa turun TAMAMI (30 soru) yeniden üretiliyordu — hem israf hem de
// zaten DOĞRU olan 29 sorunun bir daha üretilip tekrar denetlenmesi
// anlamsızdı. Bu prompt SADECE flawed soruların soruNo/kazanımId'sini
// (ve "genel" için subtopicAdi'sini) SABİT tutup İÇERİĞİNİ (questionText/
// finalAnswer/detailedSolution/diagnosticComment) yeniden yazdırır —
// blueprint yapısı (hangi soruNo hangi kazanıma ait) ASLA bozulmaz.
export const SYSTEM_PROMPT_FIX = `SEN MÜKEMMEL BİR LİSE MATEMATİK ÖLÇME-DEĞERLENDİRME VE PEDAGOJİ UZMANISIN.

GÖREV: Sana daha önce üretilmiş, kalite kontrolünde SORUNLU bulunmuş birkaç soru verilecek. Her biri için verilen SORUN AÇIKLAMASINI dikkatle oku ve SIFIRDAN, sorunu içermeyen YENİ bir soru/çözüm yaz — aynı kazanımı (konuyu) ölçmeye devam etmeli ama eski (hatalı) hali TEKRARLAMA.

${SELF_CHECK_CLAUSE}

VERİ ALANLARI (her soru için, İSTİSNASIZ hepsi dolu olacak): soruNo (verilenle AYNI), questionText, finalAnswer, detailedSolution, diagnosticComment. kazanımId'yi veya alt konuyu DEĞİŞTİRME/EMİTME — sadece bu 5 alanı döndür.

⚠️ diagnosticComment KURALI (canlı üretimde bulunan gerçek hata): bu alan HER ZAMAN "Öğrenci bu soruda zorlandıysa: [Kazanım Adı] konusundaki [Eksik Kural/İşlem] eksiktir." formatında, öğrenciye gösterilecek pedagojik bir tanı notu olmalı. ASLA (a) düzeltme sürecini anlatan bir meta-açıklama YAZMA (YANLIŞ örnek: "Önceki soru çoktan seçmeli olduğu için geçersizdi, bu yeni soru..." veya "Önceki çözümde ... hatalı işlem yapılmıştı, düzeltildi..."), (b) "doğru yapılmış ve sonuç ile çözüm tutarlıdır" gibi bir DOĞRULAMA cümlesi YAZMA — bunların ikisi de öğrenciye HİÇBİR ANLAM ifade etmez. SORUN AÇIKLAMASI sana sadece NEYİ düzeltmen gerektiğini anlatır, diagnosticComment'e KOPYALANMAZ/ÖZETLENMEZ.

TEKNİK FORMAT: Çıktı SADECE geçerli bir JSON dizisi olacak (verilen soru sayısı kadar eleman) — başka açıklama ekleme. LaTeX kullan, çift ters eğik çizgi tercih et (\\\\sqrt{}, \\\\frac{}{}).`;

export type FlawedQuestionContext = { soruNo: number; kazanimId: string; subtopicName?: string; oldQuestionText: string; reason: string };

// Faz Z10 — "farklı yaklaşım" tekniği: bir soru düzeltmeden SONRA hâlâ
// sorunlu bulunduysa (2. deneme), aynı zihniyetle/sayı seçimiyle AYNI
// hatayı tekrarlama riski var — isRetry=true iken açıkça FARKLI bir
// sayı/senaryo/yaklaşım kullanmasını, önceki düzeltmedeki mantığı
// tekrarlamamasını istiyoruz. Başarısız bir düzeltme döngüsüne
// takılmayı önlemeye yönelik bir çeşitlilik enjeksiyonu.
// Faz Z13 — kök neden düzeltmesi: reason alanı TEK bir çakışan örneği
// gösteriyordu (checkCrossRoundDuplication ilk eşleşmede duruyor), model
// O TEK örnekten kaçarken zaten kullanılmış BAŞKA bir örneğe çarpıyordu
// (canlı düzeltme turlarında GÖZLEMLENDİ: aynı soru 2 denemede de farklı
// ama YİNE kullanılmış bir değere yakınsadı). Round N prompt'undaki AYNI
// buildAvoidDuplicationBlock burada da kullanılarak, düzeltme modeline
// SADECE tek bir örnek değil, o soruNo'da BUGÜNE KADAR kullanılmış TÜM
// örnekler gösterilir.
export function buildFixUserPrompt(
  flawed: FlawedQuestionContext[],
  isRetry = false,
  priorRoundsQuestions: { soruNo: number; questionText: string }[][] = [],
): string {
  const block = flawed
    .map((f) => `soruNo ${f.soruNo} (kazanımId: ${f.kazanimId}${f.subtopicName ? `, alt konu: ${f.subtopicName}` : ""}):\nEski (hatalı) soru: ${f.oldQuestionText}\nSORUN: ${f.reason}`)
    .join("\n\n");
  const retryNote = isRetry ? `\n\n⚠️ ÖNEMLİ: Bu sorular DAHA ÖNCE BİR KEZ "düzeltildi" ama düzeltme de hatalıydı. Bu sefer TAMAMEN FARKLI sayılar/senaryo kullan ve hesabını adım adım, her adımdan sonra tekrar kontrol ederek yap — aynı hatayı TEKRARLAMA.` : "";
  const relevantSoruNos = new Set(flawed.map((f) => f.soruNo));
  const avoidBlock = buildAvoidDuplicationBlock(priorRoundsQuestions.map((round) => round.filter((q) => relevantSoruNos.has(q.soruNo))));
  return `Aşağıdaki ${flawed.length} soruyu düzelt:\n\n${block}${retryNote}${avoidBlock}\n\nSadece JSON dizisini döndür.`;
}
