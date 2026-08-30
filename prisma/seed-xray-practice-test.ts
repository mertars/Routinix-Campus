// Akademik Röntgen — Test 1 (Konu Bilgisi) içerik alım scripti. Kullanıcı
// soruları KENDİSİ hazırlayıp bu şemadaki JSON'u veriyor (bkz. konu/
// test_adi/sorular[soruNo/kazanimId/questionText/finalAnswer/
// detailedSolution/diagnosticComment]) — bu script o JSON'u
// XrayPracticeQuestion satırlarına çevirir. AYNI testId için yeniden
// çalıştırılırsa (içerik güncellendiğinde) o testin ESKİ sorularını silip
// YENİDEN yazar — idempotent, ama tarihsel bir versiyon geçmişi TUTMAZ
// (bu bir içerik yönetim sistemi değil, basit bir alım scripti).
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

type IncomingQuestion = {
  soruNo: number;
  kazanimId: string;
  questionText: string;
  finalAnswer: string;
  detailedSolution: string;
  diagnosticComment: string;
};

type IncomingTest = { konu: string; test_adi: string; sorular: IncomingQuestion[] };

function slugify(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Kullanıcının paylaştığı örnek — "konu" alanı ("9. Sınıf - İntegral")
// gerçek müfredatta (bkz. lib/mock-data.ts > CURRICULUM_TREE) İntegral'in
// 12. sınıf konusu olmasıyla ÇELİŞİYOR; içerik SESSİZCE "düzeltilmedi" —
// olduğu gibi test_adi/konu görüntüleme metni olarak saklanıyor, sadece
// puanlama/TopicMasteryAssessment entegrasyonu için EN YAKIN gerçek
// subtopicId (mt12b-1, "Belirsiz İntegral") kullanıldı.
const TEST: IncomingTest = {
  konu: "9. Sınıf - İntegral",
  test_adi: "Test 1: İki Aşamalı Kontrollü Çalışma Yaprağı",
  sorular: [
    { soruNo: 1, kazanimId: "INTEGRAL_SEMBOL_TANIM", questionText: "\\int f(x)\\,dx sembolü ne anlama gelir?", finalAnswer: "f(x) fonksiyonunun belirsiz integralini (ilkel fonksiyonunu)", detailedSolution: "∫f(x)dx gösterimi, türevi f(x) olan fonksiyonların (ilkel fonksiyonların) tamamını, yani f(x)'in belirsiz integralini ifade eder.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki integral sembolünün anlamı eksiktir." },
    { soruNo: 2, kazanimId: "INTEGRAL_TUREV_ILISKISI", questionText: "İntegral alma işlemi, türev alma işleminin tersi midir?", finalAnswer: "Evet", detailedSolution: "İntegral, türevin ters işlemidir; bir fonksiyonun integrali alınıp sonucun türevi alındığında başlangıçtaki fonksiyona geri dönülür.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki integral-türev ters işlem ilişkisi eksiktir." },
    { soruNo: 3, kazanimId: "INTEGRAL_SEMBOL_TANIM", questionText: "∫f(x)dx ifadesindeki 'dx' sembolü neyi belirtir?", finalAnswer: "İntegralin x değişkenine göre alındığını", detailedSolution: "dx sembolü, integrasyon işleminin hangi değişkene göre yapıldığını belirtir; burada integral x değişkenine göre alınmaktadır.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki integral değişkenini (dx) tanıma eksiktir." },
    { soruNo: 4, kazanimId: "INTEGRAL_SABIT_C", questionText: "Belirsiz integral sonucuna eklenen '+C' ifadesindeki C neyi temsil eder?", finalAnswer: "İntegral sabitini (herhangi bir gerçek sabit sayıyı)", detailedSolution: "Bir sabitin türevi 0 olduğundan, aynı türevi veren sonsuz sayıda fonksiyon vardır; bu belirsizliği ifade etmek için belirsiz integral sonucuna keyfi bir sabit olan C eklenir.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki integral sabiti (+C) kavramının anlamı eksiktir." },
    { soruNo: 5, kazanimId: "INTEGRAL_TEMEL_KURAL", questionText: "∫1\\,dx integralinin sonucu nedir?", finalAnswer: "x + C", detailedSolution: "1 sayısının integrali x'tir, sonuca integral sabiti eklenir: ∫1 dx = x + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki ∫1 dx = x + C temel kuralı eksiktir." },
    { soruNo: 6, kazanimId: "INTEGRAL_TEMEL_KURAL", questionText: "∫0\\,dx integralinin sonucu nedir?", finalAnswer: "C", detailedSolution: "0'ın integrali herhangi bir sabittir: ∫0 dx = C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki ∫0 dx = C temel kuralı eksiktir." },
    { soruNo: 7, kazanimId: "INTEGRAL_KUVVET_KURALI", questionText: "∫x^{n}\\,dx integralinin genel formülü nedir? (n ≠ -1)", finalAnswer: "\\frac{x^{n+1}}{n+1} + C", detailedSolution: "Kuvvet kuralına göre, x^n ifadesinin integrali alınırken üs 1 artırılır ve yeni üse bölünür: ∫x^n dx = x^(n+1)/(n+1) + C (n≠-1).", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki kuvvet kuralının (∫x^n dx = x^(n+1)/(n+1)+C) genel formülü eksiktir." },
    { soruNo: 8, kazanimId: "INTEGRAL_KUVVET_KURALI", questionText: "∫x\\,dx integralinin sonucunu bulunuz.", finalAnswer: "\\frac{x^{2}}{2} + C", detailedSolution: "Kuvvet kuralına göre ∫x^1 dx = x^2/2 + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki kuvvet kuralını basit bir ifadeye uygulama becerisi eksiktir." },
    { soruNo: 9, kazanimId: "INTEGRAL_KUVVET_KURALI", questionText: "∫x^{2}\\,dx integralinin sonucunu bulunuz.", finalAnswer: "\\frac{x^{3}}{3} + C", detailedSolution: "Kuvvet kuralına göre ∫x^2 dx = x^3/3 + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki kuvvet kuralını basit bir ifadeye uygulama becerisi eksiktir." },
    { soruNo: 10, kazanimId: "INTEGRAL_KUVVET_KURALI", questionText: "∫x^{3}\\,dx integralinin sonucunu bulunuz.", finalAnswer: "\\frac{x^{4}}{4} + C", detailedSolution: "Kuvvet kuralına göre ∫x^3 dx = x^4/4 + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki kuvvet kuralını basit bir ifadeye uygulama becerisi eksiktir." },
    { soruNo: 11, kazanimId: "INTEGRAL_SABIT_KATSAYI_KURALI", questionText: "∫3x^{2}\\,dx integralini bulunuz.", finalAnswer: "x^{3} + C", detailedSolution: "Sabit katsayı integral dışına alınır: 3.∫x^2 dx = 3.(x^3/3) + C = x^3 + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki sabit katsayılı ifadenin integralini alma kuralı eksiktir." },
    { soruNo: 12, kazanimId: "INTEGRAL_SABIT_KATSAYI_KURALI", questionText: "∫5x^{4}\\,dx integralini bulunuz.", finalAnswer: "x^{5} + C", detailedSolution: "5.∫x^4 dx = 5.(x^5/5) + C = x^5 + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki sabit katsayılı ifadenin integralini alma kuralı eksiktir." },
    { soruNo: 13, kazanimId: "INTEGRAL_TOPLAM_KURALI", questionText: "∫(x^{2}+x)\\,dx integralini bulunuz.", finalAnswer: "\\frac{x^{3}}{3} + \\frac{x^{2}}{2} + C", detailedSolution: "Toplam kuralına göre her terim ayrı ayrı integrallenir: ∫x^2 dx + ∫x dx = x^3/3 + x^2/2 + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki toplam kuralı (iki fonksiyonun toplamının integrali) eksiktir." },
    { soruNo: 14, kazanimId: "INTEGRAL_FARK_KURALI", questionText: "∫(x^{3}-x)\\,dx integralini bulunuz.", finalAnswer: "\\frac{x^{4}}{4} - \\frac{x^{2}}{2} + C", detailedSolution: "Fark kuralına göre her terim ayrı ayrı integrallenir: ∫x^3 dx - ∫x dx = x^4/4 - x^2/2 + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki fark kuralı (iki fonksiyonun farkının integrali) eksiktir." },
    { soruNo: 15, kazanimId: "INTEGRAL_TEMEL_KURAL", questionText: "∫4\\,dx integralini bulunuz.", finalAnswer: "4x + C", detailedSolution: "Bir sabitin integrali, sabit ile x'in çarpımıdır: ∫4 dx = 4x + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki sabit sayının integralini alma kuralı eksiktir." },
    { soruNo: 16, kazanimId: "INTEGRAL_TEMEL_KURAL", questionText: "∫7\\,dx integralini bulunuz.", finalAnswer: "7x + C", detailedSolution: "∫7 dx = 7x + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki sabit sayının integralini alma kuralı eksiktir." },
    { soruNo: 17, kazanimId: "INTEGRAL_TOPLAM_KURALI", questionText: "∫(2x+3)\\,dx integralini bulunuz.", finalAnswer: "x^{2} + 3x + C", detailedSolution: "Her terim ayrı integrallenir: ∫2x dx + ∫3 dx = x^2 + 3x + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki sabit katsayı ve toplam kurallarını birlikte kullanma becerisi eksiktir." },
    { soruNo: 18, kazanimId: "INTEGRAL_FARK_KURALI", questionText: "∫(6x^{2}-2)\\,dx integralini bulunuz.", finalAnswer: "2x^{3} - 2x + C", detailedSolution: "Her terim ayrı integrallenir: ∫6x^2 dx - ∫2 dx = 2x^3 - 2x + C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki sabit katsayı ve fark kurallarını birlikte kullanma becerisi eksiktir." },
    { soruNo: 19, kazanimId: "INTEGRAL_BELIRLI_TEMEL", questionText: "\\int_{0}^{2} x\\,dx belirli integralini hesaplayınız.", finalAnswer: "2", detailedSolution: "Önce ilkel fonksiyon bulunur: x^2/2. Sınır değerleri yerine yazılır: [x^2/2] (0'dan 2'ye) = (2^2/2) - (0^2/2) = 2 - 0 = 2.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki belirli integral hesaplama (sınır değerlerini yerine koyma) becerisi eksiktir." },
    { soruNo: 20, kazanimId: "INTEGRAL_BELIRLI_TEMEL", questionText: "\\int_{1}^{3} 2x\\,dx belirli integralini hesaplayınız.", finalAnswer: "8", detailedSolution: "İlkel fonksiyon: x^2. Sınır değerleri yerine yazılır: [x^2] (1'den 3'e) = 3^2 - 1^2 = 9 - 1 = 8.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki belirli integral hesaplama (sınır değerlerini yerine koyma) becerisi eksiktir." },
    { soruNo: 21, kazanimId: "INTEGRAL_POLINOM_KAPSAMLI", questionText: "∫(3x^{2}+2x-5)\\,dx integralini bulunuz.", finalAnswer: "x^{3} + x^{2} - 5x + C", detailedSolution: "Her terim ayrı integrallenir: ∫3x^2 dx=x^3, ∫2x dx=x^2, ∫(-5) dx=-5x. Toplam: x^3+x^2-5x+C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki üç terimli bir polinomun integralini adım adım alma becerisi eksiktir." },
    { soruNo: 22, kazanimId: "INTEGRAL_POLINOM_KAPSAMLI", questionText: "∫(4x^{3}-6x^{2}+2)\\,dx integralini bulunuz.", finalAnswer: "x^{4} - 2x^{3} + 2x + C", detailedSolution: "Her terim ayrı integrallenir: ∫4x^3 dx=x^4, ∫(-6x^2) dx=-2x^3, ∫2 dx=2x. Toplam: x^4-2x^3+2x+C.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki üç terimli bir polinomun integralini adım adım alma becerisi eksiktir." },
    { soruNo: 23, kazanimId: "INTEGRAL_TERS_TUREV_UYGULAMA", questionText: "f'(x) = 2x+3 ve f(0)=5 olduğuna göre f(x) fonksiyonunu bulunuz.", finalAnswer: "f(x) = x^{2} + 3x + 5", detailedSolution: "Önce integral alınır: f(x) = ∫(2x+3)dx = x^2+3x+C. f(0)=5 koşulu kullanılır: 0+0+C=5, C=5. Sonuç: f(x) = x^2+3x+5.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki integral sabitini (C) verilen koşuldan bulma becerisi eksiktir." },
    { soruNo: 24, kazanimId: "INTEGRAL_TERS_TUREV_UYGULAMA", questionText: "f'(x) = 3x^{2}-4 ve f(1)=2 olduğuna göre f(x) fonksiyonunu bulunuz.", finalAnswer: "f(x) = x^{3} - 4x + 5", detailedSolution: "Önce integral alınır: f(x) = ∫(3x^2-4)dx = x^3-4x+C. f(1)=2 koşulu kullanılır: 1-4+C=2, C=5. Sonuç: f(x) = x^3-4x+5.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki integral sabitini (C) verilen koşuldan bulma becerisi eksiktir." },
    { soruNo: 25, kazanimId: "INTEGRAL_BELIRLI_KAPSAMLI", questionText: "\\int_{0}^{3} (2x+1)\\,dx belirli integralini hesaplayınız.", finalAnswer: "12", detailedSolution: "İlkel fonksiyon: x^2+x. Sınırlar yerine yazılır: [x^2+x] (0'dan 3'e) = (9+3) - (0+0) = 12.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki çok terimli ifadelerde belirli integral hesaplama becerisi eksiktir." },
    { soruNo: 26, kazanimId: "INTEGRAL_BELIRLI_KAPSAMLI", questionText: "\\int_{1}^{4} 3x^{2}\\,dx belirli integralini hesaplayınız.", finalAnswer: "63", detailedSolution: "İlkel fonksiyon: x^3. Sınırlar yerine yazılır: [x^3] (1'den 4'e) = 4^3 - 1^3 = 64 - 1 = 63.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki çok terimli ifadelerde belirli integral hesaplama becerisi eksiktir." },
    { soruNo: 27, kazanimId: "INTEGRAL_BELIRLI_KAPSAMLI", questionText: "\\int_{-1}^{2} (x^{2}-1)\\,dx belirli integralini hesaplayınız.", finalAnswer: "0", detailedSolution: "İlkel fonksiyon: x^3/3 - x. x=2 için: 8/3-2=2/3. x=-1 için: -1/3-(-1)=-1/3+1=2/3. Sonuç: 2/3 - 2/3 = 0.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki negatif sınır değeriyle belirli integral hesaplama becerisi eksiktir." },
    { soruNo: 28, kazanimId: "INTEGRAL_BELIRLI_KAPSAMLI", questionText: "\\int_{0}^{2} (x^{2}+2x)\\,dx belirli integralini hesaplayınız.", finalAnswer: "\\frac{20}{3}", detailedSolution: "İlkel fonksiyon: x^3/3 + x^2. x=2 için: 8/3+4=8/3+12/3=20/3. x=0 için: 0. Sonuç: 20/3 - 0 = 20/3.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki çok terimli ifadelerde belirli integral hesaplama becerisi eksiktir." },
    { soruNo: 29, kazanimId: "INTEGRAL_HIZ_KONUM_UYGULAMA", questionText: "Bir cismin hızı v(t)=3t^{2}-2t (m/s) fonksiyonu ile verilmektedir. t=0 anındaki konumu x(0)=1 metre olduğuna göre konum fonksiyonunu x(t) bulunuz.", finalAnswer: "x(t) = t^{3} - t^{2} + 1", detailedSolution: "Konum, hızın integralidir: x(t) = ∫(3t^2-2t)dt = t^3-t^2+C. x(0)=1 koşulundan C=1. Sonuç: x(t)=t^3-t^2+1.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki hız-konum ilişkisini (integral alarak konum fonksiyonu bulma) fiziksel bağlamda uygulama becerisi eksiktir." },
    { soruNo: 30, kazanimId: "INTEGRAL_HIZ_KONUM_UYGULAMA", questionText: "Bir cismin hızı v(t)=4t+1 (m/s) fonksiyonu ile verilmektedir. Cismin t=0'dan t=3'e kadar aldığı yolu (belirli integral ile) hesaplayınız.", finalAnswer: "21 metre", detailedSolution: "Alınan yol, hızın belirli integralidir: \\int_0^3 (4t+1)dt. İlkel fonksiyon: 2t^2+t. Sınırlar yerine yazılır: [2t^2+t] (0'dan 3'e) = (18+3) - 0 = 21 metre.", diagnosticComment: "Öğrenci bu soruda zorlandıysa: İntegral konusundaki belirli integral ile alınan yolu hesaplama (fiziksel uygulama) becerisi eksiktir." },
  ],
};

const SUBJECT = "Matematik";
const SUBTOPIC_ID = "mt12b-1"; // en yakın gerçek müfredat eşleşmesi — bkz. yukarıdaki not

async function ingest(test: IncomingTest) {
  const testId = slugify(test.test_adi);
  await prisma.xrayPracticeQuestion.deleteMany({ where: { testId } });
  await prisma.xrayPracticeQuestion.createMany({
    data: test.sorular.map((q) => ({
      subject: SUBJECT,
      subtopicId: SUBTOPIC_ID,
      testId,
      testName: test.test_adi,
      order: q.soruNo,
      kazanimId: q.kazanimId,
      prompt: q.questionText,
      correctAnswer: q.finalAnswer,
      solution: q.detailedSolution,
      checks: q.diagnosticComment,
    })),
  });
  console.log(`"${test.test_adi}" (${testId}): ${test.sorular.length} soru yazıldı.`);
}

async function main() {
  await ingest(TEST);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
