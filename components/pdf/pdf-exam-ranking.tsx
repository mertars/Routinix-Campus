import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Sıralama Listesi — kullanıcının paylaştığı gerçek "TYT Puan/İsim Sıralı
// Liste" örneğine yakın, ARTI kullanıcının ek isteği: alt-dersi olan
// dersler (Sosyal Bilimler, Fen Bilimleri) ÜÇ KATMANLI başlık alıyor —
// üstte DERS ADI (Fen Bilimleri) tüm alt-derslerinin genişliğine YAYILIR,
// ortada ALT-DERS ADI (Fizik/Kimya/Biyoloji), altta D/Y/B/N. Standalone
// bir ders (örn. Türkçe) için orta satır boş kalır (ders adı zaten üstte).
//
// Genişlikler FLEX değil SABİT (pt) — üç başlık satırının gövde
// hücreleriyle TAM hizalanması gerekiyor, flex'in yeniden dağıtımı bunu
// bozardı.
const COLORS = {
  text: "#1F2937",
  textMuted: "#6B7280",
  accentDark: "#065F46",
  accentSoft: "#ECFDF5",
  hairline: "#E5E7EB",
  headerBg: "#065F46",
  rowAlt: "#F9FAFB",
  gold: "#B45309",
};

const W = {
  no: 15,
  name: 78,
  branch: 24,
  dyb: 11,
  net: 16,
  totalDyb: 13,
  totalNet: 20,
  rank: 19,
  estimate: 32,
};
const groupColWidth = W.dyb * 3 + W.net; // D+Y+B+N

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, fontSize: 6, paddingBottom: 24, paddingTop: 0 },
  headerBand: { backgroundColor: COLORS.headerBg, paddingHorizontal: 18, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 7 },
  logoImage: { width: 22, height: 22, borderRadius: 5, objectFit: "contain", backgroundColor: "#FFFFFF" },
  logoFallback: { width: 22, height: 22, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold" },
  institutionName: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "bold", marginLeft: 6 },
  headerRight: { marginLeft: "auto", alignItems: "flex-end" },
  headerLabel: { color: "rgba(255,255,255,0.75)", fontSize: 6.3 },
  headerValue: { color: "#FFFFFF", fontSize: 7.5, fontWeight: "bold" },

  summaryBar: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 18, paddingVertical: 4, backgroundColor: COLORS.accentSoft, gap: 10 },
  summaryLabel: { fontSize: 5.2, color: COLORS.textMuted, textTransform: "uppercase" },
  summaryValue: { fontSize: 7.5, fontWeight: "bold", color: COLORS.text, marginTop: 0.5 },

  body: { paddingHorizontal: 18, paddingTop: 6 },
  table: { borderWidth: 0.5, borderColor: COLORS.hairline },

  parentHeadRow: { flexDirection: "row", backgroundColor: COLORS.accentDark },
  parentHeadCell: { color: "#FFFFFF", fontSize: 5.4, fontWeight: "bold", paddingVertical: 2, textAlign: "center", borderLeftWidth: 0.5, borderLeftColor: "rgba(255,255,255,0.3)" },
  subHeadRow: { flexDirection: "row", backgroundColor: "#0C8562" },
  subHeadCell: { color: "#FFFFFF", fontSize: 5, fontWeight: "bold", textAlign: "center", paddingVertical: 1.5, borderLeftWidth: 0.5, borderLeftColor: "rgba(255,255,255,0.25)" },
  dybHeadRow: { flexDirection: "row", backgroundColor: "#12A67B" },
  dybHeadCell: { color: "#FFFFFF", fontSize: 4.6, fontWeight: "bold", textAlign: "center", paddingVertical: 1.5, borderLeftWidth: 0.5, borderLeftColor: "rgba(255,255,255,0.2)" },

  bodyRow: { flexDirection: "row", borderTopWidth: 0.4, borderTopColor: COLORS.hairline },
  bodyRowAlt: { backgroundColor: COLORS.rowAlt },
  cellFixed: { fontSize: 5.3, paddingVertical: 2, textAlign: "center", color: COLORS.text },
  cellFixedLeft: { fontSize: 5.6, paddingVertical: 2, paddingLeft: 2, textAlign: "left", color: COLORS.text },
  cellMuted: { fontSize: 5.3, paddingVertical: 2, textAlign: "center", color: COLORS.textMuted },
  cellBold: { fontSize: 5.5, paddingVertical: 2, textAlign: "center", color: COLORS.text, fontWeight: "bold" },
  rankCell: { fontSize: 6, paddingVertical: 2, textAlign: "center", fontWeight: "bold" },

  footer: { position: "absolute", bottom: 10, left: 18, right: 18, textAlign: "center", fontSize: 5.5, color: COLORS.textMuted },
  pageTitleBand: { paddingHorizontal: 18, paddingTop: 5 },
  pageTitle: { fontSize: 7.5, fontWeight: "bold", color: COLORS.accentDark },
});

function t(v: string): string {
  return turkishSafe(v);
}

// Bir "ders grubu" — alt-dersi VARSA subColumns her biri kendi D/Y/B/N
// alan bir alt-ders adı listesi (örn. ["Fizik","Kimya","Biyoloji"]);
// standalone bir ders için subColumns = [""] (orta satır boş kalır, ders
// adı zaten üst satırda).
export type RankingParentGroup = { subject: string; subColumns: string[] };
export type RankingCell = { correct: number; wrong: number; blank: number; net: number } | null;
export type RankingStudentRow = {
  firstName: string;
  lastName: string;
  branchName: string;
  cells: RankingCell[]; // düzleştirilmiş, groups'un subColumns'larıyla AYNI sırada
  totalCorrect: number;
  totalWrong: number;
  totalBlank: number;
  totalNet: number;
  rank: number;
  branchRank: number;
  gradeRank: number;
  estimatedRanking: number | null;
};

function DataTable({ groups, rows, hasEstimate }: { groups: RankingParentGroup[]; rows: RankingStudentRow[]; hasEstimate: boolean }) {
  return (
    <View style={styles.table}>
      <View style={styles.parentHeadRow} fixed>
        <Text style={[styles.parentHeadCell, { width: W.no, borderLeftWidth: 0 }]}>{t("No")}</Text>
        <Text style={[styles.parentHeadCell, { width: W.name, textAlign: "left", paddingLeft: 2 }]}>{t("Adı Soyadı")}</Text>
        <Text style={[styles.parentHeadCell, { width: W.branch }]}>{t("Şb")}</Text>
        {groups.map((g, gi) => (
          <Text key={gi} style={[styles.parentHeadCell, { width: groupColWidth * g.subColumns.length }]}>
            {t(g.subject.toUpperCase())}
          </Text>
        ))}
        <Text style={[styles.parentHeadCell, { width: W.totalDyb * 3 + W.totalNet }]}>{t("TOPLAM")}</Text>
        <Text style={[styles.parentHeadCell, { width: W.rank * 3 }]}>{t("SIRALAMA")}</Text>
        {hasEstimate && <Text style={[styles.parentHeadCell, { width: W.estimate }]}>{t("TAHMİNİ")}</Text>}
      </View>

      <View style={styles.subHeadRow} fixed>
        <Text style={[styles.subHeadCell, { width: W.no, borderLeftWidth: 0 }]} />
        <Text style={[styles.subHeadCell, { width: W.name }]} />
        <Text style={[styles.subHeadCell, { width: W.branch }]} />
        {groups.map((g, gi) =>
          g.subColumns.map((label, li) => (
            <Text key={`${gi}-${li}`} style={[styles.subHeadCell, { width: groupColWidth }]}>
              {t(label.toUpperCase())}
            </Text>
          ))
        )}
        <Text style={[styles.subHeadCell, { width: W.totalDyb * 3 + W.totalNet }]} />
        <Text style={[styles.subHeadCell, { width: W.rank * 3 }]} />
        {hasEstimate && <Text style={[styles.subHeadCell, { width: W.estimate }]} />}
      </View>

      <View style={styles.dybHeadRow} fixed>
        <Text style={[styles.dybHeadCell, { width: W.no, borderLeftWidth: 0 }]} />
        <Text style={[styles.dybHeadCell, { width: W.name }]} />
        <Text style={[styles.dybHeadCell, { width: W.branch }]} />
        {groups.map((g, gi) =>
          g.subColumns.map((_, li) => (
            <View key={`${gi}-${li}`} style={{ flexDirection: "row" }}>
              <Text style={[styles.dybHeadCell, { width: W.dyb }]}>{t("D")}</Text>
              <Text style={[styles.dybHeadCell, { width: W.dyb }]}>{t("Y")}</Text>
              <Text style={[styles.dybHeadCell, { width: W.dyb }]}>{t("B")}</Text>
              <Text style={[styles.dybHeadCell, { width: W.net }]}>{t("N")}</Text>
            </View>
          ))
        )}
        <Text style={[styles.dybHeadCell, { width: W.totalDyb }]}>{t("D")}</Text>
        <Text style={[styles.dybHeadCell, { width: W.totalDyb }]}>{t("Y")}</Text>
        <Text style={[styles.dybHeadCell, { width: W.totalDyb }]}>{t("B")}</Text>
        <Text style={[styles.dybHeadCell, { width: W.totalNet }]}>{t("NET")}</Text>
        <Text style={[styles.dybHeadCell, { width: W.rank }]}>{t("Genel")}</Text>
        <Text style={[styles.dybHeadCell, { width: W.rank }]}>{t("Şube")}</Text>
        <Text style={[styles.dybHeadCell, { width: W.rank }]}>{t("Sınıf")}</Text>
        {hasEstimate && <Text style={[styles.dybHeadCell, { width: W.estimate }]} />}
      </View>

      {rows.map((r, i) => (
        <View key={`${r.firstName}-${r.lastName}-${i}`} style={[styles.bodyRow, ...(i % 2 === 1 ? [styles.bodyRowAlt] : [])]} wrap={false}>
          <Text style={[styles.cellMuted, { width: W.no }]}>{i + 1}</Text>
          <Text style={[styles.cellFixedLeft, { width: W.name }]}>
            {t(r.firstName)} {t(r.lastName)}
          </Text>
          <Text style={[styles.cellMuted, { width: W.branch }]}>{t(r.branchName)}</Text>
          {r.cells.map((c, ci) => (
            <View key={ci} style={{ flexDirection: "row" }}>
              <Text style={[styles.cellFixed, { width: W.dyb }]}>{c ? c.correct : "—"}</Text>
              <Text style={[styles.cellFixed, { width: W.dyb }]}>{c ? c.wrong : ""}</Text>
              <Text style={[styles.cellMuted, { width: W.dyb }]}>{c ? c.blank : ""}</Text>
              <Text style={[styles.cellBold, { width: W.net, color: COLORS.accentDark }]}>{c ? c.net : ""}</Text>
            </View>
          ))}
          <Text style={[styles.cellFixed, { width: W.totalDyb }]}>{r.totalCorrect}</Text>
          <Text style={[styles.cellFixed, { width: W.totalDyb }]}>{r.totalWrong}</Text>
          <Text style={[styles.cellMuted, { width: W.totalDyb }]}>{r.totalBlank}</Text>
          <Text style={[styles.cellBold, { width: W.totalNet, color: COLORS.accentDark, fontSize: 6.2 }]}>{r.totalNet}</Text>
          <Text style={[styles.rankCell, { width: W.rank, color: r.rank <= 3 ? COLORS.gold : COLORS.text }]}>{r.rank}</Text>
          <Text style={[styles.rankCell, { width: W.rank }]}>{r.branchRank}</Text>
          <Text style={[styles.rankCell, { width: W.rank }]}>{r.gradeRank}</Text>
          {hasEstimate && <Text style={[styles.cellMuted, { width: W.estimate }]}>{r.estimatedRanking?.toLocaleString("tr-TR") ?? "—"}</Text>}
        </View>
      ))}
    </View>
  );
}

export function PdfExamRanking({
  institutionName,
  logoUrl,
  examName,
  examDate,
  listTitle,
  groups,
  rows,
  hasEstimate,
}: {
  institutionName: string;
  logoUrl?: string | null;
  examName: string;
  examDate: string;
  listTitle: string;
  groups: RankingParentGroup[];
  rows: RankingStudentRow[];
  hasEstimate: boolean;
}) {
  const nets = rows.map((r) => r.totalNet);
  const avg = nets.length > 0 ? Math.round((nets.reduce((a, b) => a + b, 0) / nets.length) * 100) / 100 : 0;

  const byRank = [...rows].sort((a, b) => a.rank - b.rank);
  const byName = [...rows].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "tr"));

  const Header = ({ subtitle }: { subtitle: string }) => (
    <>
      <View style={styles.headerBand}>
        {logoUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image PDF çizim primitifi, alt kabul etmez
          <Image src={logoUrl} style={styles.logoImage} />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoFallbackText}>{t(institutionName).charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.institutionName}>{t(institutionName).toUpperCase()}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerLabel}>{t(examDate)}</Text>
          <Text style={styles.headerValue}>{t(examName)}</Text>
        </View>
      </View>
      <View style={styles.summaryBar}>
        <View>
          <Text style={styles.summaryLabel}>{t("Katılımcı")}</Text>
          <Text style={styles.summaryValue}>{rows.length}</Text>
        </View>
        <View>
          <Text style={styles.summaryLabel}>{t("Ortalama Net")}</Text>
          <Text style={styles.summaryValue}>{avg}</Text>
        </View>
        <View>
          <Text style={styles.summaryLabel}>{t("En Yüksek Net")}</Text>
          <Text style={styles.summaryValue}>{nets.length > 0 ? Math.max(...nets) : 0}</Text>
        </View>
      </View>
      <View style={styles.pageTitleBand}>
        <Text style={styles.pageTitle}>{t(`${listTitle.toUpperCase()} — ${subtitle.toUpperCase()}`)}</Text>
      </View>
    </>
  );

  return (
    <Document title={t(`${examName} - ${listTitle}`)}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <Header subtitle="Puan Sıralı Liste" />
        <View style={styles.body}>
          <DataTable groups={groups} rows={byRank} hasEstimate={hasEstimate} />
        </View>
        <Text style={styles.footer} fixed>
          {t("Routinix Kampüs — Ölçme Değerlendirme")} · {t(new Date().toLocaleDateString("tr-TR"))}
        </Text>
      </Page>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <Header subtitle="İsim Sıralı Liste" />
        <View style={styles.body}>
          <DataTable groups={groups} rows={byName} hasEstimate={hasEstimate} />
        </View>
        <Text style={styles.footer} fixed>
          {t("Routinix Kampüs — Ölçme Değerlendirme")}
        </Text>
      </Page>
    </Document>
  );
}
