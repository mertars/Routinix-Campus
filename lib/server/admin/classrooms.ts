import { prisma } from "@/lib/server/prisma";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { createDefaultLayout, isValidClassroomLayout, type ClassroomLayout } from "@/lib/seating/types";
import type { Prisma } from "@prisma/client";

export type ClassroomSummary = { id: string; name: string; deskCount: number; seatCount: number };
export type ClassroomDetail = { id: string; name: string; layout: ClassroomLayout };

function summarize(id: string, name: string, layout: ClassroomLayout): ClassroomSummary {
  return { id, name, deskCount: layout.desks.length, seatCount: layout.desks.reduce((sum, d) => sum + d.seatCount, 0) };
}

export async function listClassrooms(institutionId: string): Promise<ClassroomSummary[]> {
  const classrooms = await prisma.classroom.findMany({ where: { institutionId }, orderBy: { name: "asc" } });
  return classrooms.map((c) => summarize(c.id, c.name, c.layout as unknown as ClassroomLayout));
}

export async function createClassroom(input: { institutionId: string; actorId: string; name: string }): Promise<ClassroomDetail> {
  const name = input.name.trim();
  if (!name) throw new AdminCreateError("Sınıf adı zorunludur.");

  const existing = await prisma.classroom.findFirst({ where: { institutionId: input.institutionId, name } });
  if (existing) throw new AdminCreateError(`Bu isimde bir sınıf zaten var: "${name}".`, 409);

  const layout = createDefaultLayout();
  const classroom = await prisma.classroom.create({
    data: { institutionId: input.institutionId, name, layout: layout as unknown as Prisma.InputJsonValue },
  });

  await recordAuditLog({
    institutionId: input.institutionId,
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "CLASSROOM_CREATED",
    targetType: "Classroom",
    targetId: classroom.id,
    metadata: { name },
  });

  return { id: classroom.id, name: classroom.name, layout };
}

export async function getClassroom(id: string, institutionId: string): Promise<ClassroomDetail> {
  const classroom = await prisma.classroom.findUnique({ where: { id } });
  if (!classroom || classroom.institutionId !== institutionId) throw new AdminCreateError("Sınıf bulunamadı.", 404);
  return { id: classroom.id, name: classroom.name, layout: classroom.layout as unknown as ClassroomLayout };
}

export async function updateClassroomLayout(input: { id: string; institutionId: string; layout: unknown }): Promise<ClassroomDetail> {
  const classroom = await prisma.classroom.findUnique({ where: { id: input.id } });
  if (!classroom || classroom.institutionId !== input.institutionId) throw new AdminCreateError("Sınıf bulunamadı.", 404);
  if (!isValidClassroomLayout(input.layout)) throw new AdminCreateError("Geçersiz kroki verisi.");
  if (input.layout.desks.length === 0) throw new AdminCreateError("Krokide en az bir masa olmalı.");

  const updated = await prisma.classroom.update({
    where: { id: input.id },
    data: { layout: input.layout as unknown as Prisma.InputJsonValue },
  });
  return { id: updated.id, name: updated.name, layout: updated.layout as unknown as ClassroomLayout };
}

export async function deleteClassroom(id: string, institutionId: string): Promise<void> {
  const classroom = await prisma.classroom.findUnique({ where: { id } });
  if (!classroom || classroom.institutionId !== institutionId) throw new AdminCreateError("Sınıf bulunamadı.", 404);
  // ExamSeatAssignment.classroomId onDelete: Restrict — bu sınıfa ait geçmiş
  // bir sınav oturma kaydı varsa Postgres burada FK hatasıyla reddeder,
  // AdminCreateError'a çeviriyoruz ki UI net bir mesaj gösterebilsin.
  try {
    await prisma.classroom.delete({ where: { id } });
  } catch {
    throw new AdminCreateError("Bu sınıfa ait geçmiş sınav oturma kayıtları var, silinemez.", 409);
  }
}
