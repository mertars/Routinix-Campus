// Akademik Röntgen Faz A — iki yeni test türü için GEÇİCİ, elle yazılmış
// örnek içerik (bkz. prisma/seed-xray-questions.ts'teki AYNI "placeholder,
// AI gelince değişecek" gerekçesi). Sadece mt9-2 (Rasyonel ve Gerçek
// Sayılar — köklü ifadeler) konusunu kapsar, Faz B/C'nin arayüzlerini uçtan
// uca doğrulamaya yeter.
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

const SUBJECT = "Matematik";
const SUBTOPIC = "mt9-2";

async function seedPracticeQuestions() {
  const questions = [
    {
      difficulty: 1,
      format: "OPEN_ENDED" as const,
      prompt: "2√3 ifadesini tek bir kök içine alınmış (a formunda) yazınız.",
      options: [],
      correctAnswer: "√12",
      solution: "a√b = √(a²·b) kuralı kullanılır: 2√3 = √(2²·3) = √12.",
      checks: "Katsayıyı kökün içine alma kuralını (a√b = √(a²b)) biliyor mu?",
    },
    {
      difficulty: 1,
      format: "MULTIPLE_CHOICE" as const,
      prompt: "√8 ifadesinin en sade hali hangisidir?",
      options: ["2√2", "4√2", "√4", "8"],
      correctAnswer: "2√2",
      solution: "8 = 4·2 olduğundan √8 = √4·√2 = 2√2.",
      checks: "Kök içindeki sayıyı tam kare çarpanına ayırıp dışarı çıkarabiliyor mu?",
    },
    {
      difficulty: 2,
      format: "OPEN_ENDED" as const,
      prompt: "√18 ifadesini a√b formunda (b mümkün olduğunca küçük tam sayı) yazınız.",
      options: [],
      correctAnswer: "3√2",
      solution: "18 = 9·2, √18 = √9·√2 = 3√2.",
      checks: "Tam kare çarpanını (9) doğru seçip kökten çıkarabiliyor mu?",
    },
    {
      difficulty: 3,
      format: "MULTIPLE_CHOICE" as const,
      prompt: "√12 + √27 işleminin sonucu nedir?",
      options: ["√39", "5√3", "3√13", "13√3"],
      correctAnswer: "5√3",
      solution: "√12 = 2√3, √27 = 3√3. Aynı köklü terimler toplanır: 2√3 + 3√3 = 5√3.",
      checks: "Farklı köklü ifadeleri ortak köke indirip toplayabiliyor mu?",
    },
    {
      difficulty: 4,
      format: "OPEN_ENDED" as const,
      prompt: "√50 - √18 + √8 işleminin sonucunu bulunuz.",
      options: [],
      correctAnswer: "4√2",
      solution: "√50 = 5√2, √18 = 3√2, √8 = 2√2. 5√2 - 3√2 + 2√2 = 4√2.",
      checks: "Üç farklı köklü terimi aynı anda sadeleştirip doğru işaretle işlem yapabiliyor mu?",
    },
    {
      difficulty: 5,
      format: "MULTIPLE_CHOICE" as const,
      prompt: "(√3 + √12) × √3 işleminin sonucu kaçtır?",
      options: ["9", "3√3", "6√3", "12"],
      correctAnswer: "9",
      solution: "√12 = 2√3 olduğundan parantez içi √3 + 2√3 = 3√3 olur. 3√3 × √3 = 3 × 3 = 9.",
      checks: "Sadeleştirme ile dağılma özelliğini bir arada, çok adımlı uygulayabiliyor mu?",
    },
  ];

  let created = 0;
  for (const q of questions) {
    const existing = await prisma.xrayPracticeQuestion.findFirst({ where: { subtopicId: SUBTOPIC, prompt: q.prompt } });
    if (existing) continue;
    await prisma.xrayPracticeQuestion.create({ data: { subject: SUBJECT, subtopicId: SUBTOPIC, ...q } });
    created++;
  }
  console.log(`Konu Bilgisi (Test 1) soru havuzu: ${created} yeni soru eklendi (toplam tanım: ${questions.length}).`);
}

async function seedComprehensionQuestion() {
  const prompt = "√45 - √20 + √5 işleminin sonucu kaçtır?";
  const existing = await prisma.xrayComprehensionQuestion.findFirst({ where: { subtopicId: SUBTOPIC, prompt } });
  if (existing) {
    console.log("Ne Kadar Anlamış (Test 2) örnek sorusu zaten var, atlanıyor.");
    return;
  }

  await prisma.xrayComprehensionQuestion.create({
    data: {
      subject: SUBJECT,
      subtopicId: SUBTOPIC,
      difficulty: 3,
      prompt,
      solution: "√45 = 3√5, √20 = 2√5, √5 = √5. 3√5 - 2√5 + √5 = 2√5.",
      options: {
        create: [
          {
            label: "A",
            text: "2√5",
            isCorrect: true,
            diagnosis: "Üç terimi de doğru sadeleştirip (3√5, 2√5, √5) doğru işaretlerle işlem yapmış.",
            position: 1,
          },
          {
            label: "B",
            text: "4√5",
            isCorrect: false,
            diagnosis: "Sadeleştirmeleri doğru yaptı ama işlem sırasında işaretleri karıştırdı — çıkarma yerine toplama uyguladı.",
            position: 2,
          },
          {
            label: "C",
            text: "√30",
            isCorrect: false,
            diagnosis: "Kök içindeki sayıları sadeleştirmeden doğrudan toplayıp çıkardı (45-20+5=30) — köklü ifadelerde bu işlemin geçersiz olduğunu fark etmedi, temel kural eksikliği.",
            position: 3,
          },
          {
            label: "D",
            text: "9√5",
            isCorrect: false,
            diagnosis: "√45'i çarpanlarına ayırırken (9×5) doğru gitti ama karekökü almadan 9'u doğrudan dışarı çıkardı — 'kökten çıkarma' adımını atladı.",
            position: 4,
          },
        ],
      },
    },
  });
  console.log("Ne Kadar Anlamış (Test 2) örnek sorusu (4 tanı etiketli şıkla) eklendi.");
}

async function main() {
  await seedPracticeQuestions();
  await seedComprehensionQuestion();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
