import { getAppDb } from "../db/appDb";
import type { ImageAsset } from "../db/appDb";

async function loadImageDimensions(blob: Blob) {
  const imageUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
      element.src = imageUrl;
    });
    return { width: image.naturalWidth || 0, height: image.naturalHeight || 0 };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function createThumbnailBlob(blob: Blob) {
  const imageUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("サムネイルの生成に失敗しました。"));
      element.src = imageUrl;
    });

    const maxSide = 480;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("サムネイル用キャンバスを初期化できませんでした。");
    }
    context.drawImage(image, 0, 0, width, height);

    const output = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("サムネイルの書き出しに失敗しました。"));
        }
      }, blob.type || "image/jpeg", 0.82);
    });

    return { blob: output, width, height };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function saveObservationImages(files: File[], sourceObservationId: string) {
  const database = await getAppDb();
  const now = new Date().toISOString();
  const originalIds: string[] = [];
  const thumbnails: ImageAsset[] = [];

  for (const file of files) {
    const originalId = crypto.randomUUID();
    const dimensions = await loadImageDimensions(file);
    const originalRecord: ImageAsset = {
      id: originalId,
      kind: "original",
      blob: file,
      mimeType: file.type || "application/octet-stream",
      width: dimensions.width,
      height: dimensions.height,
      byteSize: file.size,
      sourceObservationId,
      createdAt: now,
    };
    originalIds.push(originalId);
    await database.put("images", originalRecord);

    const thumbnailId = crypto.randomUUID();
    const thumbnail = await createThumbnailBlob(file);
    thumbnails.push({
      id: thumbnailId,
      kind: "thumbnail",
      blob: thumbnail.blob,
      mimeType: thumbnail.blob.type || "image/jpeg",
      width: thumbnail.width,
      height: thumbnail.height,
      byteSize: thumbnail.blob.size,
      sourceObservationId,
      createdAt: now,
    });
  }

  for (const thumbnail of thumbnails) {
    await database.put("images", thumbnail);
  }

  return {
    originalIds,
  };
}

export async function loadImagesForObservation(sourceObservationId: string) {
  const database = await getAppDb();
  return database.getAllFromIndex("images", "by-sourceObservationId", sourceObservationId);
}

export async function loadImageAsset(imageId: string) {
  const database = await getAppDb();
  return database.get("images", imageId);
}

export async function loadAnalysisImagesForObservation(sourceObservationId: string) {
  const records = await loadImagesForObservation(sourceObservationId);
  const thumbnails = records.filter((record) => record.kind === "thumbnail");
  return thumbnails.length > 0 ? thumbnails : records.filter((record) => record.kind === "original");
}

export async function deleteImagesForObservation(sourceObservationId: string) {
  const database = await getAppDb();
  const records = await loadImagesForObservation(sourceObservationId);
  await Promise.all(records.map((record) => database.delete("images", record.id)));
}
