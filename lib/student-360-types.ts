import type { ModuleId } from "@/lib/modules";

// ÖĞRENCİ 360 SÖZLEŞMESİ — sunucu ile istemcinin ortak dili.
//
// Sistemin "tek çatı" olduğunu en somut kanıtlayan yüzey: bir öğrenciye
// nereden tıklarsan tıkla, beş modülün o öğrenci hakkında bildiği her şey
// tek kartta toplanıyor ve her bölüm kendi modülüne götürüyor.

export type Student360Tone = "good" | "warn" | "bad" | "neutral";

export type Student360Section = {
  id: string;
  /** Hangi modülden geldiği — kartın rengi ve "git" hedefi bundan. */
  module: ModuleId;
  label: string;
  /** Büyük yazılan tek sayı/ifade. null = bu modülde henüz veri yok. */
  headline: string | null;
  detail: string;
  tone: Student360Tone;
  /** En fazla üç ek satır. */
  bullets: string[];
  /** ERP sekmesi (aynı sayfada geçiş) ya da başka modülün adresi. */
  tab?: string;
  href?: string;
};

export type Student360Parent = {
  name: string;
  relationship: string;
  phone: string;
  smsConsent: boolean;
};

export type Student360 = {
  student: {
    id: string;
    fullName: string;
    studentNumber: string | null;
    branchName: string;
    grade: number;
    isActive: boolean;
    advisorName: string | null;
  };
  parents: Student360Parent[];
  sections: Student360Section[];
  /** Finansal bölüm gizlendi mi (öğretmen görünümü). Arayüz bunu açıklar. */
  financeHidden: boolean;
};
