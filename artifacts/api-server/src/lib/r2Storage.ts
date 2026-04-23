import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import type { Readable } from "stream";

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}

function createR2Client(): S3Client {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

function mimeToExt(contentType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return map[contentType] ?? "bin";
}

export async function createPresignedUploadUrl(
  folder: string,
  contentType: string,
  contentLength?: number,
): Promise<{ uploadURL: string; publicFileUrl: string; key: string }> {
  const { R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
  if (!R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error("R2_BUCKET_NAME or R2_PUBLIC_URL not configured");
  }

  const client = createR2Client();
  const ext = mimeToExt(contentType);
  const key = `${folder}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ...(typeof contentLength === "number" ? { ContentLength: contentLength } : {}),
  });

  const uploadURL = await getSignedUrl(client, command, {
    expiresIn: 900,
    ...(typeof contentLength === "number" ? { signableHeaders: new Set(["content-length"]) } : {}),
  });
  const base = R2_PUBLIC_URL.replace(/\/$/, "");
  return { uploadURL, publicFileUrl: `${base}/${key}`, key };
}

export async function uploadFileToR2(
  folder: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const { R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
  if (!R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error("R2_BUCKET_NAME or R2_PUBLIC_URL not configured");
  }

  const client = createR2Client();
  const ext = mimeToExt(contentType);
  const key = `${folder}/${randomUUID()}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    }),
  );

  const base = R2_PUBLIC_URL.replace(/\/$/, "");
  return { url: `${base}/${key}`, key };
}

export async function uploadStreamToR2(
  folder: string,
  contentType: string,
  stream: Readable,
  contentLength?: number,
): Promise<{ url: string; key: string }> {
  const { R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
  if (!R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error("R2_BUCKET_NAME or R2_PUBLIC_URL not configured");
  }

  const client = createR2Client();
  const ext = mimeToExt(contentType);
  const key = `${folder}/${randomUUID()}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: stream,
      ContentType: contentType,
      ...(typeof contentLength === "number" && contentLength > 0 ? { ContentLength: contentLength } : {}),
    }),
  );

  const base = R2_PUBLIC_URL.replace(/\/$/, "");
  return { url: `${base}/${key}`, key };
}

export async function deleteFileFromR2(key: string): Promise<void> {
  const { R2_BUCKET_NAME } = process.env;
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME not configured");
  }
  const client = createR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );
}

/**
 * Downloads an external image and stores it in R2 under the given key.
 * If the key already exists in R2, returns the existing public URL immediately (no re-download).
 * Returns the R2 public URL on success, or null on any failure (caller should use original URL as fallback).
 */
export async function cacheExternalImage(
  sourceUrl: string,
  r2Key: string,
): Promise<string | null> {
  if (!isR2Configured()) return null;
  const { R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
  if (!R2_BUCKET_NAME || !R2_PUBLIC_URL) return null;

  const base = R2_PUBLIC_URL.replace(/\/$/, "");
  const r2Url = `${base}/${r2Key}`;
  const client = createR2Client();

  try {
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key }));
    return r2Url;
  } catch {
    // Key does not exist yet — fall through to download
  }

  try {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) return null;

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: buffer,
        ContentType: contentType,
        ContentLength: buffer.length,
      }),
    );
    return r2Url;
  } catch (err) {
    console.error(`[r2Cache] Failed to cache ${sourceUrl} → ${r2Key}:`, err);
    return null;
  }
}
