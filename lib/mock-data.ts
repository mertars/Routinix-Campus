export type RoleId = "principal" | "teacher" | "student" | "parent";

export type Persona = {
  id: RoleId;
  cardLabel: string;
  name: string;
  title: string;
  href: string;
};

export const MOCK_PERSONAS: Persona[] = [
  {
    id: "principal",
    cardLabel: "Yönetici (Müdür) Girişi",
    name: "Mert",
    title: "Kurum Müdürü",
    href: "/principal",
  },
  {
    id: "teacher",
    cardLabel: "Öğretmen Girişi",
    name: "İrfan Hoca",
    title: "Matematik Öğretmeni",
    href: "/teacher",
  },
  {
    id: "student",
    cardLabel: "Öğrenci Girişi",
    name: "Arslan",
    title: "12-A VIP Öğrencisi",
    href: "/student",
  },
  {
    id: "parent",
    cardLabel: "Veli Girişi",
    name: "Kemal Yıldırım",
    title: "Veli",
    href: "/parent",
  },
];

export const INSTITUTION_NAME = "Arslan Dershaneleri";

// ----------------------------------------------------------------------------
// Sınıf / Segment Filtreleme (LGS Kademesi vs. YKS Kademesi)
// ----------------------------------------------------------------------------

// LGS & Ortaokul (5-8), YKS & Lise (9-12), Mezun (YKS'ye tekrar giren, sınıf
// seviyesi olmayan grup).
export type BranchSegment = "LGS" | "YKS" | "MEZUN";
// Öğrencinin/şubenin gerçek sınıf seviyesi. Mezun grubunun sınıf seviyesi
// olmadığı için Branch/StudentNetReport/RiskRadarEntry'de bu alan opsiyonel.
export type GradeLevel = 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type Segment = "ALL" | BranchSegment | GradeLevel;

// Şube listesi & öğretmen "kadro" ilişkisi artık gerçek Postgres'ten
// (Branch/Teacher, bkz. prisma/schema.prisma) geliyor — bu dosyada sadece
// id/isim/kademe hizalaması için tohumlama kaynağı (prisma/seed.ts) olarak
// kalan minimal referans. studentCount SADECE prisma/seed.ts'in o şube için
// kaç öğrenci üreteceğini belirler (bkz. SEAT_ROSTER_BY_BRANCH), gerçek
// çalışma zamanında hiçbir yerde okunmaz — gerçek sayı Postgres'ten gelir.
// Segment eşleştirme mantığı da gerçek tarafa taşındı (bkz. lib/server/segment.ts).
export type Branch = {
  id: string;
  name: string;
  teacher: string;
  studentCount: number;
  segment: BranchSegment;
  grade?: GradeLevel;
};

export const INITIAL_BRANCHES: Branch[] = [
  { id: "5a", name: "5. Sınıf", teacher: "Ayşe Hoca", studentCount: 8, segment: "LGS", grade: 5 },
  { id: "6a", name: "6. Sınıf", teacher: "Ayşe Hoca", studentCount: 9, segment: "LGS", grade: 6 },
  { id: "7a", name: "7. Sınıf", teacher: "Ayşe Hoca", studentCount: 9, segment: "LGS", grade: 7 },
  { id: "lgs", name: "LGS Derece", teacher: "Ayşe Hoca", studentCount: 10, segment: "LGS", grade: 8 },
  { id: "9a", name: "9-A", teacher: "Selin Hoca", studentCount: 10, segment: "YKS", grade: 9 },
  { id: "10a", name: "10-A VIP", teacher: "Selin Hoca", studentCount: 10, segment: "YKS", grade: 10 },
  { id: "11a", name: "11-A Fen", teacher: "Kemal Hoca", studentCount: 10, segment: "YKS", grade: 11 },
  { id: "12a", name: "12-A VIP", teacher: "İrfan Hoca", studentCount: 10, segment: "YKS", grade: 12 },
  { id: "12b", name: "12-B Eşit Ağırlık", teacher: "Selin Hoca", studentCount: 10, segment: "YKS", grade: 12 },
  { id: "mezun", name: "YKS Mezun Sınıfı", teacher: "İrfan Hoca", studentCount: 12, segment: "MEZUN" },
];

// STAFF ve INITIAL_STUDENT_REPORTS artık hiçbir bileşen tarafından render
// edilmiyor — TEK kullanım yeri prisma/seed.ts'in tohumlama kaynağı: STAFF
// öğretmen↔şube "ders veriyor" ilişkisini (Teacher.teachingBranches), demo
// öğrenci raporları ise Student.targetNet/weeklyStudyHours alanlarını
// doldurur. Gerçek çalışma zamanı verisi her zaman Postgres'ten okunur.
export type StaffMember = {
  id: string;
  name: string;
  role: string;
  branches: string[];
};

export const STAFF: StaffMember[] = [
  { id: "1", name: "İrfan Hoca", role: "Matematik Öğretmeni", branches: ["12-A VIP", "11-A Fen", "YKS Mezun Sınıfı"] },
  { id: "2", name: "Selin Hoca", role: "Türkçe Öğretmeni", branches: ["9-A", "10-A VIP", "12-B Eşit Ağırlık"] },
  { id: "3", name: "Kemal Hoca", role: "Fizik Öğretmeni", branches: ["11-A Fen", "12-A VIP"] },
  { id: "4", name: "Ayşe Hoca", role: "LGS Branş Öğretmeni", branches: ["5. Sınıf", "6. Sınıf", "7. Sınıf", "LGS Derece"] },
  { id: "5", name: "Zehra Rehber", role: "Rehberlik Uzmanı", branches: ["Tüm Şubeler"] },
];

export type StudentNetReport = {
  id: string;
  name: string;
  branch: string;
  targetNet: number;
  actualNet: number;
  studyHours: number;
  attendanceRate: number;
  segment: BranchSegment;
  grade?: GradeLevel;
};

export const INITIAL_STUDENT_REPORTS: StudentNetReport[] = [
  { id: "1", name: "Arslan Yıldırım", branch: "12-A VIP", targetNet: 95, actualNet: 101, studyHours: 34, attendanceRate: 97, segment: "YKS", grade: 12 },
  { id: "2", name: "Zeynep Aydın", branch: "10-A VIP", targetNet: 70, actualNet: 64, studyHours: 21, attendanceRate: 88, segment: "YKS", grade: 10 },
  { id: "3", name: "Cem Demir", branch: "12-A VIP", targetNet: 60, actualNet: 49, studyHours: 14, attendanceRate: 72, segment: "YKS", grade: 12 },
  { id: "4", name: "Ada Yavuz", branch: "11-A Fen", targetNet: 75, actualNet: 79, studyHours: 29, attendanceRate: 95, segment: "YKS", grade: 11 },
  { id: "5", name: "Umut Kara", branch: "12-B Eşit Ağırlık", targetNet: 65, actualNet: 67, studyHours: 26, attendanceRate: 91, segment: "YKS", grade: 12 },
  { id: "6", name: "Ali Yurt", branch: "LGS Derece", targetNet: 85, actualNet: 76, studyHours: 22, attendanceRate: 84, segment: "LGS", grade: 8 },
];

export type RiskReason = "net_drop" | "attendance_gap" | "homework_gap" | "mastery_gap";

export const RISK_REASON_LABEL: Record<RiskReason, string> = {
  net_drop: "Net Düşüşü",
  attendance_gap: "Devamsızlık",
  homework_gap: "Ödev Eksikliği",
  mastery_gap: "Akademik Röntgen Eksikliği",
};

// ----------------------------------------------------------------------------
// Rehberlik Haftalık Program Yapıcı
// ----------------------------------------------------------------------------

export const DAYS_OF_WEEK = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export type WeeklyProgramEntry = {
  id: string;
  day: DayOfWeek;
  time: string;
  subject: string;
  topic: string;
  questionTarget: number;
};

export type WeeklyProgram = {
  id: string;
  studentId: string;
  weekLabel: string;
  createdAt: string;
  entries: WeeklyProgramEntry[];
};

// ----------------------------------------------------------------------------
// Optik Konu Analizi
// ----------------------------------------------------------------------------

export type TopicScore = { name: string; successRate: number };

export type TopicAnalysisEntry = {
  examName: string;
  hasTopicData: boolean;
  topics?: TopicScore[];
};

export const STUDENT_TOPIC_ANALYSIS: Record<string, TopicAnalysisEntry[]> = {
  "1": [
    {
      examName: "YKS Genel Deneme-4",
      hasTopicData: true,
      topics: [
        { name: "Türev", successRate: 82 },
        { name: "İntegral", successRate: 68 },
        { name: "Limit", successRate: 91 },
      ],
    },
    { examName: "YKS Genel Deneme-3", hasTopicData: false },
  ],
  "2": [{ examName: "YKS Genel Deneme-4", hasTopicData: false }],
  "3": [
    {
      examName: "YKS Genel Deneme-4",
      hasTopicData: true,
      topics: [
        { name: "Türev", successRate: 54 },
        { name: "İntegral", successRate: 39 },
        { name: "Limit", successRate: 61 },
      ],
    },
  ],
};

// Öğrencinin TEK bir derste (branşa özel) deneme bazlı net trendi — röntgen
// karnesindeki "sadece Matematik net trendi" gibi grafikler için.
export type SubjectNetTrendPoint = { examLabel: string; net: number };

export const STUDENT_SUBJECT_NET_TREND: Record<string, Record<string, SubjectNetTrendPoint[]>> = {
  "1": {
    Matematik: [
      { examLabel: "Deneme-1", net: 32 },
      { examLabel: "Deneme-2", net: 35 },
      { examLabel: "Deneme-3", net: 34 },
      { examLabel: "Deneme-4", net: 38 },
    ],
  },
  "3": {
    Matematik: [
      { examLabel: "Deneme-1", net: 20 },
      { examLabel: "Deneme-2", net: 18 },
      { examLabel: "Deneme-3", net: 16 },
      { examLabel: "Deneme-4", net: 15 },
    ],
  },
  "4": {
    Matematik: [
      { examLabel: "Deneme-1", net: 24 },
      { examLabel: "Deneme-2", net: 27 },
      { examLabel: "Deneme-3", net: 29 },
      { examLabel: "Deneme-4", net: 31 },
    ],
  },
};

// ----------------------------------------------------------------------------
// Türkiye Geneli Deneme & Etkinlik Takvimi
// ⚠️ linkUrl alanları PLACEHOLDER'dır — gerçek kurum siteleri doğrulanmadan
// tahmin edilip yazılmadı, yayına almadan önce gerçek adreslerle değiştirin.
// ----------------------------------------------------------------------------

export type NationwideExamScope = "YKS" | "LGS";

export type NationwideExam = {
  id: string;
  organizer: string;
  name: string;
  scope: NationwideExamScope;
  date: string;
  linkLabel: string;
  linkUrl: string;
};

export const NATIONWIDE_EXAMS: NationwideExam[] = [
  { id: "1", organizer: "TÖDER", name: "TÖDER YKS 1. Deneme", scope: "YKS", date: "2026-09-05", linkLabel: "TÖDER Başvuru", linkUrl: "#" },
  { id: "2", organizer: "Özdebir", name: "Özdebir YKS Deneme-2", scope: "YKS", date: "2026-09-12", linkLabel: "Özdebir Resmi Sitesi", linkUrl: "#" },
  { id: "3", organizer: "Bilgi Sarmal", name: "Bilgi Sarmal LGS Deneme-1", scope: "LGS", date: "2026-09-08", linkLabel: "Bilgi Sarmal Sitesi", linkUrl: "#" },
  { id: "4", organizer: "3D Yayınları", name: "3D Yayınları YKS Deneme", scope: "YKS", date: "2026-09-20", linkLabel: "3D Yayınları Sitesi", linkUrl: "#" },
];

// ----------------------------------------------------------------------------
// SMS & Web Push Destekli Devamsızlık Komut Merkezi
// ----------------------------------------------------------------------------

export type AttendanceStatus = "present" | "absent" | "late" | "unmarked";

export type AttendanceRow = {
  studentId: string;
  studentName: string;
  branch: string;
  status: AttendanceStatus;
};

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Geldi",
  absent: "Gelmedi",
  late: "Geç Kaldı",
  unmarked: "İşaretlenmedi",
};

// ----------------------------------------------------------------------------
// Kelebek Sınav Oturum & Resimli Giriş Belgesi
// ----------------------------------------------------------------------------

export const EXAM_HALLS = ["A Blok - 204 Nolu Salon", "B Blok - 108 Nolu Salon"] as const;

export type SeatRosterStudent = { id: string; name: string };

// "${branchName} Öğrencisi ${i}" gibi placeholder isimler canlı tanıtım/demo
// ekranlarında boş/sahte görünüyordu — INITIAL_STUDENT_REPORTS'ta adı
// geçmeyen tüm doldurma koltukları artık bu gerçekçi Türkçe isim
// havuzundan (tekrarsız, tüm roster'lar genelinde SIRAYLA tüketilen) bir
// ad alır. Havuz INITIAL_BRANCHES'teki toplam koltuk sayısından (98) fazla
// tutulur ki yeni bir şube eklenirse de isim tükenmesin.
const FILLER_MALE_FIRST_NAMES = ["Mehmet", "Mustafa", "Ahmet", "Ali", "Hüseyin", "Hasan", "İbrahim", "Yusuf", "Emre", "Burak", "Onur", "Kaan", "Berkay", "Efe", "Kerem", "Arda", "Deniz", "Barış", "Kağan", "Tolga", "Serkan", "Gökhan", "Uğur", "Volkan", "Murat", "Tarık", "Ozan", "Enes", "Furkan", "Yiğit", "Baran", "Eren", "Alp", "Metehan", "Doruk", "Bora", "Salih", "Halil", "Recep", "Çınar"];
const FILLER_FEMALE_FIRST_NAMES = ["Ayşe", "Fatma", "Emine", "Hatice", "Elif", "Merve", "Büşra", "Esra", "Ceren", "Gizem", "İrem", "Melis", "Aslı", "Nazlı", "Ece", "Dilara", "Sude", "Beyza", "Yasemin", "Pınar", "Seda", "Buse", "Duygu", "Tuğçe", "Bahar", "Gamze", "Nisa", "Aylin", "Damla", "Öykü", "Sıla", "Rüya", "Cansu", "Betül", "Nil", "Hilal", "Nehir", "Yağmur", "Defne", "İpek"];
const FILLER_LAST_NAMES = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Öztürk", "Aydın", "Özdemir", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek", "Polat", "Korkmaz", "Bulut", "Aksoy", "Erdoğan", "Güneş", "Acar", "Yalçın", "Avcı", "Coşkun", "Tekin", "Ünal", "Kaplan", "Bozkurt", "Tunç", "Ateş", "Sarı", "Uçar", "Ekinci", "Karaca", "Aktaş", "Genç"];

function fillerName(globalIndex: number): string {
  const isMale = globalIndex % 2 === 0;
  const first = isMale
    ? FILLER_MALE_FIRST_NAMES[(globalIndex / 2) % FILLER_MALE_FIRST_NAMES.length]
    : FILLER_FEMALE_FIRST_NAMES[((globalIndex - 1) / 2) % FILLER_FEMALE_FIRST_NAMES.length];
  const last = FILLER_LAST_NAMES[globalIndex % FILLER_LAST_NAMES.length];
  return `${first} ${last}`;
}

let fillerCursor = 0;
function buildRoster(branchId: string, branchName: string, count: number): SeatRosterStudent[] {
  const knownStudents = INITIAL_STUDENT_REPORTS.filter((student) => student.branch === branchName);
  const roster: SeatRosterStudent[] = knownStudents.map((student) => ({ id: student.id, name: student.name }));
  for (let i = roster.length; i < count; i++) {
    roster.push({ id: `${branchId}-${i + 1}`, name: fillerName(fillerCursor++) });
  }
  return roster;
}

export const SEAT_ROSTER_BY_BRANCH: Record<string, SeatRosterStudent[]> = Object.fromEntries(
  INITIAL_BRANCHES.map((branch) => [branch.id, buildRoster(branch.id, branch.name, branch.studentCount)])
);

// ----------------------------------------------------------------------------
// Çakışmasız Ders Dağıtım & Çarşaf Liste Matrisi
// ----------------------------------------------------------------------------

export const SCHEDULE_DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"] as const satisfies readonly DayOfWeek[];
export type ScheduleDay = (typeof SCHEDULE_DAYS)[number];

export const SCHEDULE_SLOTS = ["16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00"] as const;
export type ScheduleSlot = (typeof SCHEDULE_SLOTS)[number];

export type ScheduleAssignment = {
  id: string;
  branchId: string;
  branchName: string;
  day: ScheduleDay;
  // string (ScheduleSlot union'ı DEĞİL) — saat dilimleri artık kurum
  // bazında dinamik (bkz. ScheduleSlotDefinition), sabit bir listeye
  // kilitli değil.
  slot: string;
  teacherName: string;
  subject: string;
};

export const INITIAL_SCHEDULE: ScheduleAssignment[] = [
  { id: "s1", branchId: "12a", branchName: "12-A VIP", day: "Pazartesi", slot: "16:00-17:00", teacherName: "İrfan Hoca", subject: "Matematik" },
  { id: "s2", branchId: "12a", branchName: "12-A VIP", day: "Çarşamba", slot: "17:00-18:00", teacherName: "Kemal Hoca", subject: "Fizik" },
  { id: "s3", branchId: "10a", branchName: "10-A VIP", day: "Salı", slot: "16:00-17:00", teacherName: "Selin Hoca", subject: "Türkçe" },
  { id: "s4", branchId: "11a", branchName: "11-A Fen", day: "Perşembe", slot: "18:00-19:00", teacherName: "Kemal Hoca", subject: "Fizik" },
  { id: "s5", branchId: "lgs", branchName: "LGS Derece", day: "Cuma", slot: "16:00-17:00", teacherName: "Ayşe Hoca", subject: "LGS Branş" },
  { id: "s6", branchId: "11a", branchName: "11-A Fen", day: "Salı", slot: "17:00-18:00", teacherName: "İrfan Hoca", subject: "Matematik" },
  { id: "s7", branchId: "mezun", branchName: "YKS Mezun Sınıfı", day: "Çarşamba", slot: "18:00-19:00", teacherName: "İrfan Hoca", subject: "Matematik" },
  { id: "s8", branchId: "12a", branchName: "12-A VIP", day: "Perşembe", slot: "16:00-17:00", teacherName: "İrfan Hoca", subject: "Matematik" },
  { id: "s9", branchId: "11a", branchName: "11-A Fen", day: "Cuma", slot: "17:00-18:00", teacherName: "İrfan Hoca", subject: "Matematik" },
];

// Öğretmenin ders veremeyeceği, kurum dışı bağlılığı sebebiyle müsait olmadığı saatler (mock).
export const TEACHER_UNAVAILABLE: { teacherName: string; day: ScheduleDay; slot: ScheduleSlot }[] = [
  { teacherName: "İrfan Hoca", day: "Cuma", slot: "19:00-20:00" },
  { teacherName: "Selin Hoca", day: "Perşembe", slot: "16:00-17:00" },
  { teacherName: "Kemal Hoca", day: "Pazartesi", slot: "19:00-20:00" },
  { teacherName: "Ayşe Hoca", day: "Salı", slot: "18:00-19:00" },
];

// ----------------------------------------------------------------------------
// YKS & LGS Tercih Robotu Simülatörü
// ⚠️ minRanking değerleri temsili/örnek verilerdir — gerçek ÖSYM taban
// sıralamaları değildir, gerçek tercih döneminde resmi kılavuzla doğrulanmalıdır.
// ----------------------------------------------------------------------------

export type PreferenceCategory = "hayal" | "ideal" | "garanti";

export const PREFERENCE_CATEGORY_LABEL: Record<PreferenceCategory, string> = {
  hayal: "Hayal",
  ideal: "İdeal",
  garanti: "Garanti",
};

export type UniversityProgram = {
  id: string;
  university: string;
  department: string;
  city: string;
  minRanking: number;
  quota: number;
};

export const UNIVERSITY_PROGRAMS: UniversityProgram[] = [
  { id: "u1", university: "Boğaziçi Üniversitesi", department: "Bilgisayar Mühendisliği", city: "İstanbul", minRanking: 2500, quota: 90 },
  { id: "u2", university: "ODTÜ", department: "Elektrik-Elektronik Mühendisliği", city: "Ankara", minRanking: 4200, quota: 110 },
  { id: "u3", university: "İTÜ", department: "Endüstri Mühendisliği", city: "İstanbul", minRanking: 8500, quota: 80 },
  { id: "u4", university: "Hacettepe Üniversitesi", department: "Tıp Fakültesi", city: "Ankara", minRanking: 6100, quota: 200 },
  { id: "u5", university: "Ege Üniversitesi", department: "Diş Hekimliği", city: "İzmir", minRanking: 22000, quota: 60 },
  { id: "u6", university: "Marmara Üniversitesi", department: "Hukuk Fakültesi", city: "İstanbul", minRanking: 28000, quota: 150 },
  { id: "u7", university: "Anadolu Üniversitesi", department: "İşletme", city: "Eskişehir", minRanking: 65000, quota: 300 },
  { id: "u8", university: "Gazi Üniversitesi", department: "Elektrik-Elektronik Mühendisliği", city: "Ankara", minRanking: 48000, quota: 120 },
  { id: "u9", university: "Yıldız Teknik Üniversitesi", department: "Mimarlık", city: "İstanbul", minRanking: 35000, quota: 70 },
  { id: "u10", university: "Dokuz Eylül Üniversitesi", department: "Endüstri Mühendisliği", city: "İzmir", minRanking: 58000, quota: 90 },
  { id: "u11", university: "Ankara Üniversitesi", department: "Eczacılık", city: "Ankara", minRanking: 41000, quota: 100 },
  { id: "u12", university: "Sakarya Üniversitesi", department: "Bilgisayar Mühendisliği", city: "Sakarya", minRanking: 95000, quota: 130 },
];

// ----------------------------------------------------------------------------
// LGS Lise Tercih Robotu Simülatörü
// ⚠️ minScore değerleri temsili/örnek verilerdir — gerçek MEB/LGS taban
// puanları değildir, gerçek tercih döneminde resmi kılavuzla doğrulanmalıdır.
// ----------------------------------------------------------------------------

export type HighSchoolProgram = {
  id: string;
  schoolName: string;
  type: "Fen Lisesi" | "Sosyal Bilimler Lisesi" | "Anadolu Lisesi" | "Mesleki ve Teknik Anadolu Lisesi";
  city: string;
  minScore: number;
  quota: number;
};

export const HIGH_SCHOOL_PROGRAMS: HighSchoolProgram[] = [
  { id: "h1", schoolName: "Galatasaray Fen Lisesi", type: "Fen Lisesi", city: "İstanbul", minScore: 497, quota: 68 },
  { id: "h2", schoolName: "İstanbul Fen Lisesi", type: "Fen Lisesi", city: "İstanbul", minScore: 493, quota: 136 },
  { id: "h3", schoolName: "Kabataş Erkek Lisesi", type: "Anadolu Lisesi", city: "İstanbul", minScore: 481, quota: 240 },
  { id: "h4", schoolName: "Vefa Lisesi", type: "Anadolu Lisesi", city: "İstanbul", minScore: 470, quota: 200 },
  { id: "h5", schoolName: "Nişantaşı Sosyal Bilimler Lisesi", type: "Sosyal Bilimler Lisesi", city: "İstanbul", minScore: 455, quota: 90 },
  { id: "h6", schoolName: "Beşiktaş Anadolu Lisesi", type: "Anadolu Lisesi", city: "İstanbul", minScore: 440, quota: 180 },
  { id: "h7", schoolName: "Ataköy Anadolu Lisesi", type: "Anadolu Lisesi", city: "İstanbul", minScore: 410, quota: 220 },
  { id: "h8", schoolName: "Bahçelievler Mesleki ve Teknik Anadolu Lisesi", type: "Mesleki ve Teknik Anadolu Lisesi", city: "İstanbul", minScore: 350, quota: 260 },
];


// ----------------------------------------------------------------------------
// Öğretmen Paneli — Ders & Sınıf Operasyonu + Analiz & Etüt/İletişim
// Tüm veriler branş/öğretmen bazlı — panel bunları STAFF.branches üzerinden
// oturum açan öğretmene göre süzer (bkz. lib/teacher-scope.ts).
// ----------------------------------------------------------------------------

export type CurriculumSubtopic = { id: string; name: string; covered: boolean; dateCovered?: string };
export type CurriculumTopic = { id: string; name: string; grade: GradeLevel; subtopics: CurriculumSubtopic[] };

// Faz K — Akademik Röntgen ŞUANLIK SADECE lise (9-12. sınıf) için;
// ortaokul (5-8/LGS) desteği ileride eklenecek. CURRICULUM_TREE zaten her
// konuya bir `grade` taşıdığı için röntgen tarafındaki HER filtre
// (roster, ders/konu seçicileri, atama ekranları) bu tek sabiti kullanır —
// ortaokul desteği eklenince SADECE bu değer değişir/kaldırılır.
export const XRAY_MIN_GRADE = 9;

export const CURRICULUM_TREE: Record<string, CurriculumTopic[]> = {
  // Faz Z2 — kullanıcının paylaştığı "Rehber Matematik" kaynaklı 4 detaylı
  // infografik (1./2. Aşama Matematik + Geometri konuları, 9-12. sınıf) ile
  // hibrit yapı NET alt konu kırılımına kavuşturuldu. Bu kaynak 2024 MEB
  // reformunun resmi tema iskeletini (bkz. Faz Z'de bolluk.meb.k12.tr PDF'i)
  // DOĞRULUYOR ve çok daha isabetli alt konu detayı veriyor — önceki turdaki
  // "pratik yerleşim" (kaynaksız tahmin) etiketli konuların çoğu ya bu
  // kaynakla NET olarak eşleşti (o zaman sourced'e çevrildi) ya da yanlış
  // sınıf/temada olduğu ortaya çıktı ve düzeltildi (örn. Üstel ve Logaritmik
  // Fonksiyonlar aslında 12. değil 11. sınıfta; Dönüşümler/Analitik Geometri/
  // grade-12 Trigonometri/grade-11 Uzay Geometri hiçbir sınıfta resmi temada
  // yer almıyor — kaldırıldı, çünkü zaten başka sınıflarda [Eşlik ve
  // Benzerlik@9, Analitik İnceleme@10, Geometrik Şekiller@10-11] sarmal
  // olarak işleniyorlar). İntegral yine tek istisna: resmi kaynakta YOK ama
  // mt12b-1'de 30 soruluk GERÇEK yüklenmiş havuz olduğu için dershane
  // pratiği olarak Değişimin Matematiği altında KORUNDU.
  //
  // Gerçek üretim verisi taşıyan 10 subtopic id'si (mt9-1, mt9-2, mt10-1,
  // mt10-2, mt10-3, mt12a-1, mt12a-2, mt12a-3, mt12b-1, mt12b-2) yine
  // AYNEN korundu — id'ler asla değişmedi, sadece görüntülenen konu grubu
  // ve (gerekliyse) name metni bu kaynakla daha isabetli hale getirildi.
  Matematik: [
    // ── 9. SINIF — resmi 7 tema ──
    // sourced: Sayılar → "Üslü ve Köklü Gösterimler" / "Gerçek Sayı
    // Aralıkları ve Kümeler" / "Sayı Kümeleri ve İşlem Özellikleri". Son iki
    // madde mt9-1/mt9-2'nin GERÇEK verili konularıyla kavramsal olarak zaten
    // örtüşüyor (id/name KORUNDU) — sadece eksik kalan "Üslü ve Köklü
    // Gösterimler" yeni alt konu olarak eklendi.
    {
      id: "mt9",
      name: "Sayılar",
      grade: 9,
      subtopics: [
        { id: "mt9-1", name: "Küme Kavramı ve İşlemler", covered: true, dateCovered: "5 hafta önce" },
        { id: "mt9-2", name: "Rasyonel ve Gerçek Sayılar", covered: false },
        { id: "mt9-sayilar-3", name: "Üslü ve Köklü Gösterimler", covered: false },
      ],
    },
    {
      id: "mt9-nicelikler-degisimler",
      name: "Nicelikler ve Değişimler",
      grade: 9,
      subtopics: [
        { id: "mt9-nicelikler-degisimler-1", name: "Doğrusal Fonksiyonlar", covered: false },
        { id: "mt9-nicelikler-degisimler-2", name: "Mutlak Değer Fonksiyonları", covered: false },
        { id: "mt9-nicelikler-degisimler-3", name: "Doğrusal Denklem ve Eşitsizlik Problemleri", covered: false },
      ],
    },
    {
      id: "mt9-algoritma-bilisim",
      name: "Algoritma ve Bilişim",
      grade: 9,
      subtopics: [
        { id: "mt9-algoritma-bilisim-1", name: "Algoritma Temelli Problemler", covered: false },
        { id: "mt9-algoritma-bilisim-2", name: "Akış Şeması, Çizge ve Sözde Kod", covered: false },
        { id: "mt9-algoritma-bilisim-3", name: "Mantık Bağlaçları ve Niceleyiciler", covered: false },
      ],
    },
    {
      id: "mt9-geometrik-sekiller",
      name: "Geometrik Şekiller",
      grade: 9,
      subtopics: [
        { id: "mt9-geometrik-sekiller-1", name: "Üçgende İç ve Dış Açı Özellikleri", covered: false },
        { id: "mt9-geometrik-sekiller-2", name: "Üçgende Açı-Kenar İlişkileri", covered: false },
        { id: "mt9-geometrik-sekiller-3", name: "Kenar İlişkileri ve Üçgen Eşitsizliği", covered: false },
      ],
    },
    {
      id: "mt9-eslik-benzerlik",
      name: "Eşlik ve Benzerlik",
      grade: 9,
      subtopics: [
        { id: "mt9-eslik-benzerlik-1", name: "Yansıma, Öteleme ve Dönme", covered: false },
        { id: "mt9-eslik-benzerlik-2", name: "Üçgenlerde Eşlik ve Benzerlik Koşulları", covered: false },
        { id: "mt9-eslik-benzerlik-3", name: "Tales, Öklid ve Pisagor Teoremleri", covered: false },
      ],
    },
    {
      id: "mt9-istatistiksel-arastirma",
      name: "İstatistiksel Araştırma Süreci",
      grade: 9,
      subtopics: [
        { id: "mt9-istatistiksel-arastirma-1", name: "Tek Nicel Değişkenli Veriler", covered: false },
        { id: "mt9-istatistiksel-arastirma-2", name: "Histogram, Kutu ve Nokta Grafiği", covered: false },
        { id: "mt9-istatistiksel-arastirma-3", name: "Ortalama, Medyan, Mod ve Yayılım Ölçüleri", covered: false },
      ],
    },
    {
      id: "mt9-veriden-olasiliga",
      name: "Veriden Olasılığa",
      grade: 9,
      subtopics: [
        { id: "mt9-veriden-olasiliga-1", name: "Deneysel ve Teorik Olasılık", covered: false },
        { id: "mt9-veriden-olasiliga-2", name: "Örnek Uzay ve Göreli Sıklık", covered: false },
        { id: "mt9-veriden-olasiliga-3", name: "Ayrık ve Ayrık Olmayan Olaylar", covered: false },
      ],
    },

    // ── 10. SINIF — resmi 7 tema ──
    {
      id: "mt10-sayilar",
      name: "Sayılar",
      grade: 10,
      subtopics: [
        { id: "mt10-sayilar-1", name: "Asal Çarpanlar ve Bölenler", covered: false },
        { id: "mt10-sayilar-2", name: "EBOB ve EKOK", covered: false },
        { id: "mt10-sayilar-3", name: "Bölünebilme Kuralları", covered: false },
      ],
    },
    // "Fonksiyonlar" resmi listede ayrı bir tema değil, Nicelikler ve
    // Değişimler temasının kapsamına giriyor — mt10-1/2/3'teki GERÇEK
    // ustalık kaydı (id/name AYNEN korunarak) bu resmi temanın altında;
    // kaynakta eksik kalan "Karesel, Kareköklü ve Rasyonel Fonksiyonlar"
    // yeni alt konu olarak eklendi.
    {
      id: "mt10-nicelikler-degisimler",
      name: "Nicelikler ve Değişimler",
      grade: 10,
      subtopics: [
        { id: "mt10-1", name: "Fonksiyon Kavramı", covered: true, dateCovered: "4 hafta önce" },
        { id: "mt10-2", name: "Bileşke Fonksiyon", covered: true, dateCovered: "3 hafta önce" },
        { id: "mt10-3", name: "Ters Fonksiyon", covered: false },
        { id: "mt10-nicelikler-degisimler-4", name: "Karesel, Kareköklü ve Rasyonel Fonksiyonlar", covered: false },
      ],
    },
    {
      id: "mt10-sayma-algoritma-bilisim",
      name: "Sayma, Algoritma ve Bilişim",
      grade: 10,
      subtopics: [
        { id: "mt10-sayma-algoritma-bilisim-1", name: "Sayma Stratejileri", covered: false },
        { id: "mt10-sayma-algoritma-bilisim-2", name: "Faktöriyel, Seçme ve Sıralama Sayısı", covered: false },
        { id: "mt10-sayma-algoritma-bilisim-3", name: "Cebirsel ve Fonksiyonel İşlemlerin Algoritmik Yapısı", covered: false },
      ],
    },
    // 10. sınıfta Eşlik ve Benzerlik ayrı bir tema değil, kaynağın kendi
    // notuna göre ("Geometrik Şekiller temasında kullanılıyor") bu temanın
    // içine katılıyor — 4. alt konu olarak eklendi.
    {
      id: "mt10-geometrik-sekiller",
      name: "Geometrik Şekiller",
      grade: 10,
      subtopics: [
        { id: "mt10-geometrik-sekiller-1", name: "Dik Üçgende Trigonometrik Oranlar ve Özdeşlikler", covered: false },
        { id: "mt10-geometrik-sekiller-2", name: "Üçgenin Yardımcı Elemanları ve Alan", covered: false },
        { id: "mt10-geometrik-sekiller-3", name: "Sinüs ve Kosinüs Teoremleri", covered: false },
        { id: "mt10-geometrik-sekiller-4", name: "Eşlik, Benzerlik ve Pisagor Bilgileri", covered: false },
      ],
    },
    {
      id: "mt10-analitik-inceleme",
      name: "Analitik İnceleme",
      grade: 10,
      subtopics: [
        { id: "mt10-analitik-inceleme-1", name: "Dik Koordinat Sisteminde Nokta ve Doğru", covered: false },
        { id: "mt10-analitik-inceleme-2", name: "İki Nokta Arasındaki Uzaklık", covered: false },
        { id: "mt10-analitik-inceleme-3", name: "Doğru Parçasını Belli Oranda Bölme", covered: false },
        { id: "mt10-analitik-inceleme-4", name: "Eğim, Paralellik, Diklik ve Kesişme", covered: false },
      ],
    },
    {
      id: "mt10-istatistiksel-arastirma",
      name: "İstatistiksel Araştırma Süreci",
      grade: 10,
      subtopics: [
        { id: "mt10-istatistiksel-arastirma-1", name: "İki Kategorik Değişkenli Veriler", covered: false },
        { id: "mt10-istatistiksel-arastirma-2", name: "İki Yönlü Tablo ve Koşullu Göreli Sıklık", covered: false },
        { id: "mt10-istatistiksel-arastirma-3", name: "Değişkenler Arasındaki İlişkiler", covered: false },
      ],
    },
    {
      id: "mt10-veriden-olasiliga",
      name: "Veriden Olasılığa",
      grade: 10,
      subtopics: [
        { id: "mt10-veriden-olasiliga-1", name: "Koşullu Olasılık", covered: false },
        { id: "mt10-veriden-olasiliga-2", name: "Bağımlı ve Bağımsız Olaylar", covered: false },
        { id: "mt10-veriden-olasiliga-3", name: "Bayes Teoremi", covered: false },
      ],
    },

    // ── 11. SINIF — resmi SADECE 3 tema ──
    {
      id: "mt11-nicelikler-degisimler",
      name: "Nicelikler ve Değişimler",
      grade: 11,
      subtopics: [
        { id: "mt11-nicelikler-degisimler-1", name: "Trigonometrik Fonksiyonlar ve Denklemler", covered: false },
        { id: "mt11-nicelikler-degisimler-2", name: "Üstel ve Logaritmik Fonksiyonlar", covered: false },
        { id: "mt11-nicelikler-degisimler-3", name: "Fonksiyonlarla Dört İşlem ve Bileşke", covered: false },
      ],
    },
    {
      id: "mt11-geometrik-sekiller",
      name: "Geometrik Şekiller",
      grade: 11,
      subtopics: [
        { id: "mt11-geometrik-sekiller-1", name: "Dörtgenlerin Açı, Kenar, Köşegen, Simetri ve Alan Özellikleri", covered: false },
        { id: "mt11-geometrik-sekiller-2", name: "Özel Dörtgenler ve Aralarındaki İlişkiler", covered: false },
        { id: "mt11-geometrik-sekiller-3", name: "İçbükey ve Dışbükey Çokgenlerin Sınıflandırılması", covered: false },
        { id: "mt11-geometrik-sekiller-4", name: "Çokgenlerin Açı, Köşegen, Simetri ve Alan Özellikleri", covered: false },
      ],
    },
    {
      id: "mt11-istatistiksel-arastirma",
      name: "İstatistiksel Araştırma Süreci",
      grade: 11,
      subtopics: [
        { id: "mt11-istatistiksel-arastirma-1", name: "İki Nicel Değişkenli Veriler", covered: false },
        { id: "mt11-istatistiksel-arastirma-2", name: "Serpme Diyagramı", covered: false },
        { id: "mt11-istatistiksel-arastirma-3", name: "Bölgelere Göre Sayım Oranı ve Korelasyon Katsayısı", covered: false },
      ],
    },

    // ── 12. SINIF — resmi 5 tema ──
    {
      id: "mt12-nicelikler-degisimler",
      name: "Nicelikler ve Değişimler",
      grade: 12,
      subtopics: [
        { id: "mt12-nicelikler-degisimler-1", name: "Aritmetik ve Geometrik Diziler", covered: false },
        { id: "mt12-nicelikler-degisimler-2", name: "Polinom Fonksiyonlar", covered: false },
        { id: "mt12-nicelikler-degisimler-3", name: "Polinom ve Rasyonel Fonksiyonlarla Denklem-Eşitsizlikler", covered: false },
      ],
    },
    // sourced: "Limit ve Süreklilik" / "Değişim Oranı, Türev ve Türev
    // Kuralları" / "Türev Uygulamaları, Rolle ve Ortalama Değer Teoremleri"
    // — mt12a-1/2/3 (GERÇEK ustalık kaydı) bu üç maddeyle kavramsal olarak
    // zaten örtüşüyor, sadece eksik kalan "Limit ve Süreklilik" yeni alt
    // konu olarak eklendi. İntegral (mt12b-1/2) resmi kaynakta YOK ama
    // mt12b-1'de 30 soruluk GERÇEK yüklenmiş havuz olduğu için dershane
    // pratiği olarak aynı temanın altında KORUNDU.
    {
      id: "mt12-degisimin-matematigi",
      name: "Değişimin Matematiği",
      grade: 12,
      subtopics: [
        { id: "mt12-degisimin-matematigi-1", name: "Limit ve Süreklilik", covered: false },
        { id: "mt12a-1", name: "Türev Kuralları", covered: true, dateCovered: "1 hafta önce" },
        { id: "mt12a-2", name: "Türev Uygulamaları", covered: false },
        { id: "mt12a-3", name: "Grafik Çizimi", covered: false },
        { id: "mt12b-1", name: "Belirsiz İntegral", covered: false },
        { id: "mt12b-2", name: "Belirli İntegral ve Alan Hesabı", covered: false },
      ],
    },
    {
      id: "mt12-geometrik-sekiller",
      name: "Geometrik Şekiller",
      grade: 12,
      subtopics: [
        { id: "mt12-geometrik-sekiller-1", name: "Çemberin Elemanları: Kesen, Kiriş, Teğet, Çap ve Yay", covered: false },
        { id: "mt12-geometrik-sekiller-2", name: "Çemberde Açı, Kiriş ve Teğet Özellikleri", covered: false },
        { id: "mt12-geometrik-sekiller-3", name: "Dairenin Alanı", covered: false },
        { id: "mt12-geometrik-sekiller-4", name: "Çember ve Daire Problemleri", covered: false },
      ],
    },
    {
      id: "mt12-geometrik-cisimler",
      name: "Geometrik Cisimler",
      grade: 12,
      subtopics: [
        { id: "mt12-geometrik-cisimler-1", name: "Dik Prizma ve Dik Dairesel Silindirin Elemanları", covered: false },
        { id: "mt12-geometrik-cisimler-2", name: "Dik Piramit, Dik Dairesel Koni ve Küre", covered: false },
        { id: "mt12-geometrik-cisimler-3", name: "Yüzey Alanı ve Hacim Bağıntıları", covered: false },
        { id: "mt12-geometrik-cisimler-4", name: "Geometrik Cisim Problemleri", covered: false },
      ],
    },
    {
      id: "mt12-hazir-veriler",
      name: "Hazır Veriler Üzerinde Çalışma",
      grade: 12,
      subtopics: [
        { id: "mt12-hazir-veriler-1", name: "Hazır Verilerle İstatistiksel Araştırma", covered: false },
        { id: "mt12-hazir-veriler-2", name: "Veri Kaynaklarını İnceleme ve Verileri Analiz Etme", covered: false },
        { id: "mt12-hazir-veriler-3", name: "Veriye Dayalı Çıkarım ve Karar Verme", covered: false },
      ],
    },
  ],
  Fizik: [
    {
      id: "fz9",
      name: "Fizik Bilimine Giriş",
      grade: 9,
      subtopics: [{ id: "fz9-1", name: "Fiziksel Büyüklükler", covered: true, dateCovered: "3 hafta önce" }],
    },
    {
      id: "fz11",
      name: "Kuvvet ve Hareket",
      grade: 11,
      subtopics: [
        { id: "fz11-1", name: "Newton Kanunları", covered: true, dateCovered: "2 hafta önce" },
        { id: "fz11-2", name: "Sürtünme Kuvveti", covered: false },
      ],
    },
    {
      id: "fz12",
      name: "Optik",
      grade: 12,
      subtopics: [
        { id: "fz12-1", name: "Işığın Kırılması", covered: false },
        { id: "fz12-2", name: "Mercekler", covered: false },
      ],
    },
  ],
  Türkçe: [
    {
      id: "tr10",
      name: "Paragraf",
      grade: 10,
      subtopics: [
        { id: "tr10-1", name: "Anlatım Teknikleri", covered: true, dateCovered: "1 hafta önce" },
        { id: "tr10-2", name: "Paragrafta Anlam", covered: true, dateCovered: "3 gün önce" },
      ],
    },
    {
      id: "tr11",
      name: "Dil Bilgisi",
      grade: 11,
      subtopics: [{ id: "tr11-1", name: "Yazım Kuralları", covered: false }],
    },
  ],
  "LGS Branş": [
    {
      id: "lgs8",
      name: "Sözel & Sayısal Mantık",
      grade: 8,
      subtopics: [
        { id: "lgs8-1", name: "Sözel Mantık", covered: true, dateCovered: "5 gün önce" },
        { id: "lgs8-2", name: "Sayısal Mantık", covered: false },
      ],
    },
  ],
};

// Akademik Röntgen'in kullanabileceği dersler — SADECE en az bir lise
// (grade >= XRAY_MIN_GRADE) konusu olan dersler (bkz. XRAY_MIN_GRADE
// yorumu). "LGS Branş" gibi tamamen ortaokula özel dersler burada
// GÖRÜNMEZ.
export const XRAY_SUBJECTS = Object.entries(CURRICULUM_TREE)
  .filter(([, topics]) => topics.some((t) => t.grade >= XRAY_MIN_GRADE))
  .map(([subject]) => subject);

export type DutySlot = { teacherName: string; day: ScheduleDay; slot: ScheduleSlot; label: string };

export const TEACHER_DUTY_SLOTS: DutySlot[] = [{ teacherName: "İrfan Hoca", day: "Pazartesi", slot: "19:00-20:00", label: "Nöbet" }];

export type QuestionPoolItem = { id: string; subject: string; topic: string; questionText: string; difficulty: "kolay" | "orta" | "zor" };

export const QUESTION_POOL: QuestionPoolItem[] = [
  { id: "q1", subject: "Matematik", topic: "Türev", questionText: "f(x) = x³ - 3x² fonksiyonunun kritik noktalarını bulunuz.", difficulty: "orta" },
  { id: "q2", subject: "Matematik", topic: "Limit", questionText: "lim(x→0) sin(x)/x limitini hesaplayınız.", difficulty: "kolay" },
  { id: "q3", subject: "Matematik", topic: "İntegral", questionText: "∫(2x + 3)dx belirsiz integralini çözünüz.", difficulty: "kolay" },
  { id: "q4", subject: "Matematik", topic: "Fonksiyonlar", questionText: "f(x) = 2x+1 ve g(x) = x² için (f∘g)(x) bileşke fonksiyonunu bulunuz.", difficulty: "zor" },
  { id: "q5", subject: "Matematik", topic: "Diziler", questionText: "Aritmetik dizide a₁=3, d=4 ise a₁₀ kaçtır?", difficulty: "kolay" },
];

export const POP_QUIZ_QUESTIONS: string[] = [
  "f(x) = x² - 4x + 3 fonksiyonunun köklerini bulunuz.",
  "Bir doğrunun eğimi 2 ise, bu doğruya dik olan doğrunun eğimi kaçtır?",
  "3, 7, 11, 15, ... dizisinin 20. terimi kaçtır?",
  "lim(x→2) (x²-4)/(x-2) limitinin değeri nedir?",
  "Bir küpün hacmi 27 cm³ ise bir kenarı kaç cm'dir?",
];

export type TopicHeatmapRow = { topic: string; scores: number[] };

export const TOPIC_HEATMAP: Record<string, TopicHeatmapRow[]> = {
  Matematik: [
    { topic: "Fonksiyonlar", scores: [92, 78, 65, 88, 55, 70] },
    { topic: "Limit", scores: [85, 60, 72, 90, 48, 66] },
    { topic: "Türev", scores: [70, 55, 40, 82, 35, 58] },
    { topic: "İntegral", scores: [60, 45, 30, 75, 28, 50] },
  ],
  Fizik: [
    { topic: "Kuvvet ve Hareket", scores: [88, 70, 60, 80, 50, 65] },
    { topic: "Vektörler", scores: [75, 58, 45, 70, 40, 55] },
    { topic: "Optik", scores: [55, 40, 30, 62, 25, 45] },
    { topic: "Elektrik", scores: [65, 50, 42, 72, 33, 48] },
  ],
  Türkçe: [
    { topic: "Paragraf", scores: [90, 80, 70, 85, 60, 75] },
    { topic: "Dil Bilgisi", scores: [70, 55, 48, 68, 40, 52] },
  ],
  "LGS Branş": [
    { topic: "Sözel Mantık", scores: [80, 65, 58, 74, 50, 62] },
    { topic: "Sayısal Mantık", scores: [68, 52, 44, 70, 38, 55] },
  ],
};

export type RemediationTask = { id: string; studentName: string; topic: string; taskDescription: string; assignedAt: string };

export const INITIAL_REMEDIATION_TASKS: RemediationTask[] = [
  { id: "rm1", studentName: "Cem Demir", topic: "Türev", taskDescription: "Türev kuralları tekrarı — 15 soru", assignedAt: "3 gün önce" },
];

export const WORD_CLOUD_TERMS: { term: string; weight: number }[] = [
  { term: "Türev", weight: 9 },
  { term: "İntegral", weight: 5 },
  { term: "Limit", weight: 7 },
  { term: "Fonksiyon", weight: 6 },
  { term: "Asimptot", weight: 3 },
  { term: "Süreklilik", weight: 4 },
  { term: "Diziler", weight: 2 },
  { term: "Trigonometri", weight: 3 },
  { term: "Olasılık", weight: 2 },
  { term: "Grafik Çizimi", weight: 5 },
];
