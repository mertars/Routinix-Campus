// Akademik Röntgen — soru havuzu için GEÇİCİ, elle yazılmış placeholder
// içerik. `npx tsx prisma/seed-xray-questions.ts` ile çalışır, ana
// seed.ts'in (kurum/öğrenci/şube bootstrap'i) DIŞINDA tutulur çünkü bu
// içerik institutionId'den bağımsızdır (soru havuzu kuruma özel değil) VE
// büyük ihtimalle yapay zeka ile üretilecek gerçek içerikle TAMAMEN
// değiştirilecek — o zaman silinmesi/atlanması kolay olsun diye ayrı bir
// dosyada tutulur. Sadece iki Matematik konusunu (mt9-1, mt9-2, mt10-1)
// kapsar — adaptif test akışını (lib/server/xray/adaptive-engine.ts) uçtan
// uca doğrulamaya yeter, kapsamlı bir müfredat değildir.
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

type SeedQuestion = { subtopicId: string; difficulty: number; prompt: string; options: string[]; correctAnswer: string };

const QUESTIONS: SeedQuestion[] = [
  // mt9-1 — Küme Kavramı ve İşlemler
  { subtopicId: "mt9-1", difficulty: 1, prompt: "A = {1, 2, 3} kümesinin eleman sayısı kaçtır?", options: ["1", "2", "3", "4"], correctAnswer: "3" },
  {
    subtopicId: "mt9-1",
    difficulty: 2,
    prompt: "A = {1, 2, 3}, B = {2, 3, 4} ise A ∩ B kümesi nedir?",
    options: ["{1, 4}", "{2, 3}", "{1, 2, 3, 4}", "{}"],
    correctAnswer: "{2, 3}",
  },
  {
    subtopicId: "mt9-1",
    difficulty: 3,
    prompt: "A = {1, 2, 3}, B = {3, 4, 5} ise A ∪ B kümesinin eleman sayısı kaçtır?",
    options: ["3", "4", "5", "6"],
    correctAnswer: "5",
  },
  {
    subtopicId: "mt9-1",
    difficulty: 4,
    prompt: "s(A) = 12, s(B) = 8, s(A ∩ B) = 3 ise s(A ∪ B) kaçtır?",
    options: ["17", "20", "23", "3"],
    correctAnswer: "17",
  },
  {
    subtopicId: "mt9-1",
    difficulty: 5,
    prompt: "A, B, C kümeleri için s(A)=10, s(B)=10, s(C)=10, ikili kesişimler 3'er, üçlü kesişim 1 ise s(A∪B∪C) kaçtır?",
    options: ["19", "22", "25", "28"],
    correctAnswer: "22",
  },
  // mt9-2 — Rasyonel ve Gerçek Sayılar
  {
    subtopicId: "mt9-2",
    difficulty: 1,
    prompt: "3/4 kesrinin ondalık gösterimi nedir?",
    options: ["0.34", "0.75", "1.33", "0.43"],
    correctAnswer: "0.75",
  },
  { subtopicId: "mt9-2", difficulty: 2, prompt: "1/2 + 1/3 işleminin sonucu nedir?", options: ["2/5", "5/6", "1/5", "2/6"], correctAnswer: "5/6" },
  {
    subtopicId: "mt9-2",
    difficulty: 3,
    prompt: "√2 sayısı hangi sayı kümesine aittir?",
    options: ["Rasyonel", "İrrasyonel", "Tam sayı", "Doğal sayı"],
    correctAnswer: "İrrasyonel",
  },
  {
    subtopicId: "mt9-2",
    difficulty: 4,
    prompt: "(2/3) / (4/9) işleminin sonucu nedir?",
    options: ["3/2", "8/27", "2/3", "1/2"],
    correctAnswer: "3/2",
  },
  {
    subtopicId: "mt9-2",
    difficulty: 5,
    prompt: "0.181818... (devirli) ondalık sayısının kesir gösterimi nedir?",
    options: ["18/99", "2/11", "18/100", "1/6"],
    correctAnswer: "2/11",
  },
  // mt10-1 — Fonksiyon Kavramı
  {
    subtopicId: "mt10-1",
    difficulty: 1,
    prompt: "f(x) = x + 2 fonksiyonunda f(3) kaçtır?",
    options: ["3", "5", "6", "1"],
    correctAnswer: "5",
  },
  {
    subtopicId: "mt10-1",
    difficulty: 2,
    prompt: "f(x) = 2x - 1 fonksiyonunda f(4) kaçtır?",
    options: ["7", "8", "9", "6"],
    correctAnswer: "7",
  },
  {
    subtopicId: "mt10-1",
    difficulty: 3,
    prompt: "f(x) = x² - 3 fonksiyonunda f(-2) kaçtır?",
    options: ["1", "-1", "7", "-7"],
    correctAnswer: "1",
  },
  {
    subtopicId: "mt10-1",
    difficulty: 4,
    prompt: "f(x) = 3x + 1 ve f(a) = 10 ise a kaçtır?",
    options: ["2", "3", "4", "9"],
    correctAnswer: "3",
  },
  {
    subtopicId: "mt10-1",
    difficulty: 5,
    prompt: "f(x-1) = 2x + 5 ise f(x) fonksiyonunun eşiti nedir?",
    options: ["2x + 3", "2x + 7", "2x + 5", "2x + 1"],
    correctAnswer: "2x + 7",
  },
];

async function main() {
  let created = 0;
  for (const q of QUESTIONS) {
    const existing = await prisma.xrayQuestion.findFirst({ where: { subtopicId: q.subtopicId, prompt: q.prompt } });
    if (existing) continue;
    await prisma.xrayQuestion.create({
      data: { subject: "Matematik", subtopicId: q.subtopicId, difficulty: q.difficulty, prompt: q.prompt, options: q.options, correctAnswer: q.correctAnswer },
    });
    created++;
  }
  console.log(`Röntgen soru havuzu: ${created} yeni soru eklendi (toplam tanım: ${QUESTIONS.length}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
