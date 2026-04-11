import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { isR2Configured, createPresignedUploadUrl, uploadFileToR2 } from "../lib/r2Storage";

const router: IRouter = Router();

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_FOLDERS = new Set(["portals", "portal-photos", "uploads", "noticias", "test"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
    }
  },
});

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  if (!isR2Configured()) {
    res.status(503).json({ error: "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e R2_PUBLIC_URL precisam estar configurados." });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const folder = (req.query.folder as string | undefined) ?? "uploads";
    const { uploadURL, publicFileUrl } = await createPresignedUploadUrl(folder, contentType ?? "image/jpeg");

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath: publicFileUrl,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating R2 upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.post("/storage/uploads/file", (req: Request, res: Response) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message ?? "Erro no upload." });
      return;
    }

    if (!isR2Configured()) {
      res.status(503).json({ error: "R2 não está configurado." });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Nenhum arquivo enviado." });
      return;
    }

    const rawFolder = (req.query.folder as string | undefined) ?? "uploads";
    const folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : "uploads";

    try {
      const url = await uploadFileToR2(folder, file.buffer, file.mimetype);
      res.json({ url });
    } catch (error) {
      req.log.error({ err: error }, "Error uploading file to R2");
      res.status(500).json({ error: "Falha ao fazer upload do arquivo." });
    }
  });
});

export default router;
