/**
 * SVG generation and conversion utilities.
 */

import type { QRData, ModuleStyle } from "./types";
import { buildBlocksPath, buildCirclesPath, buildLinesPath } from "./pathBuilders";
import { buildBlocksPatternPaths, buildCirclesPatternPaths, buildLinesPatternPaths } from "./patterns";

/**
 * Build SVG string from QR data coordinates.
 * Adjacent modules are merged into unified shapes without visible borders.
 */
export function buildSVG(
  qrData: QRData,
  resolution: number,
  fill: string,
  style: ModuleStyle = "blocks"
): string {
  const vb = qrData.viewbox;
  const svgWidth = resolution;
  const svgHeight = Math.round(resolution * (vb.height / vb.width));
  const vbStr = `${vb.min_x} ${vb.min_y} ${vb.width} ${vb.height}`;

  // Check if fill is an image data URL
  const isImage = fill.startsWith("data:image");

  let patternDef = "";
  let fillAttr = fill;

  if (isImage) {
    patternDef = `<defs>
    <pattern id="imgPattern" patternUnits="userSpaceOnUse"
             x="${vb.min_x}" y="${vb.min_y}" width="${vb.width}" height="${vb.height}">
      <image href="${fill}" x="0" y="0" width="${vb.width}" height="${vb.height}"
             preserveAspectRatio="xMidYMid slice"/>
    </pattern>
  </defs>`;
    fillAttr = "url(#imgPattern)";
  }

  // Build merged path from all modules based on style
  const allModules = [...qrData.qrModules, ...qrData.noiseModules];
  let mergedPath: string;
  switch (style) {
    case "circles":
      mergedPath = buildCirclesPath(allModules);
      break;
    case "lines":
      mergedPath = buildLinesPath(allModules);
      break;
    default:
      mergedPath = buildBlocksPath(allModules);
  }

  // Build finder and alignment pattern paths based on style
  let patternPath: string;
  switch (style) {
    case "circles":
      patternPath = buildCirclesPatternPaths(qrData);
      break;
    case "lines":
      patternPath = buildLinesPatternPaths(qrData);
      break;
    default:
      patternPath = buildBlocksPatternPaths(qrData);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${svgWidth}" height="${svgHeight}" viewBox="${vbStr}">
  ${patternDef}
  <rect x="${vb.min_x}" y="${vb.min_y}" width="${vb.width}" height="${vb.height}" fill="white"/>
  <path d="${mergedPath}" fill="${fillAttr}"/>
  <path d="${patternPath}" fill="black" fill-rule="evenodd"/>
</svg>`;
}

/**
 * Convert SVG string to PNG base64 using browser canvas.
 */
export function svgToPngBase64(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      resolve(base64);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG image"));
    };

    img.src = url;
  });
}
