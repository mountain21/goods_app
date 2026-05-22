const DOWNLOAD_START_DELAY_MS = 50;
const OBJECT_URL_REVOKE_DELAY_MS = 30000;

function normalizePngFileName(fileName: string) {
  const trimmed = fileName.trim().replace(/[\\/:*?"<>|]/g, "-");
  const safeName = trimmed || "shopping-list.png";

  return /\.png$/i.test(safeName) ? safeName : `${safeName}.png`;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clickDownloadLink(url: string, fileName: string) {
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.target = "_self";
  link.style.display = "none";

  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    link.remove();
  }
}

export const handleImageSave = async (blob: Blob, fileName: string) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Image download must run in a browser.");
  }

  const normalizedFileName = normalizePngFileName(fileName);
  const pngBlob =
    blob.type === "image/png" ? blob : blob.slice(0, blob.size, "image/png");
  const imageUrl = URL.createObjectURL(pngBlob);

  try {
    await wait(DOWNLOAD_START_DELAY_MS);
    clickDownloadLink(imageUrl, normalizedFileName);
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(imageUrl);
    }, OBJECT_URL_REVOKE_DELAY_MS);
  }
};
