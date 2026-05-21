import type { ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { ExportListImageData } from "@/components/ExportListImage";

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

export async function downloadElementAsImage(
  data: ExportListImageData,
  element: ReactElement
) {
  const html2canvas = (await import("html2canvas")).default;
  const exportId = `export-list-image-${Date.now()}`;
  const host = document.createElement("div");

  host.id = exportId;
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.zIndex = "-1";
  host.style.width = "720px";
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

    const canvas = await html2canvas(host, {
      backgroundColor: "#ffffff",
      ignoreElements: (target) =>
        target.hasAttribute("data-html2canvas-ignore"),
      onclone: (clonedDocument) => {
        applyHtml2CanvasSafeStyles(clonedDocument, exportId);
      },
      scale: Math.min(window.devicePixelRatio || 1, 2),
      useCORS: true,
    });

    const imageUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `${createSafeFileName(data.title || "shopping-list")}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    root.unmount();
    host.remove();
  }
}
