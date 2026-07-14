const OBJECT_URL_REVOKE_DELAY_MS = 1000;

export function downloadBlob(blob: Blob, fileName: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Blob download must run in a browser.");
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, OBJECT_URL_REVOKE_DELAY_MS);
}
