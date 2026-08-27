import * as XLSX from "xlsx";
import { columnsFor, type ImportRole } from "./types";

const SAMPLE_STUDENT_ROW = ["12345678901", "Ayşe Yılmaz", "05559876543", "12-A VIP", "Mehmet Yılmaz", "05551234567", ""];
const SAMPLE_TEACHER_ROW = ["12345678901", "Ahmet Demir", "Matematik", "05551234567", "ahmet@ornek.com", "12-A VIP"];
const SAMPLE_BRANCH_ROW = ["12-A VIP", "12", "YKS", "Sayısal"];

const SHEET_NAME: Record<ImportRole, string> = { STUDENT: "Öğrenciler", TEACHER: "Öğretmenler", BRANCH: "Şubeler" };
const FILE_NAME: Record<ImportRole, string> = {
  STUDENT: "ogrenci-ice-aktarma-sablonu.xlsx",
  TEACHER: "ogretmen-ice-aktarma-sablonu.xlsx",
  BRANCH: "sube-ice-aktarma-sablonu.xlsx",
};

// Şablon, ÖĞRENCİ/ÖĞRETMEN içe aktarmada o an veritabanındaki GERÇEK şubeleri
// ikinci bir sayfada referans olarak listeler — kullanıcı "Şube" sütununa
// hangi ismi yazması gerektiğini uydurmak zorunda kalmaz (dry-run'da "şube
// bulunamadı" hatasını önler). ŞUBE içe aktarmada bu referans sayfası
// anlamsız (henüz oluşturulacak şubeler listeleniyor), bu yüzden atlanır.
export function downloadImportTemplate(role: ImportRole, branchNames: string[]) {
  const columns = columnsFor(role);
  const sample = role === "STUDENT" ? SAMPLE_STUDENT_ROW : role === "TEACHER" ? SAMPLE_TEACHER_ROW : SAMPLE_BRANCH_ROW;

  const dataSheet = XLSX.utils.aoa_to_sheet([[...columns], sample]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, SHEET_NAME[role]);

  if (role !== "BRANCH") {
    const branchSheet = XLSX.utils.aoa_to_sheet([["Geçerli Şube İsimleri"], ...branchNames.map((name) => [name])]);
    XLSX.utils.book_append_sheet(workbook, branchSheet, "Şubeler (Referans)");
  }

  XLSX.writeFile(workbook, FILE_NAME[role]);
}
