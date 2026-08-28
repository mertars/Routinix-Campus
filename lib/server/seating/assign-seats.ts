import type { Desk } from "@/lib/seating/types";

export type SeatStudentInput = { id: string; name: string };
export type SeatBranchInput = { branchId: string; branchName: string; students: SeatStudentInput[] };

export type SeatAssignmentRow = {
  deskId: string;
  seatIndex: number;
  studentId: string;
  studentName: string;
  branchId: string;
  branchName: string;
  seatNumber: number;
  rowNum: number;
  colNum: number;
};

export type SeatViolation = { deskAId: string; deskBId: string; branchName: string };

export type SeatAssignmentResult = {
  assignments: SeatAssignmentRow[];
  violations: SeatViolation[];
  unseated: { id: string; name: string; branchName: string }[];
};

// Bu mesafenin (kroki birimi, editördeki px ile aynı ölçek) altındaki iki
// masa "komşu" sayılır — yan yana/arka arkaya kuralı bu eşiğe göre işler.
const NEIGHBOR_DISTANCE_THRESHOLD = 220;
const DISPLAY_COLS = 6; // öğrenci tarafının eski rowNum/colNum sözleşmesi için geriye dönük türetme

function euclidean(a: Desk, b: Desk): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildNeighborMap(desks: Desk[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const d of desks) {
    map.set(
      d.id,
      desks.filter((other) => other.id !== d.id && euclidean(d, other) <= NEIGHBOR_DISTANCE_THRESHOLD).map((n) => n.id)
    );
  }
  return map;
}

// Şubeler arasında sırayla dolaşarak (round-robin) öğrenci sırasını
// karıştırır — aynı şubeden iki öğrenci ardışık gelmesin diye, mevcut
// (eski) algoritmanın da yaptığı temel karıştırma; asıl "kelebek kuralı"
// denetimi aşağıdaki koltuk seçiminde (masa/komşu masa bazlı) yapılır.
function interleaveByBranch(branches: SeatBranchInput[]): (SeatStudentInput & { branchId: string; branchName: string })[] {
  const queues = branches.map((b) => [...b.students]);
  const ordered: (SeatStudentInput & { branchId: string; branchName: string })[] = [];
  let remaining = queues.some((q) => q.length > 0);
  while (remaining) {
    queues.forEach((queue, index) => {
      const student = queue.shift();
      if (student) ordered.push({ ...student, branchId: branches[index].branchId, branchName: branches[index].branchName });
    });
    remaining = queues.some((q) => q.length > 0);
  }
  return ordered;
}

// Verilen kroki (masalar) ve şube bazlı öğrenci listesinden bir koltuk
// planı üretir. BEST-EFFORT'tur — mükemmel (sıfır ihlalli) bir çözüm HER
// zaman garanti edilemez (örn. bir şube diğerlerinden çok daha kalabalıksa
// ya da masa sayısı çok azsa); böyle durumlarda mümkün olan en iyi
// yerleşim seçilir ve kaçınılmaz ihlaller `violations` içinde açıkça
// raporlanır — çağıran taraf (bkz. app/api/admin/exam-seating/route.ts)
// bunları admin'e göstermeli, sessizce yutmamalı.
export function assignSeats(desks: Desk[], branches: SeatBranchInput[]): SeatAssignmentResult {
  const neighborMap = buildNeighborMap(desks);
  const orderedStudents = interleaveByBranch(branches);

  const sortedDesks = [...desks].sort((a, b) => a.y - b.y || a.x - b.x);
  const slots: { deskId: string; seatIndex: number }[] = [];
  for (const desk of sortedDesks) {
    for (let seatIndex = 0; seatIndex < desk.seatCount; seatIndex++) slots.push({ deskId: desk.id, seatIndex });
  }

  const branchesAtDesk = new Map<string, Set<string>>();
  function branchesNear(deskId: string): Set<string> {
    const result = new Set<string>(branchesAtDesk.get(deskId) ?? []);
    for (const neighborId of neighborMap.get(deskId) ?? []) {
      for (const b of branchesAtDesk.get(neighborId) ?? []) result.add(b);
    }
    return result;
  }

  const assignments: SeatAssignmentRow[] = [];
  const violations: SeatViolation[] = [];
  const unseated: SeatAssignmentResult["unseated"] = [];
  const usedSlotIndexes = new Set<number>();
  let seatNumber = 1;

  for (const student of orderedStudents) {
    let chosenSlotIndex = -1;
    let fallbackSlotIndex = -1;
    for (let i = 0; i < slots.length; i++) {
      if (usedSlotIndexes.has(i)) continue;
      if (fallbackSlotIndex === -1) fallbackSlotIndex = i;
      if (!branchesNear(slots[i].deskId).has(student.branchId)) {
        chosenSlotIndex = i;
        break;
      }
    }
    if (chosenSlotIndex === -1) chosenSlotIndex = fallbackSlotIndex;
    if (chosenSlotIndex === -1) {
      unseated.push({ id: student.id, name: student.name, branchName: student.branchName });
      continue;
    }

    usedSlotIndexes.add(chosenSlotIndex);
    const slot = slots[chosenSlotIndex];
    const deskBranches = branchesAtDesk.get(slot.deskId) ?? new Set<string>();
    deskBranches.add(student.branchId);
    branchesAtDesk.set(slot.deskId, deskBranches);

    assignments.push({
      deskId: slot.deskId,
      seatIndex: slot.seatIndex,
      studentId: student.id,
      studentName: student.name,
      branchId: student.branchId,
      branchName: student.branchName,
      seatNumber,
      rowNum: Math.floor((seatNumber - 1) / DISPLAY_COLS) + 1,
      colNum: ((seatNumber - 1) % DISPLAY_COLS) + 1,
    });
    seatNumber++;
  }

  // ⚠️ İhlaller yerleştirme SIRASINDA artımlı olarak değil, TÜM atamalar
  // bittikten SONRA tek seferde, tüm masa çiftleri taranarak hesaplanır.
  // İlk sürüm yerleştirme anında "bu öğrenci için İLK bulunan çakışmayı"
  // logluyordu — bir masanın/komşusunun birden fazla çakışması olduğunda
  // bazılarını sessizce atlıyordu (canlı testte yakalandı: aşırı dengesiz
  // bir dağılımda gerçek ihlal sayısından belirgin düşük bir sayı
  // raporlanıyordu). Buradaki tam tarama, bağımsız bir doğrulayıcıyla
  // birebir eşleşen, dürüst bir sayım garantiler.
  const assignmentsByDesk = new Map<string, SeatAssignmentRow[]>();
  for (const a of assignments) {
    const arr = assignmentsByDesk.get(a.deskId) ?? [];
    arr.push(a);
    assignmentsByDesk.set(a.deskId, arr);
  }
  const deskIds = [...assignmentsByDesk.keys()];
  for (let i = 0; i < deskIds.length; i++) {
    const seatsA = assignmentsByDesk.get(deskIds[i])!;
    const branchesA = new Set(seatsA.map((s) => s.branchId));
    // Aynı masa içi çift/üçlü çakışma.
    for (const branchId of branchesA) {
      const sameHere = seatsA.filter((s) => s.branchId === branchId);
      if (sameHere.length > 1) violations.push({ deskAId: deskIds[i], deskBId: deskIds[i], branchName: sameHere[0].branchName });
    }
    // Komşu masa çakışması — her çift bir kez sayılsın diye j > i.
    for (let j = i + 1; j < deskIds.length; j++) {
      if (!(neighborMap.get(deskIds[i]) ?? []).includes(deskIds[j])) continue;
      const seatsB = assignmentsByDesk.get(deskIds[j])!;
      for (const branchId of branchesA) {
        const match = seatsB.find((s) => s.branchId === branchId);
        if (match) violations.push({ deskAId: deskIds[i], deskBId: deskIds[j], branchName: match.branchName });
      }
    }
  }

  return { assignments, violations, unseated };
}
