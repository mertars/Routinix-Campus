import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Video Ders Merkezi — kullanıcı kararı (2026-09-03, ikinci geçiş): videolar
// kalıcı olarak YouTube'da barınıyor (bkz. lib/server/youtube.ts). R2 artık
// SADECE GEÇİCİ bir aktarım tamponu: tarayıcı dosyayı buraya yükler, sunucu
// buradan okuyup YouTube'a aktarır, sonra R2'deki nesneyi SİLER — kalıcı
// depolama/oynatma YOK, sadece "tarayıcıdan sunucuya büyük dosya geçirmenin"
// pratik yolu (Vercel fonksiyonlarının gövde boyutu sınırlarına takılmadan).
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
