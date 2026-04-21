import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { isR2Configured, createPresignedUploadUrl, uploadFileToR2, uploadStreamToR2, deleteFileFromR2 } from "../lib/r2Storage";
import { requireAuth, extractUserIdFromToken, type AuthRequest } from "../middleware/auth";
import { getUserPlanFromDb, MOMENTOS_MAX_SIZE_BYTES } from "../lib/planLimits";

const router: IRouter = Router();

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const ALLOWED_PRESIGNED_MIME_TYPES = new Set([
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
]);

const ALLOWED_FOLDERS = new Set(["portals", "portal-photos", "uploads", "noticias", "test"]);
const ALLOWED_PRESIGNED_FOLDERS = new Set([
  ...ALLOWED_FOLDERS,
  "momentos",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
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

  const { name, size, contentType } = parsed.data;

  if (contentType && !ALLOWED_PRESIGNED_MIME_TYPES.has(contentType)) {
    res.status(400).json({ error: `Tipo de arquivo não permitido: ${contentType}` });
    return;
  }

  const rawFolder = (req.query.folder as string | undefined) ?? "uploads";

  let folder: string;

  if (rawFolder === "momentos" || rawFolder === "noticias-video") {
    const userId = extractUserIdFromToken(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ error: "Autenticação necessária para upload nesta pasta." });
      return;
    }
    let plan: import("../lib/planLimits").Plan;
    try {
      plan = await getUserPlanFromDb(userId);
    } catch (err) {
      req.log.error({ err }, "Error fetching user plan from DB");
      res.status(500).json({ error: "Erro ao verificar plano do usuário." });
      return;
    }
    if (rawFolder === "noticias-video") {
      if (plan !== "ultra") {
        res.status(403).json({ error: "Upload de vídeos em notícias está disponível apenas no plano Ultra." });
        return;
      }
    }
    if (rawFolder === "momentos") {
      if (typeof size !== "number") {
        res.status(400).json({ error: "O campo 'size' é obrigatório para uploads em Momentos." });
        return;
      }
      const maxBytes = MOMENTOS_MAX_SIZE_BYTES[plan];
      if (maxBytes === 0) {
        res.status(403).json({ error: "Upload de vídeos em Momentos não está disponível no plano Free." });
        return;
      }
      if (size > maxBytes) {
        const maxMB = maxBytes / (1024 * 1024);
        res.status(403).json({ error: `Tamanho máximo permitido no seu plano é ${maxMB} MB.` });
        return;
      }
    }
    folder = `${rawFolder}/${userId}`;
  } else {
    folder = ALLOWED_PRESIGNED_FOLDERS.has(rawFolder) ? rawFolder : "uploads";
  }

  const signedContentLength =
    (rawFolder === "momentos" && typeof size === "number") ? size : undefined;

  try {
    const { uploadURL, publicFileUrl, key } = await createPresignedUploadUrl(folder, contentType ?? "image/jpeg", signedContentLength);

    const baseResponse = RequestUploadUrlResponse.parse({
      uploadURL,
      objectPath: publicFileUrl,
      metadata: { name, size, contentType },
    });

    res.json({ ...baseResponse, key });
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

const ALLOWED_VIDEO_MIME_TYPES_SET = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const ALLOWED_VIDEO_FOLDERS = new Set(["momentos", "noticias-video"]);

router.post("/storage/uploads/video", async (req: Request, res: Response) => {
  if (!isR2Configured()) {
    res.status(503).json({ error: "Armazenamento não configurado." });
    return;
  }

  const userId = extractUserIdFromToken(req.headers.authorization);
  if (!userId) {
    res.status(401).json({ error: "Autenticação necessária." });
    return;
  }

  const rawFolder = (req.query.folder as string | undefined) ?? "momentos";
  if (!ALLOWED_VIDEO_FOLDERS.has(rawFolder)) {
    res.status(400).json({ error: "Pasta não permitida para upload de vídeo." });
    return;
  }

  const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim();
  if (!ALLOWED_VIDEO_MIME_TYPES_SET.has(contentType)) {
    res.status(400).json({ error: `Tipo de arquivo não suportado: ${contentType}. Use MP4, WebM ou MOV.` });
    return;
  }

  const contentLength = req.headers["content-length"] ? Number(req.headers["content-length"]) : undefined;

  let plan: import("../lib/planLimits").Plan;
  try {
    plan = await getUserPlanFromDb(userId);
  } catch (err) {
    req.log.error({ err }, "Error fetching user plan");
    res.status(500).json({ error: "Erro ao verificar plano do usuário." });
    return;
  }

  if (rawFolder === "noticias-video" && plan !== "ultra") {
    res.status(403).json({ error: "Upload de vídeos em notícias está disponível apenas no plano Ultra." });
    return;
  }

  if (rawFolder === "momentos") {
    const maxBytes = MOMENTOS_MAX_SIZE_BYTES[plan];
    if (maxBytes === 0) {
      res.status(403).json({ error: "Upload de vídeos em Momentos não está disponível no plano Free." });
      return;
    }
    if (typeof contentLength === "number" && contentLength > maxBytes) {
      const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
      res.status(403).json({ error: `Tamanho máximo permitido no seu plano é ${maxMB} MB.` });
      return;
    }
  }

  const folder = `${rawFolder}/${userId}`;

  try {
    const { url, key } = await uploadStreamToR2(folder, contentType, req, contentLength);
    res.json({ url, key });
  } catch (err) {
    req.log.error({ err }, "Error streaming video to R2");
    res.status(500).json({ error: "Falha no upload do vídeo. Tente novamente." });
  }
});

router.delete("/storage/objects", requireAuth, async (req: AuthRequest, res: Response) => {
  if (!isR2Configured()) {
    res.status(503).json({ error: "R2 não está configurado." });
    return;
  }

  const key = (req.query.key as string | undefined);
  if (!key) {
    res.status(400).json({ error: "Parâmetro 'key' é obrigatório." });
    return;
  }

  const parts = key.split("/");
  const folder = parts[0];

  const deletableFolders = new Set(["momentos", "noticias-video"]);
  if (!deletableFolders.has(folder)) {
    res.status(403).json({ error: "Esta rota só permite exclusão de arquivos de momentos e notícias." });
    return;
  }

  const keyUserId = parts[1] ? parseInt(parts[1], 10) : NaN;
  if (isNaN(keyUserId) || keyUserId !== req.user?.id) {
    res.status(403).json({ error: "Acesso negado: arquivo não pertence ao usuário autenticado." });
    return;
  }

  try {
    await deleteFileFromR2(key);
    res.json({ success: true });
  } catch (error) {
    req.log.error({ err: error }, "Error deleting file from R2");
    res.status(500).json({ error: "Falha ao excluir arquivo." });
  }
});

export default router;
