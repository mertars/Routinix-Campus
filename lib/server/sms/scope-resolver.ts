import { prisma } from "@/lib/server/prisma";
import type { NotificationScopeType, Prisma } from "@prisma/client";

export type Recipient = {
  phone: string;
  parentName: string;
  studentName: string;
  studentId: string;
  parentId: string;
};

// Kapsam seçimini (TumOkul / Kademe / Sube / OzelGrup / CustomIDList) somut
// bir alıcı listesine çevirir. Sadece SMS onayı (smsConsent) olan velilere
// gönderim yapılır — KVKK/İYS uyumu için zorunlu filtre.
export async function resolveScope(scopeType: NotificationScopeType, scopeValue?: string | null): Promise<Recipient[]> {
  const studentWhere = buildStudentWhere(scopeType, scopeValue);

  const students = await prisma.student.findMany({
    where: studentWhere,
    include: { parents: { include: { parent: true } } },
  });

  const recipients: Recipient[] = [];
  for (const student of students) {
    for (const link of student.parents) {
      if (!link.parent.smsConsent) continue;
      recipients.push({
        phone: link.parent.mobilePhone,
        parentName: `${link.parent.firstName} ${link.parent.lastName}`,
        studentName: `${student.firstName} ${student.lastName}`,
        studentId: student.id,
        parentId: link.parent.id,
      });
    }
  }
  return recipients;
}

function buildStudentWhere(scopeType: NotificationScopeType, scopeValue?: string | null): Prisma.StudentWhereInput {
  switch (scopeType) {
    case "ALL_SCHOOL":
      return {};
    case "GRADE": {
      const grade = Number(scopeValue);
      if (!scopeValue || Number.isNaN(grade)) throw new Error("GRADE kapsamı için geçerli bir sınıf seviyesi (scopeValue) gerekli.");
      return { branch: { grade } };
    }
    case "BRANCH": {
      if (!scopeValue) throw new Error("BRANCH kapsamı için şube adı (scopeValue) gerekli.");
      return { branch: { name: scopeValue } };
    }
    case "CUSTOM_ID_LIST": {
      const ids = (scopeValue ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length === 0) throw new Error("CUSTOM_ID_LIST kapsamı için en az bir öğrenci ID'si gerekli.");
      return { id: { in: ids } };
    }
    case "CUSTOM_GROUP":
      // Şimdilik özel grup modeli yok — scopeValue'yu CUSTOM_ID_LIST gibi
      // ele alıyoruz. Ayrı bir Group modeli eklendiğinde burası genişletilir.
      return buildStudentWhere("CUSTOM_ID_LIST", scopeValue);
    default:
      throw new Error(`Bilinmeyen kapsam tipi: ${scopeType}`);
  }
}
