"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, GraduationCap, Loader2, Phone, ShieldAlert, UserRound } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useStudent360 } from "@/lib/student-360-store";
import { MODULE_BY_ID } from "@/lib/modules";
import { requestErpTab } from "@/lib/erp-tab-store";
import type { ErpTabId } from "@/lib/erp-tabs";
import { cn } from "@/lib/utils";
import type { Student360Section, Student360Tone } from "@/lib/student-360-types";

// ÖĞRENCİ 360 KARTI — "tek çatı"nın en somut kanıtı.
//
// Bir öğrenciye nereden tıklanırsa tıklansın (arama, öğrenci listesi,
// ödeme satırı) aynı kart açılır: beş modülün o öğrenci hakkında bildiği
// her şey yan yana. Her bölüm KENDİ modülünün rengini taşır ve tıklanınca
// oraya götürür — bilgi burada özetlenir, iş kendi ekranında yapılır.
//
// Kök düzende BİR kez mount edilir; açma çağrısı depodan gelir
// (bkz. lib/student-360-store.ts).

const TONE_RING: Record<Student360Tone, string> = {
  good: "border-emerald-500/30",
  warn: "border-amber-500/40",
  bad: "border-red-500/40",
  neutral: "border-hairline dark:border-white/10",
};

const TONE_TEXT: Record<Student360Tone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  neutral: "text-espresso dark:text-cream",
};

function SectionCard({ section, onGo }: { section: Student360Section; onGo: (s: Student360Section) => void }) {
  const mod = MODULE_BY_ID[section.module];
  const Icon = mod.icon;
  const reachable = Boolean(section.tab || section.href);
  // Verisi olmayan bölüm SİLİNMEZ (o modüle gitme yolu kalsın) ama
  // soluklaşır: göz önce gerçekten bir şey söyleyen kartlara gitsin.
  const empty = section.headline === null;

  return (
    <button
      onClick={() => reachable && onGo(section)}
      disabled={!reachable}
      className={cn(
        "group flex h-full flex-col rounded-xl border bg-white p-3 text-left transition dark:bg-midnight-card",
        TONE_RING[section.tone],
        empty && "opacity-55 hover:opacity-100",
        reachable && "hover:shadow-sm"
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded", mod.accent.bg, mod.accent.text)}>
          <Icon className="h-3 w-3" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-espresso-muted dark:text-cream/40">
          {section.label}
        </span>
        {reachable && (
          <ArrowRight className="ml-auto h-3 w-3 text-espresso-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-cream/40" />
        )}
      </div>

      <p className={cn("text-lg font-bold leading-none", section.headline ? TONE_TEXT[section.tone] : "text-espresso-muted dark:text-cream/25")}>
        {section.headline ?? "—"}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-espresso-muted dark:text-cream/45">{section.detail}</p>

      {section.bullets.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-hairline pt-2 dark:border-white/10">
          {section.bullets.map((b) => (
            <li key={b} className="truncate text-[10.5px] text-espresso-muted dark:text-cream/40">
              {b}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

export function Student360Sheet() {
  const router = useRouter();
  const { studentId, data, loading, failed, close } = useStudent360();

  function go(section: Student360Section) {
    close();
    if (section.href) {
      router.push(section.href);
      return;
    }
    // ERP sekmesi: sayfa açıksa anında geçilir, değilse istek bırakılıp
    // yönlendirilir (bkz. lib/erp-tab-store.ts).
    if (section.tab && !requestErpTab(section.tab as ErpTabId)) router.push("/principal");
  }

  return (
    <Modal isOpen={Boolean(studentId)} onClose={close} title={data?.student.fullName ?? "Öğrenci"} variant="center" widthClassName="max-w-3xl">
      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-espresso-muted dark:text-cream/40">
          <Loader2 className="h-4 w-4 animate-spin" /> Beş modülden veri toplanıyor…
        </div>
      )}

      {failed && (
        <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/5 px-3 py-2.5 text-sm text-red-600 dark:text-red-300">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Bu öğrencinin bilgileri getirilemedi. Yetkiniz olmayabilir.
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {/* Kimlik satırı */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-hairline bg-cream-card px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
              <GraduationCap className="h-3.5 w-3.5 text-brand-600" />
              {data.student.branchName} · {data.student.grade}. sınıf
            </span>
            {data.student.studentNumber && (
              <span className="text-[11px] text-espresso-muted dark:text-cream/40">No {data.student.studentNumber}</span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-espresso-muted dark:text-cream/40">
              <UserRound className="h-3 w-3" />
              {data.student.advisorName ? `Danışman: ${data.student.advisorName}` : "Danışman atanmamış"}
            </span>
            {!data.student.isActive && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                Ayrılmış
              </span>
            )}
          </div>

          {/* Veliler — "ulaşılabilir mi" sorusu kartın en pratik kısmı */}
          {data.parents.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.parents.map((parent) => (
                <span
                  key={`${parent.name}-${parent.phone}`}
                  className="flex items-center gap-1.5 rounded-full border border-hairline bg-white px-2.5 py-1 text-[11px] dark:border-white/10 dark:bg-midnight-card"
                >
                  <Phone className="h-3 w-3 text-espresso-muted dark:text-cream/40" />
                  <span className="font-medium text-espresso dark:text-cream">{parent.name}</span>
                  <span className="text-espresso-muted dark:text-cream/40">{parent.phone}</span>
                  {!parent.smsConsent && (
                    <span className="rounded bg-amber-500/15 px-1 text-[9.5px] font-semibold text-amber-700 dark:text-amber-300">
                      SMS kapalı
                    </span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              Velisi tanımlı değil — bu aileye hiçbir bildirim ulaşmaz.
            </p>
          )}

          {/* Modül kartları */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.sections.map((section, i) => (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.03 }}
              >
                <SectionCard section={section} onGo={go} />
              </motion.div>
            ))}
          </div>

          {data.financeHidden && (
            <p className="text-[10.5px] text-espresso-muted dark:text-cream/35">
              Ödeme bilgileri yalnızca yönetici hesaplarında görünür.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
