import { prisma } from "@/lib/server/prisma";
import { toCsv, type ZipEntry } from "@/lib/server/export/zip";

// ----------------------------------------------------------------------------
// KURUM VERİSİNİN TAMAMINI DIŞA AKTARMA.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-17): "ben uygulamayı bıraksanız bile veri
// kaybınız yok, hepsini size veriyorum diye garanti vereceğim. Tek tuşla
// bütün verileri klasörlere bölünmüş bir dosyayla indirip verebilmem lazım."
//
// Bu bir SATIŞ VAADİNİN teknik karşılığı: müşteri verisinin rehin olmadığını
// kanıtlar. Bu yüzden çıktı bizim formatımız değil, HERKESİN açabileceği
// format olmalı — Excel'de çift tıklayınca açılan CSV.
//
// ⚠️ KAYNAK KAYDI DESENİ (bkz. CLAUDE.md): her tablo için if/else yerine
// kendi kendini tanımlayan bir dizi girdisi. Yeni bir modül eklendiğinde
// buraya BİR GİRDİ eklenir; dışa aktarma kodu hiç dallanmaz. Bir modülün
// dışa aktarıma eklenmesi unutulursa vaat yarım kalır, o yüzden liste tek
// yerde ve gözle taranabilir olmalı.
//
// ⚠️ ŞİFRE/HASH DIŞA AKTARILMAZ. Veri müşterinin, kimlik doğrulama sırrı
// değil. Kimse bu dosyayla başkasının hesabına giremesin.
// ----------------------------------------------------------------------------

export type ExportSection = {
  /** ZIP içindeki klasör — "01-Öğrenciler" gibi sıralı ve okunur. */
  folder: string;
  file: string;
  headers: string[];
  load: (institutionId: string) => Promise<(string | number | null | undefined)[][]>;
};

const trDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("tr-TR") : "");
const trDateTime = (d: Date | null | undefined) => (d ? d.toLocaleString("tr-TR") : "");

export const EXPORT_SECTIONS: ExportSection[] = [
  {
    folder: "01-Ogrenciler",
    file: "ogrenciler.csv",
    headers: ["Öğrenci No", "Ad", "Soyad", "TC", "Şube", "Sınıf", "Alan", "Telefon", "E-posta", "Danışman", "Durum", "Kayıt tarihi"],
    load: async (id) => {
      const rows = await prisma.student.findMany({
        where: { institutionId: id },
        select: {
          studentNumber: true, firstName: true, lastName: true, nationalId: true, phone: true, email: true,
          isActive: true, createdAt: true, track: true,
          branch: { select: { name: true, grade: true } },
          advisorTeacher: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ branch: { name: "asc" } }, { firstName: "asc" }],
      });
      return rows.map((s) => [
        s.studentNumber, s.firstName, s.lastName, s.nationalId, s.branch?.name ?? "", s.branch?.grade ?? "",
        s.track ?? "", s.phone ?? "", s.email ?? "",
        s.advisorTeacher ? `${s.advisorTeacher.firstName} ${s.advisorTeacher.lastName}` : "",
        s.isActive ? "Aktif" : "Pasif", trDate(s.createdAt),
      ]);
    },
  },
  {
    folder: "01-Ogrenciler",
    file: "veliler.csv",
    headers: ["Veli", "Yakınlık", "Telefon", "E-posta", "SMS izni", "Bağlı öğrenciler"],
    load: async (id) => {
      const rows = await prisma.parent.findMany({
        where: { institutionId: id },
        select: {
          firstName: true, lastName: true, relationship: true, mobilePhone: true, email: true, smsConsent: true,
          students: { select: { student: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { firstName: "asc" },
      });
      return rows.map((p) => [
        `${p.firstName} ${p.lastName}`, p.relationship, p.mobilePhone, p.email ?? "",
        p.smsConsent ? "Var" : "Yok",
        p.students.map((x) => `${x.student.firstName} ${x.student.lastName}`).join(" / "),
      ]);
    },
  },
  {
    folder: "02-Ogretmenler",
    file: "ogretmenler.csv",
    headers: ["Ad", "Soyad", "Branş", "Telefon", "Kurumsal kod", "Durum"],
    load: async (id) => {
      const rows = await prisma.teacher.findMany({
        where: { institutionId: id },
        select: { firstName: true, lastName: true, subject: true, mobilePhone: true, institutionalCode: true, isActive: true },
        orderBy: { firstName: "asc" },
      });
      return rows.map((t) => [t.firstName, t.lastName, t.subject, t.mobilePhone, t.institutionalCode ?? "", t.isActive ? "Aktif" : "Pasif"]);
    },
  },
  {
    folder: "03-Subeler-ve-Ders-Programi",
    file: "subeler.csv",
    headers: ["Şube", "Sınıf", "Alan", "Danışman öğretmen", "Öğrenci sayısı"],
    load: async (id) => {
      const rows = await prisma.branch.findMany({
        where: { institutionId: id },
        select: { name: true, grade: true, track: true, advisor: { select: { firstName: true, lastName: true } }, _count: { select: { students: true } } },
        orderBy: { name: "asc" },
      });
      return rows.map((b) => [b.name, b.grade, b.track ?? "", b.advisor ? `${b.advisor.firstName} ${b.advisor.lastName}` : "", b._count.students]);
    },
  },
  {
    folder: "03-Subeler-ve-Ders-Programi",
    file: "ders-programi.csv",
    headers: ["Şube", "Gün", "Saat", "Ders", "Öğretmen"],
    load: async (id) => {
      const rows = await prisma.lessonSlot.findMany({
        where: { branch: { institutionId: id } },
        select: { day: true, slot: true, subject: true, branch: { select: { name: true } }, teacher: { select: { firstName: true, lastName: true } } },
        orderBy: [{ branch: { name: "asc" } }, { slot: "asc" }],
      });
      return rows.map((l) => [l.branch.name, l.day, l.slot, l.subject, `${l.teacher.firstName} ${l.teacher.lastName}`]);
    },
  },
  {
    folder: "04-Yoklama",
    file: "yoklama-kayitlari.csv",
    headers: ["Tarih", "Saat", "Ders", "Öğrenci", "Şube", "Durum"],
    load: async (id) => {
      const rows = await prisma.attendanceRecord.findMany({
        where: { student: { institutionId: id } },
        select: { date: true, slot: true, subject: true, status: true, student: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } } },
        orderBy: { date: "desc" },
      });
      return rows.map((a) => [trDate(a.date), a.slot, a.subject, `${a.student.firstName} ${a.student.lastName}`, a.student.branch?.name ?? "", a.status]);
    },
  },
  {
    folder: "04-Yoklama",
    file: "ogrenci-devamsizlik-ozeti.csv",
    headers: ["Öğrenci", "Şube", "Toplam kayıt", "Geldi", "Gelmedi", "Geç", "İzinli"],
    load: async (id) => {
      const [students, counts] = await Promise.all([
        prisma.student.findMany({ where: { institutionId: id }, select: { id: true, firstName: true, lastName: true, branch: { select: { name: true } } } }),
        prisma.attendanceRecord.groupBy({ by: ["studentId", "status"], where: { student: { institutionId: id } }, _count: true }),
      ]);
      const map = new Map<string, Record<string, number>>();
      for (const c of counts) {
        const cur = map.get(c.studentId) ?? {};
        cur[c.status] = c._count;
        map.set(c.studentId, cur);
      }
      return students.map((s) => {
        const c = map.get(s.id) ?? {};
        const total = Object.values(c).reduce((a, b) => a + b, 0);
        return [`${s.firstName} ${s.lastName}`, s.branch?.name ?? "", total, c.PRESENT ?? 0, c.ABSENT ?? 0, c.LATE ?? 0, c.EXCUSED ?? 0];
      });
    },
  },
  {
    folder: "05-Odevler",
    file: "odevler.csv",
    headers: ["Başlık", "Öğretmen", "Açıklama", "Hedef soru", "Son teslim", "Oluşturma"],
    load: async (id) => {
      const rows = await prisma.homework.findMany({
        where: { teacher: { institutionId: id } },
        select: { title: true, description: true, targetQuestionCount: true, dueAt: true, createdAt: true, teacher: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((h) => [h.title, `${h.teacher.firstName} ${h.teacher.lastName}`, h.description ?? "", h.targetQuestionCount ?? "", trDate(h.dueAt), trDate(h.createdAt)]);
    },
  },
  {
    folder: "05-Odevler",
    file: "odev-teslimleri.csv",
    headers: ["Ödev", "Öğrenci", "Şube", "Durum", "Güncelleme"],
    load: async (id) => {
      const rows = await prisma.homeworkSubmission.findMany({
        where: { student: { institutionId: id } },
        select: { status: true, updatedAt: true, homework: { select: { title: true } }, student: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } } },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((s) => [s.homework.title, `${s.student.firstName} ${s.student.lastName}`, s.student.branch?.name ?? "", s.status, trDateTime(s.updatedAt)]);
    },
  },
  {
    folder: "06-Denemeler",
    file: "denemeler.csv",
    headers: ["Deneme", "Tarih"],
    load: async (id) => {
      const rows = await prisma.exam.findMany({ where: { institutionId: id }, select: { name: true, examDate: true }, orderBy: { examDate: "desc" } });
      return rows.map((e) => [e.name, trDate(e.examDate)]);
    },
  },
  {
    folder: "06-Denemeler",
    file: "deneme-sonuclari.csv",
    headers: ["Deneme", "Tarih", "Öğrenci", "Şube", "Ders", "Net"],
    load: async (id) => {
      const rows = await prisma.examNetResult.findMany({
        where: { student: { institutionId: id } },
        select: { subject: true, net: true, exam: { select: { name: true, examDate: true } }, student: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } } },
        orderBy: { id: "desc" },
      });
      return rows.map((r) => [r.exam?.name ?? "", trDate(r.exam?.examDate), `${r.student.firstName} ${r.student.lastName}`, r.student.branch?.name ?? "", r.subject, r.net]);
    },
  },
  {
    folder: "07-Odemeler",
    file: "taksitler.csv",
    headers: ["Öğrenci", "Şube", "Taksit", "Vade", "Tutar", "Tahsil edilen", "Durum"],
    load: async (id) => {
      const rows = await prisma.installment.findMany({
        where: { institutionId: id },
        select: {
          title: true, dueDate: true, amount: true, status: true,
          payments: { select: { amount: true } },
          student: { select: { firstName: true, lastName: true, branch: { select: { name: true } } } },
        },
        orderBy: { dueDate: "asc" },
      });
      return rows.map((i) => {
        const paid = i.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        return [
          `${i.student.firstName} ${i.student.lastName}`, i.student.branch?.name ?? "", i.title,
          trDate(i.dueDate), Number(i.amount), paid, i.status,
        ];
      });
    },
  },
  {
    folder: "08-Rehberlik",
    file: "gorusme-notlari.csv",
    headers: ["Tarih", "Öğrenci", "Yazan", "Kategori", "Gizlilik", "Not"],
    load: async (id) => {
      const rows = await prisma.guidanceNote.findMany({
        where: { student: { institutionId: id } },
        select: { createdAt: true, authorName: true, category: true, confidentialityLevel: true, note: true, student: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((n) => [trDateTime(n.createdAt), `${n.student.firstName} ${n.student.lastName}`, n.authorName, n.category, n.confidentialityLevel, n.note]);
    },
  },
  {
    folder: "08-Rehberlik",
    file: "calisma-programlari.csv",
    headers: ["Öğrenci", "Program", "Oluşturma", "Gün", "Saat", "Ders", "Konu", "Tür", "Hedef soru", "Yapıldı"],
    load: async (id) => {
      const rows = await prisma.guidanceProgram.findMany({
        where: { student: { institutionId: id } },
        select: { weekLabel: true, createdAt: true, student: { select: { firstName: true, lastName: true } }, entries: { select: { day: true, time: true, subject: true, topic: true, kind: true, questionTarget: true, completedAt: true } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.flatMap((p) =>
        p.entries.map((e) => [
          `${p.student.firstName} ${p.student.lastName}`, p.weekLabel, trDate(p.createdAt),
          e.day, e.time, e.subject, e.topic, e.kind, e.questionTarget ?? "", e.completedAt ? "Evet" : "Hayır",
        ])
      );
    },
  },
  {
    folder: "09-Akademik-Rontgen",
    file: "kazanim-hakimiyeti.csv",
    headers: ["Öğrenci", "Ders", "Kazanım", "Puan", "Kaynak", "Tarih"],
    load: async (id) => {
      const rows = await prisma.topicMasteryAssessment.findMany({
        where: { student: { institutionId: id } },
        select: { subject: true, subtopicId: true, masteryScore: true, source: true, assessedAt: true, student: { select: { firstName: true, lastName: true } } },
        orderBy: { assessedAt: "desc" },
      });
      return rows.map((m) => [`${m.student.firstName} ${m.student.lastName}`, m.subject, m.subtopicId, m.masteryScore, m.source, trDate(m.assessedAt)]);
    },
  },
  {
    folder: "10-Videolar",
    file: "video-atamalari.csv",
    headers: ["Video", "Ders", "Öğrenci", "Atama", "İzlenen (sn)", "Süre (sn)", "İlk izleme"],
    load: async (id) => {
      const rows = await prisma.videoAssignment.findMany({
        where: { student: { institutionId: id } },
        select: { assignedAt: true, watchedAt: true, watchedSeconds: true, video: { select: { title: true, subject: true, durationSeconds: true } }, student: { select: { firstName: true, lastName: true } } },
        orderBy: { assignedAt: "desc" },
      });
      return rows.map((v) => [v.video.title, v.video.subject, `${v.student.firstName} ${v.student.lastName}`, trDate(v.assignedAt), v.watchedSeconds ?? 0, v.video.durationSeconds ?? "", trDateTime(v.watchedAt)]);
    },
  },
  {
    folder: "11-Denetim",
    file: "yonetici-islemleri.csv",
    headers: ["Tarih", "Yönetici", "Ne yaptı", "Tür", "Panelinden", "Sonuç"],
    load: async (id) => {
      const rows = await prisma.activityLog.findMany({
        where: { institutionId: id },
        select: { createdAt: true, actorName: true, summary: true, category: true, onBehalfOfName: true, status: true },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((a) => [trDateTime(a.createdAt), a.actorName, a.summary ?? "", a.category ?? "", a.onBehalfOfName ?? "kendi paneli", a.status >= 400 ? "başarısız" : "başarılı"]);
    },
  },
];

/** Tüm bölümleri çeker ve ZIP girdilerine çevirir. */
export async function buildInstitutionExport(institutionId: string, institutionName: string): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  const index: string[] = [
    `KURUM: ${institutionName}`,
    `DIŞA AKTARMA TARİHİ: ${new Date().toLocaleString("tr-TR")}`,
    "",
    "Bu arşiv kurumunuzun sistemdeki TÜM verisini içerir.",
    "Dosyalar CSV biçimindedir; Excel, Google E-Tablolar veya LibreOffice ile",
    "doğrudan açılabilir. Hiçbir özel yazılıma ihtiyaç yoktur.",
    "",
    "KLASÖRLER:",
  ];

  for (const section of EXPORT_SECTIONS) {
    // Bölümler SIRAYLA çekilir: hepsini paralel çalıştırmak büyük bir
    // kurumda veritabanı bağlantı havuzunu (max: 10) tüketirdi.
    const rows = await section.load(institutionId);
    entries.push({ path: `${section.folder}/${section.file}`, content: toCsv(section.headers, rows) });
    index.push(`  ${section.folder}/${section.file} — ${rows.length} satır`);
  }

  index.push("", "Şifreler ve kimlik doğrulama bilgileri GÜVENLİK GEREĞİ dışa aktarılmaz.");
  entries.unshift({ path: "OKUBENI.txt", content: index.join("\r\n") });
  return entries;
}
