import * as XLSX from "xlsx";
import { columnsFor, type ImportRole } from "./types";

const SAMPLE_STUDENT_ROW = ["12345678901", "Ayşe Yılmaz", "12-A VIP", "Mehmet Yılmaz", "05551234567", ""];
const SAMPLE_TEACHER_ROW = ["12345678901", "Ahmet Demir", "Matematik", "05551234567", "ahmet@ornek.com", "12-A VIP"];

// Şablon, o an veritabanındaki GERÇEK şubeleri ikinci bir sayfada referans
// olarak listeler — kullanıcı "Şube" sütununa hangi ismi yazması gerektiğini
// uydurmak zorunda kalmaz (dry-run'da "şube bulunamadı" hatasını önler).
export function downloadImportTemplate(role: ImportRole, branchNames: string[]) {
  const columns = columnsFor(role);
  const sample = role === "STUDENT" ? SAMPLE_STUDENT_ROW : SAMPLE_TEACHER_ROW;

  const dataSheet = XLSX.utils.aoa_to_sheet([[...columns], sample]);
  const branchSheet = XLSX.utils.aoa_to_sheet([["Geçerli Şube İsimleri"], ...branchNames.map((name) => [name])]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, role === "STUDENT" ? "Öğrenciler" : "Öğretmenler");
  XLSX.utils.book_append_sheet(workbook, branchSheet, "Şubeler (Referans)");

  const filename = role === "STUDENT" ? "ogrenci-ice-aktarma-sablonu.xlsx" : "ogretmen-ice-aktarma-sablonu.xlsx";
  XLSX.writeFile(workbook, filename);
}
