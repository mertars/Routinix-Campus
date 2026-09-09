import { prisma } from "@/lib/server/prisma";

// Kurulum sihirbazı — "yeni kurumun ilk günü" sorununun cevabı.
//
// Panelde 18 sekme var ve sıfırdan açılan bir kurumda hepsi boş. Testte
// ölçülen sürtünme buydu: müdür neyi hangi sırada yapacağını bilmiyor,
// yanlış sırada denediğinde de sistem ona "şube bulunamadı" gibi teknik
// bir hata veriyor.
//
// Buradaki liste iki şey yapar:
//   1) SIRAYI söyler (öğrenci aktarmadan önce şube gerekir),
//   2) sırası gelmemiş adımı ENGELLİ gösterir ve NEDENİNİ yazar —
//      "yapılmadı" ile "henüz yapılamaz" farklı şeylerdir.
//
// Durum her seferinde VERİTABANINDAN hesaplanır, bir "kurulum tamamlandı"
// bayrağı tutulmaz: bayrak gerçekle ayrışabilir (müdür tüm şubeleri
// silerse kurulum yeniden eksiktir), sayım ayrışamaz.

export type SetupStepKey =
  | "branches"
  | "teachers"
  | "students"
  | "schedule"
  | "account"
  | "plans"
  | "smsConsent";

export type SetupStep = {
  key: SetupStepKey;
  label: string;
  hint: string;
  done: boolean;
  /** Sayısal durum ("12 şube") — müdür ilerlemeyi somut görsün. */
  detail: string;
  /** Bu adım için önce tamamlanması gereken adımlar. */
  blockedBy: SetupStepKey[];
  /** Sistemin çalışması için şart mı — değilse "sonra da yapılabilir". */
  required: boolean;
  /** Hangi ERP sekmesine gidilecek. */
  tab?: string;
  /** ERP dışına (ödeme modülü gibi) gidiyorsa adres. */
  href?: string;
};

export type SetupStatus = {
  steps: SetupStep[];
  completedRequired: number;
  totalRequired: number;
  /** Zorunlu adımların hepsi bittiyse sihirbaz görünmez. */
  isComplete: boolean;
  /** Sıradaki yapılabilir adım — "şimdi şunu yap" demek için. */
  nextKey: SetupStepKey | null;
};

const LABELS: Record<SetupStepKey, string> = {
  branches: "Şubeleri oluşturun",
  teachers: "Öğretmenleri ekleyin",
  students: "Öğrencileri ekleyin",
  schedule: "Ders programını kurun",
  account: "Kasa / banka hesabı açın",
  plans: "Taksit planlarını kurun",
  smsConsent: "Veli SMS izinlerini alın",
};

export async function getSetupStatus(institutionId: string): Promise<SetupStatus> {
  const [branches, teachers, students, slots, accounts, studentsWithPlan, parents, consenting] = await Promise.all([
    prisma.branch.count({ where: { institutionId } }),
    prisma.teacher.count({ where: { institutionId, isActive: true } }),
    prisma.student.count({ where: { institutionId, isActive: true } }),
    prisma.lessonSlot.count({ where: { branch: { institutionId } } }),
    prisma.paymentAccount.count({ where: { institutionId, isActive: true } }),
    prisma.student.count({ where: { institutionId, isActive: true, installments: { some: {} } } }),
    prisma.parent.count({ where: { institutionId } }),
    prisma.parent.count({ where: { institutionId, smsConsent: true } }),
  ]);

  const raw: Omit<SetupStep, "label">[] = [
    {
      key: "branches",
      hint: "Sınıf/şube listesi. Excel ile toplu ekleyebilirsiniz — öğrenci aktarımı bu isimlerle eşleşir.",
      done: branches > 0,
      detail: branches > 0 ? `${branches} şube` : "henüz yok",
      blockedBy: [],
      required: true,
      tab: "students",
    },
    {
      key: "teachers",
      hint: "Branş öğretmenleri ve rehberlik. Ders programı için gerekli.",
      done: teachers > 0,
      detail: teachers > 0 ? `${teachers} öğretmen` : "henüz yok",
      blockedBy: [],
      required: true,
      tab: "students",
    },
    {
      key: "students",
      // Testte en çok zaman kaybettiren adım buydu; sıranın burada
      // olduğunu söylemek tek başına faydalı.
      hint: "Excel ile toplu aktarın. Dosyadaki şube adları yukarıdaki şubelerle birebir aynı olmalı.",
      done: students > 0,
      detail: students > 0 ? `${students} öğrenci` : "henüz yok",
      blockedBy: branches === 0 ? ["branches"] : [],
      required: true,
      tab: "students",
    },
    {
      key: "schedule",
      hint: "Hazır şablonu indirip doldurun; sistem çakışmaları içe aktarmadan önce kontrol eder.",
      done: slots > 0,
      detail: slots > 0 ? `${slots} ders` : "henüz yok",
      blockedBy: [...(branches === 0 ? (["branches"] as SetupStepKey[]) : []), ...(teachers === 0 ? (["teachers"] as SetupStepKey[]) : [])],
      required: true,
      tab: "schedule-matrix",
    },
    {
      key: "account",
      hint: "Tahsilat ve giderler bir hesaba işlenir.",
      done: accounts > 0,
      detail: accounts > 0 ? `${accounts} hesap` : "henüz yok",
      blockedBy: [],
      required: false,
      href: "/payments/principal",
    },
    {
      key: "plans",
      hint: "Şubenin tamamına tek seferde plan kurabilirsiniz.",
      done: students > 0 && studentsWithPlan > 0,
      detail:
        students > 0 ? `${studentsWithPlan}/${students} öğrencinin planı var` : "önce öğrenci gerekli",
      blockedBy: [
        ...(students === 0 ? (["students"] as SetupStepKey[]) : []),
        ...(accounts === 0 ? (["account"] as SetupStepKey[]) : []),
      ],
      required: false,
      href: "/payments/principal",
    },
    {
      key: "smsConsent",
      // Bu adım listeye, izin hiç sorulmadığı için toplu SMS'in
      // sessizce kimseye ulaşmadığı bulgusundan sonra eklendi.
      hint: "İzni olmayan veliye ne toplu SMS ne ödeme hatırlatması gider.",
      done: parents > 0 && consenting > 0,
      detail: parents > 0 ? `${consenting}/${parents} veli izinli` : "önce öğrenci gerekli",
      blockedBy: students === 0 ? ["students"] : [],
      required: false,
      tab: "bulk-sms",
    },
  ];

  const steps: SetupStep[] = raw.map((s) => ({ ...s, label: LABELS[s.key] }));
  const requiredSteps = steps.filter((s) => s.required);
  const completedRequired = requiredSteps.filter((s) => s.done).length;

  // Sıradaki adım: yapılmamış VE engeli olmayan ilk adım. Engelli
  // adımı "sıradaki" diye göstermek müdürü çıkmaza sokar.
  const next = steps.find((s) => !s.done && s.blockedBy.length === 0) ?? null;

  return {
    steps,
    completedRequired,
    totalRequired: requiredSteps.length,
    isComplete: completedRequired === requiredSteps.length,
    nextKey: next?.key ?? null,
  };
}
