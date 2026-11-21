import { useCallback, useEffect, useRef, useState } from "react";
import { createIdempotencyKey, uploadBytes } from "@/api/http";
import { getErrorMessage } from "@/api/errors";
import { createUpload, finalizeUpload, useInvalidateAssetList } from "../api";

const CONCURRENCY = 3;

/**
 * Yükleme kuyruğu (şartname §8.1, §8.2: kullanıcı başına 3 eşzamanlı yükleme). Her dosya üç adımdan geçer:
 * yükleme niyeti (tür, boyut, kota denetimi) → baytların gönderilmesi (ilerleme) → tamamlama (sunucu doğrulaması).
 * Sonuç dosya "processing", "ready" veya "rejected" olur; hata açıklaması ve tekrar deneme sunulur (AT-59).
 */
export const useUploadQueue = (siteId, { folderId = null, onUploaded } = {}) => {
  const [items, setItems] = useState([]);
  const active = useRef(0);
  const invalidate = useInvalidateAssetList(siteId);
  const onUploadedRef = useRef(onUploaded);

  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);

  const patch = useCallback((id, values) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...values } : item))), []);

  const run = useCallback(async (item) => {
    active.current += 1;
    try {
      patch(item.id, { status: "uploading", progress: 0, error: null });
      const upload = await createUpload(siteId, { fileName: item.file.name, size: item.file.size, mimeType: item.file.type || undefined, folderId: item.folderId }, item.idempotencyKey);
      await uploadBytes(upload.uploadUrl, item.file, { method: upload.method, onProgress: (progress) => patch(item.id, { progress }) });
      patch(item.id, { status: "finalizing" });
      const asset = await finalizeUpload(siteId, upload.uploadId);
      patch(item.id, { status: asset.status === "rejected" ? "rejected" : "done", asset, error: asset.status === "rejected" ? asset.rejectReason?.message : null });
      if (asset.status !== "rejected") onUploadedRef.current?.(asset);
    } catch (error) {
      patch(item.id, { status: "error", error: getErrorMessage(error, "Yükleme tamamlanamadı.") });
    } finally {
      active.current -= 1;
      invalidate();
    }
  }, [invalidate, patch, siteId]);

  // Sıradaki dosyalar boş yer açıldıkça başlatılır.
  useEffect(() => {
    const waiting = items.filter((item) => item.status === "queued");
    const free = CONCURRENCY - active.current;
    waiting.slice(0, Math.max(0, free)).forEach((item) => {
      patch(item.id, { status: "starting" });
      run(item);
    });
  }, [items, patch, run]);

  const add = useCallback((files) => {
    setItems((current) => [...current, ...Array.from(files).map((file) => ({ id: crypto.randomUUID(), file, folderId, status: "queued", progress: 0, error: null, asset: null, idempotencyKey: createIdempotencyKey() }))]);
  }, [folderId]);

  const retry = useCallback((id) => patch(id, { status: "queued", progress: 0, error: null, idempotencyKey: createIdempotencyKey() }), [patch]);

  const clearFinished = useCallback(() => setItems((current) => current.filter((item) => !["done", "rejected"].includes(item.status))), []);

  return { items, add, retry, clearFinished, busy: items.some((item) => ["queued", "starting", "uploading", "finalizing"].includes(item.status)) };
};
