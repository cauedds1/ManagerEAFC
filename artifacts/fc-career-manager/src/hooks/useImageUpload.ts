import { useState, useRef } from "react";

export interface ImageUploadState {
  previewUrl: string | null;
  objectPath: string | null;
  isUploading: boolean;
  error: string | null;
  pendingFile: { file: File; localUrl: string } | null;
}

export interface UseImageUploadReturn extends ImageUploadState {
  inputRef: React.RefObject<HTMLInputElement | null>;
  openPicker: () => void;
  handleFileSelect: (file: File) => void;
  confirmCrop: (croppedBlob: Blob, croppedPreviewUrl: string) => Promise<void>;
  cancelCrop: () => void;
  reset: () => void;
}

export function useImageUpload(): UseImageUploadReturn {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [objectPath, setObjectPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{ file: File; localUrl: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => inputRef.current?.click();

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Apenas imagens são permitidas.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 10 MB.");
      return;
    }
    setError(null);
    setObjectPath(null);
    setPreviewUrl(null);
    setPendingFile({ file, localUrl: URL.createObjectURL(file) });
  };

  const confirmCrop = async (croppedBlob: Blob, croppedPreviewUrl: string) => {
    setPendingFile(null);
    setPreviewUrl(croppedPreviewUrl);
    setIsUploading(true);
    setError(null);
    try {
      const fileName = pendingFile?.file.name ?? "image.jpg";
      const res = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fileName, size: croppedBlob.size, contentType: "image/jpeg" }),
      });
      if (!res.ok) throw new Error("Falha ao obter URL de upload");
      const { uploadURL, objectPath: path } = (await res.json()) as { uploadURL: string; objectPath: string };
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: croppedBlob,
      });
      if (!putRes.ok) throw new Error("Falha no upload da imagem");
      setObjectPath(path);
    } catch {
      setError("Erro no upload da imagem. Tente novamente.");
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const cancelCrop = () => {
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const reset = () => {
    setPreviewUrl(null);
    setObjectPath(null);
    setError(null);
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return {
    previewUrl,
    objectPath,
    isUploading,
    error,
    pendingFile,
    inputRef,
    openPicker,
    handleFileSelect,
    confirmCrop,
    cancelCrop,
    reset,
  };
}
