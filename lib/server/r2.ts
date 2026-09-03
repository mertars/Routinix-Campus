import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Video Ders Merkezi — kullanıcı kararı (2026-09-03): video dosyaları
// Cloudflare R2'de tutulur (S3-uyumlu API, ama depolama ücretsiz katmanla
// başlar ve trafik/izlenme HER ZAMAN ücretsiz — kullanıcıyla yapılan
// maliyet analizinin sonucu). Bu modül R2'ye özgü BEŞ ortam değişkeni
// gerektirir — hiçbiri lib/server/env.ts'in boot-anı doğrulamasına
// EKLENMEDİ (AUTH_SECRET/CRON_SECRET gibi HER istekte gerekmiyor, sadece
// video yükleme/silme uçlarında) — eksikse o uçlar net bir hatayla
// başarısız olur, uygulamanın geri kalanı ETKİLENMEZ.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ortam değişkeni tanımlı değil — Video Ders Merkezi'nin R2 depolamasını kullanabilmesi için .env.local'e eklenmeli.`);
  return value;
}

let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = requireEnv("R2_ACCOUNT_ID");
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cachedClient;
}

function getBucketName(): string {
  return requireEnv("R2_BUCKET_NAME");
}

// Tarayıcının DOĞRUDAN (bizim sunucumuzdan geçmeden) yükleyebileceği,
// kısa ömürlü (10 dk) bir imzalı PUT URL'i üretir — büyük video
// dosyalarını bir Vercel serverless fonksiyonunun gövde/süre sınırlarından
// geçirmemek için (bkz. video-upload API route'unun kendi notu).
export async function createUploadUrl(key: string, contentType: string): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({ Bucket: getBucketName(), Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: 600 });
}

export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }));
}

// R2_PUBLIC_URL — kovanın herkese açık taban adresi (özel bir domain
// (önerilir) ya da r2.dev'in verdiği geçici herkese açık URL). Sonuna
// sadece nesne anahtarı ekleniyor — R2 trafiği ücretsiz olduğu için burada
// imzalı bir "indirme" URL'i GEREKMEZ, doğrudan herkese açık okuma yeterli.
export function r2PublicUrl(key: string): string {
  const base = requireEnv("R2_PUBLIC_URL").replace(/\/$/, "");
  return `${base}/${key}`;
}
