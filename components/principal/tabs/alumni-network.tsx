"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Trophy, Handshake, Send, CheckCircle2 } from "lucide-react";
import { ALUMNI, type Alumnus } from "@/lib/mock-data";
import { AvatarInitials } from "@/components/principal/avatar-initials";
import { cn } from "@/lib/utils";

function MentorRequestButton({ alumnus }: { alumnus: Alumnus }) {
  const [sent, setSent] = useState(false);

  return (
    <button
      onClick={() => setSent(true)}
      disabled={sent}
      className={cn(
        "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition disabled:cursor-default",
        sent
          ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
          : "bg-espresso text-cream hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
      )}
    >
      {sent ? (
        <>
          <CheckCircle2 className="h-3 w-3" /> Talep Gönderildi
        </>
      ) : (
        <>
          <Send className="h-3 w-3" /> Mentorluk Talebi Gönder
        </>
      )}
    </button>
  );
}

export function AlumniNetworkTab() {
  const [showMentorsOnly, setShowMentorsOnly] = useState(false);
  const visibleAlumni = showMentorsOnly ? ALUMNI.filter((alumnus) => alumnus.isMentor) : ALUMNI;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Trophy className="h-4 w-4 text-brand-600" /> Mezun Gurur Tablosu
        </h2>
        <div className="flex gap-1.5 rounded-full border border-hairline bg-white/70 p-1 dark:border-white/10 dark:bg-midnight-card/50">
          <button
            onClick={() => setShowMentorsOnly(false)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              !showMentorsOnly ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40"
            )}
          >
            Tümü
          </button>
          <button
            onClick={() => setShowMentorsOnly(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              showMentorsOnly ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40"
            )}
          >
            <Handshake className="h-3.5 w-3.5" /> Sadece Mentorlar
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleAlumni.map((alumnus, index) => (
          <motion.div
            key={alumnus.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02, y: -4 }}
            className="flex flex-col rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
          >
            <div className="mb-3 flex items-center gap-3">
              <AvatarInitials name={alumnus.name} className="h-11 w-11 text-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-espresso dark:text-cream">{alumnus.name}</p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">{alumnus.graduationYear} Mezunu</p>
              </div>
            </div>

            {alumnus.highSchoolRank && (
              <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-800 dark:bg-brand-600/20 dark:text-brand-300">
                <Trophy className="h-3 w-3" /> {alumnus.highSchoolRank}
              </span>
            )}

            <div className="mb-3 flex-1 rounded-xl bg-cream-card p-2.5 dark:bg-white/5">
              <p className="flex items-start gap-1.5 text-xs font-medium text-espresso dark:text-cream">
                <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> {alumnus.admittedTo}
              </p>
              <span className="mt-1.5 inline-block rounded-full bg-white px-2 py-0.5 text-[9px] font-medium text-espresso-muted dark:bg-white/10 dark:text-cream/50">
                {alumnus.examScope} Kapsamı
              </span>
            </div>

            {alumnus.isMentor && (
              <>
                <p className="mb-2 text-[11px] italic text-espresso-muted dark:text-cream/40">&quot;{alumnus.mentorNote}&quot;</p>
                <MentorRequestButton alumnus={alumnus} />
              </>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
