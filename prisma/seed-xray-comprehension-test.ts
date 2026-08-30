// Akademik Röntgen Faz A — Test 2 için GEÇİCİ, elle yazılmış örnek içerik
// (bkz. prisma/seed-xray-practice-test.ts'teki Test 1 içeriği — AYNI
// "placeholder, AI gelince değişecek" gerekçesi). Sadece mt9-2 (Rasyonel
// ve Gerçek Sayılar — köklü ifadeler) konusunu kapsar, Faz C'nin
// arayüzlerini uçtan uca doğrulamaya yeter.
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

const SUBJECT = "Matematik";
const SUBTOPIC = "mt9-2";

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
  await seedComprehensionQuestion();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
