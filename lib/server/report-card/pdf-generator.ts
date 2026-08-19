import puppeteer from "puppeteer";

// HTML string'i A4 vektörel PDF Buffer'ına çevirir. Her çağrıda tarayıcıyı
// açıp kapatıyoruz (basitlik için) — yüksek hacimli üretimde bir tarayıcı
// örneğini süreç boyunca açık tutup sekme bazlı paylaşmak daha performanslı
// olur; ihtiyaç olursa bu fonksiyon bir 'BrowserPool' ile değiştirilebilir.
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    // HTML tamamen kendi içinde (harici görsel/font isteği yok), bu yüzden
    // 'load' yeterli — 'networkidle0/2', setContent() için desteklenmiyor.
    await page.setContent(html, { waitUntil: "load" });
    const pdfData = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdfData);
  } finally {
    await browser.close();
  }
}
