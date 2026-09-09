import { prisma } from "@/lib/server/prisma";
import { computeRemaining } from "@/lib/server/payments/student-debt";

// Kurum genelinde tek kutudan arama.
//
// Testte müdür bir öğrenciyi bulmak için önce hangi ekranda olduğunu
// hatırlamak zorundaydı: kadro listesi mi, ödeme paneli mi, rehberlik
// mi? Aradığı şey çoğu zaman bir İSİM ya da NUMARA; nerede aranacağı
// onun problemi olmamalı.
//
// Telefon numarası da aranabilir: veli "borcum ne kadar" diye
// aradığında müdürün elindeki tek bilgi ekrandaki numara olur.

export type SearchHit = {
  type: "STUDENT" | "TEACHER" | "PARENT";
  id: string;
  title: string;
  subtitle: string;
  /** Pasif kayıtlar da bulunur ama işaretlenir. */
  isActive: boolean;
  /** Öğrenciler için açık borç — müdürün en sık sorduğu ikinci şey. */
  openDebt?: number;
};

const LIMIT_PER_TYPE = 8;

// Telefon araması için: kullanıcı "0532 111 22 33" yazdığında da
// "05321112233" kayıtla eşleşsin.
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export async function globalSearch(institutionId: string, rawQuery: string): Promise<SearchHit[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const digits = digitsOnly(q);
  // Türkçe'de "İ" ve "I" farklı harflerdir; Postgres'in ILIKE'ı Türkçe
  // harita kullanmadığı için aramayı olduğu gibi bırakıp mode:
  // "insensitive" ile yetiniyoruz — kullanıcı ne yazdıysa ona yakın
  // olanı bulur.
  const contains = { contains: q, mode: "insensitive" as const };

  const [students, teachers, parents] = await Promise.all([
    prisma.student.findMany({
      where: {
        institutionId,
        OR: [
          { firstName: contains },
          { lastName: contains },
          { studentNumber: { contains: q } },
          ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
          ...(digits.length >= 4 ? [{ nationalId: { contains: digits } }] : []),
        ],
      },
      take: LIMIT_PER_TYPE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentNumber: true,
        isActive: true,
        branch: { select: { name: true } },
        installments: {
          where: { status: { in: ["PENDING", "PARTIALLY_PAID"] } },
          select: { amount: true, payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
        },
      },
    }),
    prisma.teacher.findMany({
      where: {
        institutionId,
        OR: [
          { firstName: contains },
          { lastName: contains },
          { subject: contains },
          ...(digits.length >= 4 ? [{ mobilePhone: { contains: digits } }] : []),
          ...(digits.length >= 4 ? [{ nationalId: { contains: digits } }] : []),
        ],
      },
      take: LIMIT_PER_TYPE,
      select: { id: true, firstName: true, lastName: true, subject: true, isActive: true, institutionalCode: true },
    }),
    prisma.parent.findMany({
      where: {
        institutionId,
        OR: [
          { firstName: contains },
          { lastName: contains },
          ...(digits.length >= 4 ? [{ mobilePhone: { contains: digits } }] : []),
        ],
      },
      take: LIMIT_PER_TYPE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobilePhone: true,
        students: { select: { student: { select: { firstName: true, lastName: true } } }, take: 3 },
      },
    }),
  ]);

  const hits: SearchHit[] = [];

  for (const s of students) {
    const openDebt = computeRemaining(s.installments);
    hits.push({
      type: "STUDENT",
      id: s.id,
      title: `${s.firstName} ${s.lastName}`,
      subtitle: `${s.branch.name} · No: ${s.studentNumber}`,
      isActive: s.isActive,
      openDebt,
    });
  }

  for (const t of teachers) {
    hits.push({
      type: "TEACHER",
      id: t.id,
      title: `${t.firstName} ${t.lastName}`,
      subtitle: [t.subject, t.institutionalCode].filter(Boolean).join(" · "),
      isActive: t.isActive,
    });
  }

  for (const p of parents) {
    const kids = p.students.map((l) => `${l.student.firstName} ${l.student.lastName}`).join(", ");
    hits.push({
      type: "PARENT",
      id: p.id,
      title: `${p.firstName} ${p.lastName}`,
      subtitle: kids ? `Veli · ${kids}` : "Veli",
      isActive: true,
    });
  }

  // Aktifler önce: müdürün aradığı kişi neredeyse her zaman aktiftir.
  return hits.sort((a, b) => Number(b.isActive) - Number(a.isActive));
}
