import { downloadBlob } from "@/utils/blobDownload";

function normalizePngFileName(fileName: string) {
  const trimmed = fileName.trim().replace(/[\\/:*?"<>|]/g, "-");
  const safeName = trimmed || "shopping-list.png";

  return /\.png$/i.test(safeName) ? safeName : `${safeName}.png`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function shouldTryNativeShare() {
  if (typeof window === "undefined") return false;

  return (
    navigator.maxTouchPoints > 0 &&
    window.matchMedia?.("(pointer: coarse)").matches
  );
}

async function shareImageFile(blob: Blob, fileName: string) {
  if (
    !shouldTryNativeShare() ||
    typeof navigator === "undefined" ||
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function" ||
    typeof File === "undefined"
  ) {
    return false;
  }

  const file = new File([blob], fileName, { type: "image/png" });
  const shareData: ShareData = {
    files: [file],
    title: fileName,
  };

  if (!navigator.canShare(shareData)) {
    return false;
  }

  try {
    await navigator.share(shareData);
    return true;
  } catch (error) {
    if (isAbortError(error)) {
      return true;
    }

    console.error("[image-save] failed to share image", error);
    return false;
  }
}

export const handleImageSave = async (blob: Blob, fileName: string) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Image download must run in a browser.");
  }

  const normalizedFileName = normalizePngFileName(fileName);
  const pngBlob =
    blob.type === "image/png" ? blob : blob.slice(0, blob.size, "image/png");
  const shared = await shareImageFile(pngBlob, normalizedFileName);

  if (shared) {
    return;
  }

  downloadBlob(pngBlob, normalizedFileName);
};
