import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

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

export async function createPresignedUploadUrl(
  folder: string,
  contentType: string,
): Promise<{ uploadURL: string; publicFileUrl: string; key: string }> {
  const { R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
  if (!R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error("R2_BUCKET_NAME or R2_PUBLIC_URL not configured");
  }

  const client = createR2Client();
  const ext = contentType === "image/png" ? "png" : "jpg";
  const key = `${folder}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadURL = await getSignedUrl(client, command, { expiresIn: 900 });
  const base = R2_PUBLIC_URL.replace(/\/$/, "");
  return { uploadURL, publicFileUrl: `${base}/${key}`, key };
}

export async function uploadFileToR2(
  folder: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const { R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
  if (!R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error("R2_BUCKET_NAME or R2_PUBLIC_URL not configured");
  }

  const client = createR2Client();
  const ext = contentType === "image/png" ? "png" : "jpg";
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
  return `${base}/${key}`;
}
