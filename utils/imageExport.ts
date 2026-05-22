import type { ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { ExportListImageData } from "@/components/ExportListImage";
import { handleImageSave } from "@/utils/imageSaver";

const EXPORT_IMAGE_WIDTH = 720;

export class ImageExportError extends Error {
  constructor(
    message: string,
    readonly code: "TAINTED_CANVAS" | "BLOB_CREATION_FAILED" | "RENDER_FAILED",
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "ImageExportError";
  }
}

function createSafeFileName(value: string) {
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-");

  return normalized || "shopping-list";
}

function applyHtml2CanvasSafeStyles(clonedDocument: Document, elementId: string) {
  const clonedTarget = clonedDocument.getElementById(elementId);

  if (!clonedTarget) return;

  clonedDocument.documentElement.style.backgroundColor = "#ffffff";
  clonedDocument.documentElement.style.color = "#0f172a";
  clonedDocument.body.style.backgroundColor = "#ffffff";
  clonedDocument.body.style.color = "#0f172a";

  const elements = [
    clonedTarget,
    ...Array.from(clonedTarget.querySelectorAll<HTMLElement>("*")),
  ];

  for (const element of elements) {
    element.style.color = element.style.color || "#0f172a";
    element.style.borderColor = element.style.borderColor || "#e2e8f0";
    element.style.outlineColor = "transparent";
    element.style.boxShadow = "none";
    element.style.textShadow = "none";
    element.style.backgroundImage = "none";
    element.style.transition = "none";
    element.style.animation = "none";
    element.style.caretColor = "#0f172a";

    if (!element.style.backgroundColor) {
      element.style.backgroundColor = "transparent";
    }
  }
}

function getCanvasScale() {
  if (typeof navigator === "undefined") return 1;

  return /iPhone|iPad|iPod/.test(navigator.userAgent) ? 0.8 : 1;
}

export async function downloadElementAsImage(
  data: ExportListImageData,
  element: ReactElement
) {
  const { blob, fileName } = await renderElementAsImageBlob(data, element);

  await handleImageSave(blob, fileName);
}

export async function renderElementAsImageBlob(
  data: ExportListImageData,
  element: ReactElement
) {
  const html2canvas = (await import("html2canvas")).default;
  const exportId = `export-list-image-${Date.now()}`;
  const host = document.createElement("div");
  const fileName = `${createSafeFileName(data.title || "shopping-list")}.png`;

  host.id = exportId;
  host.style.position = "fixed";
  host.style.left = "-9999px";
  host.style.top = "0";
  host.style.zIndex = "-1";
  host.style.width = `${EXPORT_IMAGE_WIDTH}px`;
  host.style.backgroundColor = "#ffffff";
  host.style.color = "#0f172a";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    flushSync(() => {
      root.render(element);
    });

    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await new Promise((resolve) => window.setTimeout(resolve, 100));

    const captureHeight = Math.ceil(host.scrollHeight || host.offsetHeight);

    const canvas = await html2canvas(host, {
      allowTaint: false,
      backgroundColor: "#ffffff",
      foreignObjectRendering: false,
      height: captureHeight,
      ignoreElements: (target) =>
        target.hasAttribute("data-html2canvas-ignore"),
      imageTimeout: 15000,
      logging: false,
      onclone: (clonedDocument) => {
        applyHtml2CanvasSafeStyles(clonedDocument, exportId);
      },
      scale: getCanvasScale(),
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      width: EXPORT_IMAGE_WIDTH,
      windowHeight: captureHeight,
      windowWidth: EXPORT_IMAGE_WIDTH,
      x: 0,
      y: 0,
    }).catch((error: unknown) => {
      throw new ImageExportError(
        "画像の描画に失敗しました。外部画像のCORS設定、または端末のメモリ制限を確認してください。",
        "RENDER_FAILED",
        error
      );
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob((createdBlob) => {
          if (createdBlob) {
            resolve(createdBlob);
            return;
          }

          reject(
            new ImageExportError(
              "画像データの作成に失敗しました。外部画像がCORS未対応の可能性があります。",
              "BLOB_CREATION_FAILED"
            )
          );
        }, "image/png");
      } catch (error) {
        reject(
          new ImageExportError(
            "画像データの作成に失敗しました。外部画像によりCanvasが保護されている可能性があります。",
            "TAINTED_CANVAS",
            error
          )
        );
      }
    });

    return { blob, fileName };
  } finally {
    root.unmount();
    host.remove();
  }
}

export function downloadImageBlob(blob: Blob, fileName: string) {
  return handleImageSave(blob, fileName);
}
