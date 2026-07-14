import { downloadBlob } from "@/utils/blobDownload";

function normalizePngFileName(fileName: string) {
  const trimmed = fileName.trim().replace(/[\\/:*?"<>|]/g, "_");
  const safeName = trimmed || "merchmemo.png";

  return /\.png$/i.test(safeName) ? safeName : `${safeName}.png`;
}

async function createDownloadableImageBlob(pngBlob: Blob) {
  return new Blob([await pngBlob.arrayBuffer()], {
    type: "application/octet-stream",
  });
}

export const handleImageSave = async (blob: Blob, fileName: string) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Image download must run in a browser.");
  }

  const normalizedFileName = normalizePngFileName(fileName);
  const pngBlob =
    blob.type === "image/png" ? blob : blob.slice(0, blob.size, "image/png");
  const downloadableBlob = await createDownloadableImageBlob(pngBlob);

  if (process.env.NODE_ENV !== "production") {
    console.debug("[image-download]", {
      originalType: pngBlob.type,
      originalSize: pngBlob.size,
      downloadType: downloadableBlob.type,
      downloadSize: downloadableBlob.size,
      fileName: normalizedFileName,
    });
  }

  downloadBlob(downloadableBlob, normalizedFileName);
};
