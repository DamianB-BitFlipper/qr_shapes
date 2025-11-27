/**
 * Canvas rendering functions for QR code generation.
 */

import type { QRData, ModuleStyle } from "./types";
import { buildBlocksPath, buildCirclesPath, buildLinesPath } from "./pathBuilders";
import { getAlignmentPatternPositions } from "./patterns";

// ============================================================================
// SVG PATH TO PATH2D CONVERSION
// ============================================================================

/**
 * Parse SVG path data and create a Path2D for canvas clipping.
 */
export function svgPathToPath2D(
  pathData: string,
  scale: number,
  offsetX: number,
  offsetY: number
): Path2D {
  const path = new Path2D();
  const commands = pathData.match(/[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/gi) || [];
  
  let currentX = 0;
  let currentY = 0;
  
  for (const cmd of commands) {
    const type = cmd[0];
    const args = cmd.slice(1).trim().split(/[\s,]+/).filter(s => s.length > 0).map(Number);
    
    switch (type.toUpperCase()) {
      case "M":
        if (type === "m") {
          currentX += args[0];
          currentY += args[1];
        } else {
          currentX = args[0];
          currentY = args[1];
        }
        path.moveTo((currentX - offsetX) * scale, (currentY - offsetY) * scale);
        break;
      case "L":
        if (type === "l") {
          currentX += args[0];
          currentY += args[1];
        } else {
          currentX = args[0];
          currentY = args[1];
        }
        path.lineTo((currentX - offsetX) * scale, (currentY - offsetY) * scale);
        break;
      case "H":
        if (type === "h") {
          currentX += args[0];
        } else {
          currentX = args[0];
        }
        path.lineTo((currentX - offsetX) * scale, (currentY - offsetY) * scale);
        break;
      case "V":
        if (type === "v") {
          currentY += args[0];
        } else {
          currentY = args[0];
        }
        path.lineTo((currentX - offsetX) * scale, (currentY - offsetY) * scale);
        break;
      case "Q":
        if (type === "q") {
          const cpx = currentX + args[0];
          const cpy = currentY + args[1];
          currentX += args[2];
          currentY += args[3];
          path.quadraticCurveTo(
            (cpx - offsetX) * scale,
            (cpy - offsetY) * scale,
            (currentX - offsetX) * scale,
            (currentY - offsetY) * scale
          );
        } else {
          const cpx = args[0];
          const cpy = args[1];
          currentX = args[2];
          currentY = args[3];
          path.quadraticCurveTo(
            (cpx - offsetX) * scale,
            (cpy - offsetY) * scale,
            (currentX - offsetX) * scale,
            (currentY - offsetY) * scale
          );
        }
        break;
      case "A":
        // Arc command - simplified handling
        if (type === "a") {
          currentX += args[5];
          currentY += args[6];
        } else {
          currentX = args[5];
          currentY = args[6];
        }
        path.lineTo((currentX - offsetX) * scale, (currentY - offsetY) * scale);
        break;
      case "Z":
        path.closePath();
        break;
    }
  }
  
  return path;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the average luminance of a region in an image.
 * Returns a value between 0 (black) and 1 (white).
 */
export function getRegionLuminance(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  const data = imageData.data;
  const imgWidth = imageData.width;
  
  let totalLuminance = 0;
  let pixelCount = 0;
  
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(imgWidth, Math.ceil(x + width));
  const endY = Math.min(imageData.height, Math.ceil(y + height));
  
  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const idx = (py * imgWidth + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      totalLuminance += luminance;
      pixelCount++;
    }
  }
  
  return pixelCount > 0 ? totalLuminance / pixelCount : 0.5;
}

/**
 * Helper to draw a rounded rectangle on canvas.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

// ============================================================================
// BLOCKS STYLE CANVAS DRAWING
// ============================================================================

function drawBlocksFinderPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
): void {
  ctx.fillStyle = "black";
  ctx.fillRect(x, y, 7 * scale, 7 * scale);
  ctx.fillStyle = "white";
  ctx.fillRect(x + scale, y + scale, 5 * scale, 5 * scale);
  ctx.fillStyle = "black";
  ctx.fillRect(x + 2 * scale, y + 2 * scale, 3 * scale, 3 * scale);
}

function drawBlocksAlignmentPattern(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number
): void {
  const x = centerX - 2 * scale;
  const y = centerY - 2 * scale;
  ctx.fillStyle = "black";
  ctx.fillRect(x, y, 5 * scale, 5 * scale);
  ctx.fillStyle = "white";
  ctx.fillRect(x + scale, y + scale, 3 * scale, 3 * scale);
  ctx.fillStyle = "black";
  ctx.fillRect(x + 2 * scale, y + 2 * scale, scale, scale);
}

function drawBlocksPatterns(
  ctx: CanvasRenderingContext2D,
  qrData: QRData,
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const [originX, originY] = qrData.qrOrigin;
  const size = qrData.qrSize;
  const version = qrData.version;

  const toCanvasX = (qrX: number) => (qrX - offsetX) * scale;
  const toCanvasY = (qrY: number) => (qrY - offsetY) * scale;

  drawBlocksFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY), scale);
  drawBlocksFinderPattern(ctx, toCanvasX(originX + size - 7), toCanvasY(originY), scale);
  drawBlocksFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY + size - 7), scale);

  const alignmentPositions = getAlignmentPatternPositions(version);
  if (alignmentPositions.length > 0) {
    const finderCenters = new Set([`6,6`, `6,${size - 7}`, `${size - 7},6`]);
    for (const row of alignmentPositions) {
      for (const col of alignmentPositions) {
        if (finderCenters.has(`${col},${row}`)) continue;
        drawBlocksAlignmentPattern(ctx, toCanvasX(originX + col), toCanvasY(originY + row), scale);
      }
    }
  }
}

// ============================================================================
// CIRCLES STYLE CANVAS DRAWING
// ============================================================================

function drawCirclesFinderPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
): void {
  const cx = x + 3.5 * scale;
  const cy = y + 3.5 * scale;
  
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(cx, cy, 1.5 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawCirclesAlignmentPattern(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number
): void {
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 1.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 0.5 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawCirclesPatterns(
  ctx: CanvasRenderingContext2D,
  qrData: QRData,
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const [originX, originY] = qrData.qrOrigin;
  const size = qrData.qrSize;
  const version = qrData.version;

  const toCanvasX = (qrX: number) => (qrX - offsetX) * scale;
  const toCanvasY = (qrY: number) => (qrY - offsetY) * scale;

  drawCirclesFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY), scale);
  drawCirclesFinderPattern(ctx, toCanvasX(originX + size - 7), toCanvasY(originY), scale);
  drawCirclesFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY + size - 7), scale);

  const alignmentPositions = getAlignmentPatternPositions(version);
  if (alignmentPositions.length > 0) {
    const finderCenters = new Set([`6,6`, `6,${size - 7}`, `${size - 7},6`]);
    for (const row of alignmentPositions) {
      for (const col of alignmentPositions) {
        if (finderCenters.has(`${col},${row}`)) continue;
        drawCirclesAlignmentPattern(ctx, toCanvasX(originX + col), toCanvasY(originY + row), scale);
      }
    }
  }
}

// ============================================================================
// LINES STYLE CANVAS DRAWING
// ============================================================================

function drawLinesFinderPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
): void {
  const cornerRadius = 1.0 * scale;
  const innerCornerRadius = 0.7 * scale;
  const centerCornerRadius = 0.5 * scale;
  
  ctx.fillStyle = "black";
  drawRoundedRect(ctx, x, y, 7 * scale, 7 * scale, cornerRadius);
  ctx.fillStyle = "white";
  drawRoundedRect(ctx, x + scale, y + scale, 5 * scale, 5 * scale, innerCornerRadius);
  ctx.fillStyle = "black";
  drawRoundedRect(ctx, x + 2 * scale, y + 2 * scale, 3 * scale, 3 * scale, centerCornerRadius);
}

function drawLinesAlignmentPattern(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number
): void {
  const x = centerX - 2 * scale;
  const y = centerY - 2 * scale;
  const cornerRadius = 0.7 * scale;
  const innerCornerRadius = 0.5 * scale;
  const centerCornerRadius = 0.3 * scale;
  
  ctx.fillStyle = "black";
  drawRoundedRect(ctx, x, y, 5 * scale, 5 * scale, cornerRadius);
  ctx.fillStyle = "white";
  drawRoundedRect(ctx, x + scale, y + scale, 3 * scale, 3 * scale, innerCornerRadius);
  ctx.fillStyle = "black";
  drawRoundedRect(ctx, x + 2 * scale, y + 2 * scale, scale, scale, centerCornerRadius);
}

function drawLinesPatterns(
  ctx: CanvasRenderingContext2D,
  qrData: QRData,
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const [originX, originY] = qrData.qrOrigin;
  const size = qrData.qrSize;
  const version = qrData.version;

  const toCanvasX = (qrX: number) => (qrX - offsetX) * scale;
  const toCanvasY = (qrY: number) => (qrY - offsetY) * scale;

  drawLinesFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY), scale);
  drawLinesFinderPattern(ctx, toCanvasX(originX + size - 7), toCanvasY(originY), scale);
  drawLinesFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY + size - 7), scale);

  const alignmentPositions = getAlignmentPatternPositions(version);
  if (alignmentPositions.length > 0) {
    const finderCenters = new Set([`6,6`, `6,${size - 7}`, `${size - 7},6`]);
    for (const row of alignmentPositions) {
      for (const col of alignmentPositions) {
        if (finderCenters.has(`${col},${row}`)) continue;
        drawLinesAlignmentPattern(ctx, toCanvasX(originX + col), toCanvasY(originY + row), scale);
      }
    }
  }
}

// ============================================================================
// MAIN PATTERN DRAWING DISPATCHER
// ============================================================================

/**
 * Draw all finder and alignment patterns on a canvas based on style.
 */
export function drawPatterns(
  ctx: CanvasRenderingContext2D,
  qrData: QRData,
  scale: number,
  offsetX: number,
  offsetY: number,
  style: ModuleStyle
): void {
  switch (style) {
    case "circles":
      drawCirclesPatterns(ctx, qrData, scale, offsetX, offsetY);
      break;
    case "squiggles":
      drawLinesPatterns(ctx, qrData, scale, offsetX, offsetY);
      break;
    default:
      drawBlocksPatterns(ctx, qrData, scale, offsetX, offsetY);
  }
}

// ============================================================================
// IMAGE RENDERING
// ============================================================================

/**
 * Render QR code with image showing only within the shape boundary.
 */
export function renderQRWithImage(
  qrData: QRData,
  imageDataUrl: string,
  resolution: number,
  style: ModuleStyle = "blocks",
  transparentBg: boolean = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const vb = qrData.viewbox;
      const scale = resolution / vb.width;
      const canvasWidth = resolution;
      const canvasHeight = Math.round(resolution * (vb.height / vb.width));
      
      // Create a temporary canvas for image data
      const imgCanvas = document.createElement("canvas");
      imgCanvas.width = canvasWidth;
      imgCanvas.height = canvasHeight;
      const imgCtx = imgCanvas.getContext("2d");
      if (!imgCtx) {
        reject(new Error("Failed to get image canvas context"));
        return;
      }
      
      imgCtx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      const imageData = imgCtx.getImageData(0, 0, canvasWidth, canvasHeight);
      
      // Create the main output canvas
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      
      // Background - white or transparent
      if (!transparentBg) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Build merged path based on style
      const allModules = [...qrData.qrModules, ...qrData.noiseModules];
      let mergedPathData: string;
      switch (style) {
        case "circles":
          mergedPathData = buildCirclesPath(allModules);
          break;
        case "squiggles":
          mergedPathData = buildLinesPath(allModules);
          break;
        default:
          mergedPathData = buildBlocksPath(allModules);
      }
      
      // Convert to Path2D for clipping
      const clipPath = svgPathToPath2D(mergedPathData, scale, vb.min_x, vb.min_y);
      
      // Draw the image clipped to the merged shape
      ctx.save();
      ctx.clip(clipPath);
      ctx.drawImage(imgCanvas, 0, 0);
      ctx.restore();
      
      // Calculate average luminance
      const moduleSize = scale;
      let totalLuminance = 0;
      let moduleCount = 0;
      
      for (const [mx, my] of allModules) {
        const canvasX = (mx - vb.min_x) * scale;
        const canvasY = (my - vb.min_y) * scale;
        totalLuminance += getRegionLuminance(imageData, canvasX, canvasY, moduleSize, moduleSize);
        moduleCount++;
      }
      
      const avgLuminance = moduleCount > 0 ? totalLuminance / moduleCount : 0.5;
      
      // Apply contrast overlay
      ctx.save();
      ctx.clip(clipPath);
      ctx.fillStyle = avgLuminance > 0.5 ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      
      // Draw patterns on top
      drawPatterns(ctx, qrData, scale, vb.min_x, vb.min_y, style);
      
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      resolve(base64);
    };
    
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    
    img.src = imageDataUrl;
  });
}
