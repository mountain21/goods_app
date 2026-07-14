import type { ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { ExportListImageData } from "@/components/ExportListImage";
import { downloadBlob } from "@/utils/blobDownload";

const EXPORT_IMAGE_WIDTH = 720;

type RenderElementAsImageBlobOptions = {
  pixelRatio?: number;
};

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

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

async function waitForFonts(timeoutMs: number) {
  const fonts = document.fonts;

  if (!fonts?.ready) return;

  await withTimeout(fonts.ready.then(() => undefined), timeoutMs, undefined);
}

async function waitForImage(
  image: HTMLImageElement,
  timeoutMs: number
): Promise<void> {
  if (!image.currentSrc && !image.src) {
    return;
  }

  if (image.complete) {
    return;
  }

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    };

    const handleLoad = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      resolve();
    };

    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
  });
}

async function waitForImages(
  target: HTMLElement,
  timeoutMs: number
): Promise<void> {
  const images = Array.from(target.querySelectorAll<HTMLImageElement>("img"));

  await Promise.all(images.map((image) => waitForImage(image, timeoutMs)));
}

export async function downloadElementAsImage(
  data: ExportListImageData,
  element: ReactElement
) {
  const { blob, fileName } = await renderElementAsImageBlob(data, element);

  downloadBlob(blob, fileName);
}

export async function renderElementAsImageBlob(
  data: ExportListImageData,
  element: ReactElement,
  options: RenderElementAsImageBlobOptions = {}
) {
  const html2canvas = (await import("html2canvas")).default;
  const exportId = `export-list-image-${Date.now()}`;
  const host = document.createElement("div");
  const fileName = `${createSafeFileName(data.title || "shopping-list")}.png`;
  const pixelRatio = options.pixelRatio ?? getCanvasScale();

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

    await waitForFonts(3000);

    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await new Promise((resolve) => window.setTimeout(resolve, 100));

    await waitForImages(host, 3000);

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
      scale: pixelRatio,
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

    return {
      blob,
      fileName,
      outputWidth: canvas.width,
      outputHeight: canvas.height,
      pixelRatio,
    };
  } finally {
    root.unmount();
    host.remove();
  }
}

export function downloadImageBlob(blob: Blob, fileName: string) {
  downloadBlob(blob, fileName);
}
