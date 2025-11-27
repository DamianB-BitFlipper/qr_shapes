/**
 * SVG path builders for finder and alignment patterns.
 */

import type { QRData } from "./types";

/**
 * Get alignment pattern center positions for a given QR version.
 */
export function getAlignmentPatternPositions(version: number): number[] {
  if (version < 2) return [];

  const alignmentPositions: { [key: number]: number[] } = {
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50],
    11: [6, 30, 54],
    12: [6, 32, 58],
    13: [6, 34, 62],
    14: [6, 26, 46, 66],
    15: [6, 26, 48, 70],
    16: [6, 26, 50, 74],
    17: [6, 30, 54, 78],
    18: [6, 30, 56, 82],
    19: [6, 30, 58, 86],
    20: [6, 34, 62, 90],
    21: [6, 28, 50, 72, 94],
    22: [6, 26, 50, 74, 98],
    23: [6, 30, 54, 78, 102],
    24: [6, 28, 54, 80, 106],
    25: [6, 32, 58, 84, 110],
    26: [6, 30, 58, 86, 114],
    27: [6, 34, 62, 90, 118],
    28: [6, 26, 50, 74, 98, 122],
    29: [6, 30, 54, 78, 102, 126],
    30: [6, 26, 52, 78, 104, 130],
    31: [6, 30, 56, 82, 108, 134],
    32: [6, 34, 60, 86, 112, 138],
    33: [6, 30, 58, 86, 114, 142],
    34: [6, 34, 62, 90, 118, 146],
    35: [6, 30, 54, 78, 102, 126, 150],
    36: [6, 24, 50, 76, 102, 128, 154],
    37: [6, 28, 54, 80, 106, 132, 158],
    38: [6, 32, 58, 84, 110, 136, 162],
    39: [6, 26, 54, 82, 110, 138, 166],
    40: [6, 30, 58, 86, 114, 142, 170],
  };

  return alignmentPositions[version] || [];
}

// ============================================================================
// BLOCKS STYLE PATTERNS
// ============================================================================

/**
 * Generate SVG path for a single finder pattern (7x7 position detection pattern).
 */
function buildBlocksFinderPatternPath(x: number, y: number): string {
  const outer = `M${x} ${y} h7 v7 h-7 Z`;
  const inner = `M${x + 1} ${y + 1} h5 v5 h-5 Z`;
  const center = `M${x + 2} ${y + 2} h3 v3 h-3 Z`;
  return `${outer} ${inner} ${center}`;
}

/**
 * Generate SVG path for a single alignment pattern (5x5).
 */
function buildBlocksAlignmentPatternPath(centerX: number, centerY: number): string {
  const x = centerX - 2;
  const y = centerY - 2;
  const outer = `M${x} ${y} h5 v5 h-5 Z`;
  const inner = `M${x + 1} ${y + 1} h3 v3 h-3 Z`;
  const center = `M${x + 2} ${y + 2} h1 v1 h-1 Z`;
  return `${outer} ${inner} ${center}`;
}

/**
 * Build all finder and alignment pattern paths for the QR code (blocks style).
 */
export function buildBlocksPatternPaths(qrData: QRData): string {
  const [originX, originY] = qrData.qrOrigin;
  const size = qrData.qrSize;
  const version = qrData.version;

  const paths: string[] = [];

  // Three finder patterns at corners
  paths.push(buildBlocksFinderPatternPath(originX, originY));
  paths.push(buildBlocksFinderPatternPath(originX + size - 7, originY));
  paths.push(buildBlocksFinderPatternPath(originX, originY + size - 7));

  // Alignment patterns (version 2+)
  const alignmentPositions = getAlignmentPatternPositions(version);
  if (alignmentPositions.length > 0) {
    const finderCenters = new Set([
      `6,6`,
      `6,${size - 7}`,
      `${size - 7},6`,
    ]);

    for (const row of alignmentPositions) {
      for (const col of alignmentPositions) {
        if (finderCenters.has(`${col},${row}`)) continue;
        paths.push(buildBlocksAlignmentPatternPath(originX + col, originY + row));
      }
    }
  }

  return paths.join(" ");
}

// ============================================================================
// CIRCLES STYLE PATTERNS (Bullseye)
// ============================================================================

/**
 * Generate SVG path for a circular finder pattern (bullseye).
 */
function buildCirclesFinderPatternPath(x: number, y: number): string {
  const cx = x + 3.5;
  const cy = y + 3.5;
  
  const outerR = 3.5;
  const middleR = 2.5;
  const innerR = 1.5;
  
  const circle = (r: number) => 
    `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy}`;
  
  return `${circle(outerR)} ${circle(middleR)} ${circle(innerR)}`;
}

/**
 * Generate SVG path for a circular alignment pattern (small bullseye).
 * centerX and centerY are the cell coordinates of the alignment pattern center.
 * We add 0.5 to get the actual center point within the cell.
 */
function buildCirclesAlignmentPatternPath(cellX: number, cellY: number): string {
  const cx = cellX + 0.5;
  const cy = cellY + 0.5;
  const outerR = 2.5;
  const middleR = 1.5;
  const innerR = 0.5;
  
  const circle = (r: number) => 
    `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy}`;
  
  return `${circle(outerR)} ${circle(middleR)} ${circle(innerR)}`;
}

/**
 * Build all finder and alignment pattern paths for the QR code (circular style).
 */
export function buildCirclesPatternPaths(qrData: QRData): string {
  const [originX, originY] = qrData.qrOrigin;
  const size = qrData.qrSize;
  const version = qrData.version;

  const paths: string[] = [];

  paths.push(buildCirclesFinderPatternPath(originX, originY));
  paths.push(buildCirclesFinderPatternPath(originX + size - 7, originY));
  paths.push(buildCirclesFinderPatternPath(originX, originY + size - 7));

  const alignmentPositions = getAlignmentPatternPositions(version);
  if (alignmentPositions.length > 0) {
    const finderCenters = new Set([
      `6,6`,
      `6,${size - 7}`,
      `${size - 7},6`,
    ]);

    for (const row of alignmentPositions) {
      for (const col of alignmentPositions) {
        if (finderCenters.has(`${col},${row}`)) continue;
        paths.push(buildCirclesAlignmentPatternPath(originX + col, originY + row));
      }
    }
  }

  return paths.join(" ");
}

// ============================================================================
// LINES STYLE PATTERNS (Rounded squares)
// ============================================================================

/**
 * Helper to create a rounded rectangle SVG path.
 */
function roundedRectPath(rx: number, ry: number, w: number, h: number, r: number): string {
  const x1 = rx + r;
  const x2 = rx + w - r;
  const y1 = ry + r;
  const y2 = ry + h - r;
  return `M${x1} ${ry} L${x2} ${ry} Q${rx + w} ${ry} ${rx + w} ${y1} L${rx + w} ${y2} Q${rx + w} ${ry + h} ${x2} ${ry + h} L${x1} ${ry + h} Q${rx} ${ry + h} ${rx} ${y2} L${rx} ${y1} Q${rx} ${ry} ${x1} ${ry} Z`;
}

/**
 * Generate SVG path for a rounded square finder pattern.
 */
function buildLinesFinderPatternPath(x: number, y: number): string {
  const cornerRadius = 1.0;
  const innerCornerRadius = 0.7;
  const centerCornerRadius = 0.5;
  
  const outer = roundedRectPath(x, y, 7, 7, cornerRadius);
  const middle = roundedRectPath(x + 1, y + 1, 5, 5, innerCornerRadius);
  const inner = roundedRectPath(x + 2, y + 2, 3, 3, centerCornerRadius);
  
  return `${outer} ${middle} ${inner}`;
}

/**
 * Generate SVG path for a rounded square alignment pattern.
 */
function buildLinesAlignmentPatternPath(centerX: number, centerY: number): string {
  const x = centerX - 2;
  const y = centerY - 2;
  const cornerRadius = 0.7;
  const innerCornerRadius = 0.5;
  const centerCornerRadius = 0.3;
  
  const outer = roundedRectPath(x, y, 5, 5, cornerRadius);
  const middle = roundedRectPath(x + 1, y + 1, 3, 3, innerCornerRadius);
  const inner = roundedRectPath(x + 2, y + 2, 1, 1, centerCornerRadius);
  
  return `${outer} ${middle} ${inner}`;
}

/**
 * Build all finder and alignment pattern paths for the QR code (lines style).
 */
export function buildLinesPatternPaths(qrData: QRData): string {
  const [originX, originY] = qrData.qrOrigin;
  const size = qrData.qrSize;
  const version = qrData.version;

  const paths: string[] = [];

  paths.push(buildLinesFinderPatternPath(originX, originY));
  paths.push(buildLinesFinderPatternPath(originX + size - 7, originY));
  paths.push(buildLinesFinderPatternPath(originX, originY + size - 7));

  const alignmentPositions = getAlignmentPatternPositions(version);
  if (alignmentPositions.length > 0) {
    const finderCenters = new Set([
      `6,6`,
      `6,${size - 7}`,
      `${size - 7},6`,
    ]);

    for (const row of alignmentPositions) {
      for (const col of alignmentPositions) {
        if (finderCenters.has(`${col},${row}`)) continue;
        paths.push(buildLinesAlignmentPatternPath(originX + col, originY + row));
      }
    }
  }

  return paths.join(" ");
}
