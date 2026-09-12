import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Video Ders Merkezi — kullanıcı kararı (2026-09-03, ikinci geçiş): videolar
// kalıcı olarak YouTube'da barınıyor (bkz. lib/server/youtube.ts). Video
// akışında R2 SADECE GEÇİCİ bir aktarım tamponu: tarayıcı dosyayı buraya
// yükler, sunucu buradan okuyup YouTube'a aktarır, sonra R2'deki nesneyi
// SİLER (bkz. getObjectStream/deleteObject).
//
// ⚠️ 2026-09-13: Soru/materyal/gider EKİ görselleri (bkz. save-question-image.ts,
// save-teacher-material.ts, save-expense-attachment.ts) ESKİDEN yerel diske
// (public/uploads/...) yazıyordu — bu SADECE `next dev`'de çalışır. Vercel'in
// serverless fonksiyonları `/tmp` DIŞINDA salt-okunurdur VE `/tmp` bile
// çağrılar arasında paylaşılmaz/kalıcı değildir — üretimde bu yazmalar ya
// sessizce başarısız olur ya da hiç kalıcı olmaz. Bu üç yardımcı artık
// putObject/getPublicUrl ile BURADAKİ (kalıcı, herkese açık okunur) kovaya
// yazıyor — video akışından FARKLI olarak burada nesne SİLİNMİYOR (kalıcı).
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ortam değişkeni tanımlı değil — Video Ders Merkezi'nin geçici yükleme tamponu için gerekli.`);
  return value;
}

let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = requireEnv("R2_ACCOUNT_ID");
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    // R2 kova adını alt-domain olarak öne eklemeyi (virtual-hosted-style)
    // DESTEKLEMİYOR — Cloudflare'in kendisi path-style öneriyor.
    forcePathStyle: true,
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

export async function createUploadUrl(key: string, contentType: string): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({ Bucket: getBucketName(), Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: 600 });
}

// YouTube'a aktarım için nesneyi bir okuma akışı (stream) olarak döner —
// sunucu belleğine TAMAMEN yüklemeden (büyük videolarda bellek taşmasın
// diye) doğrudan YouTube'un yükleme ucuna akıtılır (bkz. uploadToYoutube).
export async function getObjectStream(key: string): Promise<{ body: ReadableStream; contentLength: number; contentType: string }> {
  const client = getR2Client();
  const result = await client.send(new GetObjectCommand({ Bucket: getBucketName(), Key: key }));
  if (!result.Body) throw new Error("R2 nesnesi okunamadı (boş gövde).");
  return {
    body: result.Body.transformToWebStream(),
    contentLength: result.ContentLength ?? 0,
    contentType: result.ContentType ?? "application/octet-stream",
  };
}

export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }));
}

// Kalıcı, herkese açık okunur nesneler için (soru/materyal/gider eki
// görselleri) — sunucu tarafında doğrudan yazar, ön uç presign akışına
// gerek yok (dosyalar zaten sunucuya multipart/form-data ile geliyor).
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const client = getR2Client();
  await client.send(new PutObjectCommand({ Bucket: getBucketName(), Key: key, Body: body, ContentType: contentType }));
}

// R2_PUBLIC_URL kovanın herkese açık r2.dev (veya bağlı özel alan adı)
// tabanıdır — çağıran kod bunu DB'ye tam URL olarak yazar, sonradan silmek
// için publicUrlToKey ile geri çevrilir.
export function getPublicUrl(key: string): string {
  const base = requireEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
  return `${base}/${key}`;
}

// Bir R2 public URL'sinden anahtarı geri çıkarır — DELETE uçlarının
// DB'de sakladığı tam URL'den hangi nesneyi sileceğini bulması için.
// Taban eşleşmezse null döner (ör. eski/yerel bir yol, ya da başka kaynak).
export function publicUrlToKey(url: string): string | null {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  if (!base || !url.startsWith(`${base}/`)) return null;
  return url.slice(base.length + 1);
}
