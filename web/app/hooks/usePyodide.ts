"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

export type ModuleStyle = "blocks" | "circles" | "lines";

export interface QRData {
  qrModules: [number, number][];
  noiseModules: [number, number][];
  viewbox: {
    min_x: number;
    min_y: number;
    width: number;
    height: number;
  };
  shapeSize: number;
  center: [number, number];
  qrOrigin: [number, number];
  qrSize: number;
  version: number;
}

/**
 * Build a merged path from module coordinates by tracing boundaries.
 * 
 * Each module is a unit square at grid position (x, y), occupying pixel space [x, x+1] × [y, y+1].
 * We trace the boundary clockwise (keeping filled cells on our right), outputting vertices.
 */
function buildMergedPath(modules: [number, number][]): string {
  if (modules.length === 0) return "";

  // Create a set for O(1) lookup
  const moduleSet = new Set<string>();
  for (const [x, y] of modules) {
    moduleSet.add(`${x},${y}`);
  }

  const hasModule = (x: number, y: number): boolean => moduleSet.has(`${x},${y}`);

  // Track which directed edges we've visited
  const visitedEdges = new Set<string>();

  // A directed edge goes from vertex (x1,y1) to vertex (x2,y2)
  // We trace clockwise, so filled cell is always on the RIGHT of our direction
  type DirEdge = { x1: number; y1: number; x2: number; y2: number };

  const edgeKey = (e: DirEdge): string => `${e.x1},${e.y1}-${e.x2},${e.y2}`;

  // Build the list of all boundary edges
  // For a module at (mx, my), its boundary edges are those where the neighbor is empty
  const boundaryEdges: DirEdge[] = [];
  for (const [mx, my] of modules) {
    // Top edge: if no module above, edge goes left-to-right (y stays at my)
    if (!hasModule(mx, my - 1)) {
      boundaryEdges.push({ x1: mx, y1: my, x2: mx + 1, y2: my });
    }
    // Right edge: if no module to the right, edge goes top-to-bottom (x stays at mx+1)
    if (!hasModule(mx + 1, my)) {
      boundaryEdges.push({ x1: mx + 1, y1: my, x2: mx + 1, y2: my + 1 });
    }
    // Bottom edge: if no module below, edge goes right-to-left (y stays at my+1)
    if (!hasModule(mx, my + 1)) {
      boundaryEdges.push({ x1: mx + 1, y1: my + 1, x2: mx, y2: my + 1 });
    }
    // Left edge: if no module to the left, edge goes bottom-to-top (x stays at mx)
    if (!hasModule(mx - 1, my)) {
      boundaryEdges.push({ x1: mx, y1: my + 1, x2: mx, y2: my });
    }
  }

  // Build a map from start vertex to list of edges starting there
  const edgesFromVertex = new Map<string, DirEdge[]>();
  for (const edge of boundaryEdges) {
    const key = `${edge.x1},${edge.y1}`;
    if (!edgesFromVertex.has(key)) {
      edgesFromVertex.set(key, []);
    }
    edgesFromVertex.get(key)!.push(edge);
  }

  // Given an incoming edge direction, find the next edge from the endpoint
  // We want to turn RIGHT as much as possible (tightest clockwise turn)
  const getNextEdge = (current: DirEdge): DirEdge | null => {
    const endKey = `${current.x2},${current.y2}`;
    const candidates = edgesFromVertex.get(endKey);
    if (!candidates || candidates.length === 0) return null;

    // Direction we arrived from (incoming direction vector)
    const dx = current.x2 - current.x1;
    const dy = current.y2 - current.y1;

    // For clockwise boundary tracing (keeping filled on right), we want the tightest right turn.
    // In screen coordinates (y down), cross product > 0 means clockwise turn.
    // We use atan2(-cross, dot) to get angle where clockwise is negative.
    // Then we pick the minimum angle (most clockwise turn).
    
    let bestEdge: DirEdge | null = null;
    let bestAngle = Infinity;

    for (const candidate of candidates) {
      const cdx = candidate.x2 - candidate.x1;
      const cdy = candidate.y2 - candidate.y1;
      
      // Cross product in screen coords: positive = clockwise turn (right)
      const cross = dx * cdy - dy * cdx;
      const dot = dx * cdx + dy * cdy;
      
      // atan2(-cross, dot) gives us angle where right turn is negative
      const angle = Math.atan2(-cross, dot);
      
      if (angle < bestAngle) {
        bestAngle = angle;
        bestEdge = candidate;
      }
    }

    return bestEdge;
  };

  const pathParts: string[] = [];

  // Trace all closed loops
  for (const startEdge of boundaryEdges) {
    const startKey = edgeKey(startEdge);
    if (visitedEdges.has(startKey)) continue;

    // Trace this loop
    const points: { x: number; y: number }[] = [];
    let currentEdge: DirEdge | null = startEdge;

    while (currentEdge) {
      const key = edgeKey(currentEdge);
      if (visitedEdges.has(key)) break;
      visitedEdges.add(key);

      points.push({ x: currentEdge.x1, y: currentEdge.y1 });

      currentEdge = getNextEdge(currentEdge);
      if (currentEdge && edgeKey(currentEdge) === startKey) break;
    }

    if (points.length >= 3) {
      const pathData = points
        .map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`))
        .join(" ");
      pathParts.push(pathData + " Z");
    }
  }

  return pathParts.join(" ");
}

/**
 * Build a path of individual circles for each module.
 * Each module is rendered as a simple circle - no merging to avoid overlap issues.
 */
function buildCircularMergedPath(modules: [number, number][]): string {
  if (modules.length === 0) return "";

  const paths: string[] = [];
  const radius = 0.45; // Slightly smaller than 0.5 to leave small gaps

  // Draw a circle for each module
  for (const [x, y] of modules) {
    const cx = x + 0.5;
    const cy = y + 0.5;
    // Draw circle using two arcs
    paths.push(
      `M${cx - radius} ${cy} ` +
      `a${radius} ${radius} 0 1 0 ${radius * 2} 0 ` +
      `a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
    );
  }

  return paths.join(" ");
}

/**
 * Build a merged path with rounded corners for connected modules.
 * Adjacent modules are joined into lines/shapes with rounded ends and corners.
 */
function buildLinesMergedPath(modules: [number, number][]): string {
  if (modules.length === 0) return "";

  const moduleSet = new Set<string>();
  for (const [x, y] of modules) {
    moduleSet.add(`${x},${y}`);
  }

  const hasModule = (x: number, y: number): boolean => moduleSet.has(`${x},${y}`);

  const radius = 0.45;
  const paths: string[] = [];
  const visited = new Set<string>();

  // Helper to create a rounded rectangle path
  const roundedRect = (x: number, y: number, w: number, h: number, r: number): string => {
    const x1 = x + r;
    const x2 = x + w - r;
    const y1 = y + r;
    const y2 = y + h - r;
    return `M${x1} ${y} L${x2} ${y} Q${x + w} ${y} ${x + w} ${y1} L${x + w} ${y2} Q${x + w} ${y + h} ${x2} ${y + h} L${x1} ${y + h} Q${x} ${y + h} ${x} ${y2} L${x} ${y1} Q${x} ${y} ${x1} ${y} Z`;
  };

  // Find horizontal runs first
  for (const [x, y] of modules) {
    const key = `${x},${y}`;
    if (visited.has(key)) continue;

    // Check if this is part of a horizontal run
    let runStartX = x;
    let runEndX = x;

    // Extend left
    while (hasModule(runStartX - 1, y) && !visited.has(`${runStartX - 1},${y}`)) {
      runStartX--;
    }
    // Extend right
    while (hasModule(runEndX + 1, y) && !visited.has(`${runEndX + 1},${y}`)) {
      runEndX++;
    }

    const runLength = runEndX - runStartX + 1;

    // Only create horizontal run if length > 1 and no vertical neighbors that would make it complex
    if (runLength > 1) {
      // Mark all in this run as visited
      for (let rx = runStartX; rx <= runEndX; rx++) {
        visited.add(`${rx},${y}`);
      }
      
      // Draw rounded pill for horizontal run
      const margin = 0.5 - radius;
      paths.push(roundedRect(
        runStartX + margin,
        y + margin,
        runLength - 2 * margin,
        1 - 2 * margin,
        radius
      ));
    }
  }

  // Find vertical runs for remaining unvisited modules
  for (const [x, y] of modules) {
    const key = `${x},${y}`;
    if (visited.has(key)) continue;

    // Check if this is part of a vertical run
    let runStartY = y;
    let runEndY = y;

    // Extend up
    while (hasModule(x, runStartY - 1) && !visited.has(`${x},${runStartY - 1}`)) {
      runStartY--;
    }
    // Extend down
    while (hasModule(x, runEndY + 1) && !visited.has(`${x},${runEndY + 1}`)) {
      runEndY++;
    }

    const runLength = runEndY - runStartY + 1;

    if (runLength > 1) {
      // Mark all in this run as visited
      for (let ry = runStartY; ry <= runEndY; ry++) {
        visited.add(`${x},${ry}`);
      }
      
      // Draw rounded pill for vertical run
      const margin = 0.5 - radius;
      paths.push(roundedRect(
        x + margin,
        runStartY + margin,
        1 - 2 * margin,
        runLength - 2 * margin,
        radius
      ));
    }
  }

  // Draw circles for any remaining isolated modules
  for (const [x, y] of modules) {
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cx = x + 0.5;
    const cy = y + 0.5;
    paths.push(
      `M${cx - radius} ${cy} ` +
      `a${radius} ${radius} 0 1 0 ${radius * 2} 0 ` +
      `a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
    );
  }

  return paths.join(" ");
}

/**
 * Generate SVG path for a rounded square finder pattern.
 * Three concentric rounded squares: outer black, middle white, inner black.
 */
function buildLinesFinderPatternPath(x: number, y: number): string {
  const cornerRadius = 1.0;
  const innerCornerRadius = 0.7;
  const centerCornerRadius = 0.5;
  
  // Helper to create a rounded rectangle path
  const roundedRect = (rx: number, ry: number, w: number, h: number, r: number): string => {
    const x1 = rx + r;
    const x2 = rx + w - r;
    const y1 = ry + r;
    const y2 = ry + h - r;
    return `M${x1} ${ry} L${x2} ${ry} Q${rx + w} ${ry} ${rx + w} ${y1} L${rx + w} ${y2} Q${rx + w} ${ry + h} ${x2} ${ry + h} L${x1} ${ry + h} Q${rx} ${ry + h} ${rx} ${y2} L${rx} ${y1} Q${rx} ${ry} ${x1} ${ry} Z`;
  };
  
  // Outer rounded square (7x7)
  const outer = roundedRect(x, y, 7, 7, cornerRadius);
  // Middle rounded square (5x5, 1 module inset)
  const middle = roundedRect(x + 1, y + 1, 5, 5, innerCornerRadius);
  // Inner rounded square (3x3, 2 modules inset)
  const inner = roundedRect(x + 2, y + 2, 3, 3, centerCornerRadius);
  
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
  
  const roundedRect = (rx: number, ry: number, w: number, h: number, r: number): string => {
    const x1 = rx + r;
    const x2 = rx + w - r;
    const y1 = ry + r;
    const y2 = ry + h - r;
    return `M${x1} ${ry} L${x2} ${ry} Q${rx + w} ${ry} ${rx + w} ${y1} L${rx + w} ${y2} Q${rx + w} ${ry + h} ${x2} ${ry + h} L${x1} ${ry + h} Q${rx} ${ry + h} ${rx} ${y2} L${rx} ${y1} Q${rx} ${ry} ${x1} ${ry} Z`;
  };
  
  // Outer (5x5)
  const outer = roundedRect(x, y, 5, 5, cornerRadius);
  // Middle (3x3)
  const middle = roundedRect(x + 1, y + 1, 3, 3, innerCornerRadius);
  // Inner (1x1)
  const inner = roundedRect(x + 2, y + 2, 1, 1, centerCornerRadius);
  
  return `${outer} ${middle} ${inner}`;
}

/**
 * Build all finder and alignment pattern paths for the QR code (lines style).
 */
function buildLinesPatternPaths(qrData: QRData): string {
  const [originX, originY] = qrData.qrOrigin;
  const size = qrData.qrSize;
  const version = qrData.version;

  const paths: string[] = [];

  // Three finder patterns at corners
  paths.push(buildLinesFinderPatternPath(originX, originY));
  paths.push(buildLinesFinderPatternPath(originX + size - 7, originY));
  paths.push(buildLinesFinderPatternPath(originX, originY + size - 7));

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
        paths.push(buildLinesAlignmentPatternPath(originX + col, originY + row));
      }
    }
  }

  return paths.join(" ");
}

/**
 * Generate SVG path for a circular finder pattern (bullseye).
 * Three concentric circles: outer black, middle white, inner black.
 */
function buildCircularFinderPatternPath(x: number, y: number): string {
  // Center of the 7x7 finder pattern
  const cx = x + 3.5;
  const cy = y + 3.5;
  
  // Radii for the three circles (scaled to fit in 7x7 area)
  const outerR = 3.5;
  const middleR = 2.5;
  const innerR = 1.5;
  
  // Draw circles using two arcs each
  const circle = (r: number) => 
    `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy}`;
  
  return `${circle(outerR)} ${circle(middleR)} ${circle(innerR)}`;
}

/**
 * Generate SVG path for a circular alignment pattern (small bullseye).
 */
function buildCircularAlignmentPatternPath(centerX: number, centerY: number): string {
  const outerR = 2.5;
  const middleR = 1.5;
  const innerR = 0.5;
  
  const circle = (r: number) => 
    `M${centerX - r} ${centerY} A${r} ${r} 0 1 0 ${centerX + r} ${centerY} A${r} ${r} 0 1 0 ${centerX - r} ${centerY}`;
  
  return `${circle(outerR)} ${circle(middleR)} ${circle(innerR)}`;
}

/**
 * Build all finder and alignment pattern paths for the QR code (circular style).
 */
function buildCircularPatternPaths(qrData: QRData): string {
  const [originX, originY] = qrData.qrOrigin;
  const size = qrData.qrSize;
  const version = qrData.version;

  const paths: string[] = [];

  // Three finder patterns at corners
  paths.push(buildCircularFinderPatternPath(originX, originY));
  paths.push(buildCircularFinderPatternPath(originX + size - 7, originY));
  paths.push(buildCircularFinderPatternPath(originX, originY + size - 7));

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
        paths.push(buildCircularAlignmentPatternPath(originX + col, originY + row));
      }
    }
  }

  return paths.join(" ");
}

/**
 * Generate SVG path for a single finder pattern (7x7 position detection pattern).
 * The pattern consists of:
 * - Outer 7x7 black square
 * - Inner 5x5 white square (1 module inset)
 * - Center 3x3 black square (2 modules inset)
 */
function buildFinderPatternPath(x: number, y: number): string {
  // Outer black square (7x7)
  const outer = `M${x} ${y} h7 v7 h-7 Z`;
  // Inner white square (5x5) - will be subtracted
  const inner = `M${x + 1} ${y + 1} h5 v5 h-5 Z`;
  // Center black square (3x3)
  const center = `M${x + 2} ${y + 2} h3 v3 h-3 Z`;

  return `${outer} ${inner} ${center}`;
}

/**
 * Generate SVG path for a single alignment pattern (5x5).
 * The pattern consists of:
 * - Outer 5x5 black square
 * - Inner 3x3 white square
 * - Center 1x1 black square
 */
function buildAlignmentPatternPath(centerX: number, centerY: number): string {
  const x = centerX - 2;
  const y = centerY - 2;

  // Outer black square (5x5)
  const outer = `M${x} ${y} h5 v5 h-5 Z`;
  // Inner white square (3x3)
  const inner = `M${x + 1} ${y + 1} h3 v3 h-3 Z`;
  // Center black square (1x1)
  const center = `M${x + 2} ${y + 2} h1 v1 h-1 Z`;

  return `${outer} ${inner} ${center}`;
}

/**
 * Get alignment pattern center positions for a given QR version.
 */
function getAlignmentPatternPositions(version: number): number[] {
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

/**
 * Build all finder and alignment pattern paths for the QR code.
 */
function buildPatternPaths(qrData: QRData): string {
  const [originX, originY] = qrData.qrOrigin;
  const size = qrData.qrSize;
  const version = qrData.version;

  const paths: string[] = [];

  // Three finder patterns at corners
  // Top-left
  paths.push(buildFinderPatternPath(originX, originY));
  // Top-right
  paths.push(buildFinderPatternPath(originX + size - 7, originY));
  // Bottom-left
  paths.push(buildFinderPatternPath(originX, originY + size - 7));

  // Alignment patterns (version 2+)
  const alignmentPositions = getAlignmentPatternPositions(version);
  if (alignmentPositions.length > 0) {
    // Finder pattern centers (to skip)
    const finderCenters = new Set([
      `6,6`,
      `6,${size - 7}`,
      `${size - 7},6`,
    ]);

    for (const row of alignmentPositions) {
      for (const col of alignmentPositions) {
        // Skip if this would overlap with a finder pattern
        if (finderCenters.has(`${col},${row}`)) continue;

        paths.push(
          buildAlignmentPatternPath(originX + col, originY + row)
        );
      }
    }
  }

  return paths.join(" ");
}

/**
 * Build SVG string from QR data coordinates.
 * Adjacent modules are merged into unified shapes without visible borders.
 */
function buildSVG(
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
  if (style === "circles") {
    mergedPath = buildCircularMergedPath(allModules);
  } else if (style === "lines") {
    mergedPath = buildLinesMergedPath(allModules);
  } else {
    mergedPath = buildMergedPath(allModules);
  }

  // Build finder and alignment pattern paths based on style
  let patternPath: string;
  if (style === "circles") {
    patternPath = buildCircularPatternPaths(qrData);
  } else if (style === "lines") {
    patternPath = buildLinesPatternPaths(qrData);
  } else {
    patternPath = buildPatternPaths(qrData);
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
function svgToPngBase64(svg: string): Promise<string> {
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

      // Get base64 without the data:image/png;base64, prefix
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

/**
 * Get the average luminance of a region in an image.
 * Returns a value between 0 (black) and 1 (white).
 */
function getRegionLuminance(
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
      // Relative luminance formula
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      totalLuminance += luminance;
      pixelCount++;
    }
  }
  
  return pixelCount > 0 ? totalLuminance / pixelCount : 0.5;
}

/**
 * Parse SVG path data and create a Path2D for canvas clipping.
 */
function svgPathToPath2D(pathData: string, scale: number, offsetX: number, offsetY: number): Path2D {
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
        // Arc command - simplified handling for circular arcs
        // a rx ry x-axis-rotation large-arc-flag sweep-flag x y
        if (type === "a") {
          currentX += args[5];
          currentY += args[6];
        } else {
          currentX = args[5];
          currentY = args[6];
        }
        // For now, just move to the endpoint - full arc support would need more complex handling
        path.lineTo((currentX - offsetX) * scale, (currentY - offsetY) * scale);
        break;
      case "Z":
        path.closePath();
        break;
    }
  }
  
  return path;
}

/**
 * Draw a circular finder pattern (bullseye) on a canvas context.
 */
function drawCircularFinderPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
): void {
  const cx = x + 3.5 * scale;
  const cy = y + 3.5 * scale;
  
  // Outer black circle
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Middle white circle
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner black circle
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(cx, cy, 1.5 * scale, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw a circular alignment pattern (small bullseye) on a canvas context.
 */
function drawCircularAlignmentPattern(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number
): void {
  // Outer black circle
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Middle white circle
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 1.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner black circle
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 0.5 * scale, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw all finder and alignment patterns on a canvas (circular style).
 */
function drawCircularPatterns(
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

  // Three finder patterns at corners
  drawCircularFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY), scale);
  drawCircularFinderPattern(ctx, toCanvasX(originX + size - 7), toCanvasY(originY), scale);
  drawCircularFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY + size - 7), scale);

  // Alignment patterns (version 2+)
  const alignmentPositions = getAlignmentPatternPositions(version);
  if (alignmentPositions.length > 0) {
    const finderCenters = new Set([`6,6`, `6,${size - 7}`, `${size - 7},6`]);

    for (const row of alignmentPositions) {
      for (const col of alignmentPositions) {
        if (finderCenters.has(`${col},${row}`)) continue;

        drawCircularAlignmentPattern(
          ctx,
          toCanvasX(originX + col),
          toCanvasY(originY + row),
          scale
        );
      }
    }
  }
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

/**
 * Draw a rounded square finder pattern on a canvas context.
 */
function drawLinesFinderPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
): void {
  const cornerRadius = 1.0 * scale;
  const innerCornerRadius = 0.7 * scale;
  const centerCornerRadius = 0.5 * scale;
  
  // Outer black rounded square (7x7)
  ctx.fillStyle = "black";
  drawRoundedRect(ctx, x, y, 7 * scale, 7 * scale, cornerRadius);
  
  // Middle white rounded square (5x5)
  ctx.fillStyle = "white";
  drawRoundedRect(ctx, x + scale, y + scale, 5 * scale, 5 * scale, innerCornerRadius);
  
  // Inner black rounded square (3x3)
  ctx.fillStyle = "black";
  drawRoundedRect(ctx, x + 2 * scale, y + 2 * scale, 3 * scale, 3 * scale, centerCornerRadius);
}

/**
 * Draw a rounded square alignment pattern on a canvas context.
 */
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
  
  // Outer black rounded square (5x5)
  ctx.fillStyle = "black";
  drawRoundedRect(ctx, x, y, 5 * scale, 5 * scale, cornerRadius);
  
  // Middle white rounded square (3x3)
  ctx.fillStyle = "white";
  drawRoundedRect(ctx, x + scale, y + scale, 3 * scale, 3 * scale, innerCornerRadius);
  
  // Inner black rounded square (1x1)
  ctx.fillStyle = "black";
  drawRoundedRect(ctx, x + 2 * scale, y + 2 * scale, scale, scale, centerCornerRadius);
}

/**
 * Draw all finder and alignment patterns on a canvas (lines style).
 */
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

  // Three finder patterns at corners
  drawLinesFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY), scale);
  drawLinesFinderPattern(ctx, toCanvasX(originX + size - 7), toCanvasY(originY), scale);
  drawLinesFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY + size - 7), scale);

  // Alignment patterns (version 2+)
  const alignmentPositions = getAlignmentPatternPositions(version);
  if (alignmentPositions.length > 0) {
    const finderCenters = new Set([`6,6`, `6,${size - 7}`, `${size - 7},6`]);

    for (const row of alignmentPositions) {
      for (const col of alignmentPositions) {
        if (finderCenters.has(`${col},${row}`)) continue;

        drawLinesAlignmentPattern(
          ctx,
          toCanvasX(originX + col),
          toCanvasY(originY + row),
          scale
        );
      }
    }
  }
}

/**
 * Draw a finder pattern on a canvas context.
 * @param ctx Canvas 2D context
 * @param x Top-left x coordinate
 * @param y Top-left y coordinate
 * @param scale Scale factor (pixels per module)
 */
function drawFinderPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
): void {
  // Outer black square (7x7)
  ctx.fillStyle = "black";
  ctx.fillRect(x, y, 7 * scale, 7 * scale);

  // Inner white square (5x5)
  ctx.fillStyle = "white";
  ctx.fillRect(x + scale, y + scale, 5 * scale, 5 * scale);

  // Center black square (3x3)
  ctx.fillStyle = "black";
  ctx.fillRect(x + 2 * scale, y + 2 * scale, 3 * scale, 3 * scale);
}

/**
 * Draw an alignment pattern on a canvas context.
 * @param ctx Canvas 2D context
 * @param centerX Center x coordinate
 * @param centerY Center y coordinate
 * @param scale Scale factor (pixels per module)
 */
function drawAlignmentPattern(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  scale: number
): void {
  const x = centerX - 2 * scale;
  const y = centerY - 2 * scale;

  // Outer black square (5x5)
  ctx.fillStyle = "black";
  ctx.fillRect(x, y, 5 * scale, 5 * scale);

  // Inner white square (3x3)
  ctx.fillStyle = "white";
  ctx.fillRect(x + scale, y + scale, 3 * scale, 3 * scale);

  // Center black square (1x1)
  ctx.fillStyle = "black";
  ctx.fillRect(x + 2 * scale, y + 2 * scale, scale, scale);
}

/**
 * Draw all finder and alignment patterns on a canvas.
 */
function drawPatterns(
  ctx: CanvasRenderingContext2D,
  qrData: QRData,
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  const [originX, originY] = qrData.qrOrigin;
  const size = qrData.qrSize;
  const version = qrData.version;

  // Convert QR coordinates to canvas coordinates
  const toCanvasX = (qrX: number) => (qrX - offsetX) * scale;
  const toCanvasY = (qrY: number) => (qrY - offsetY) * scale;

  // Three finder patterns at corners
  drawFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY), scale);
  drawFinderPattern(ctx, toCanvasX(originX + size - 7), toCanvasY(originY), scale);
  drawFinderPattern(ctx, toCanvasX(originX), toCanvasY(originY + size - 7), scale);

  // Alignment patterns (version 2+)
  const alignmentPositions = getAlignmentPatternPositions(version);
  if (alignmentPositions.length > 0) {
    const finderCenters = new Set([`6,6`, `6,${size - 7}`, `${size - 7},6`]);

    for (const row of alignmentPositions) {
      for (const col of alignmentPositions) {
        if (finderCenters.has(`${col},${row}`)) continue;

        drawAlignmentPattern(
          ctx,
          toCanvasX(originX + col),
          toCanvasY(originY + row),
          scale
        );
      }
    }
  }
}

/**
 * Render QR code with image showing only within the shape boundary.
 * The image is visible through the QR modules and noise modules,
 * with contrast-aware darkening/lightening for scanability.
 * Uses merged path clipping for seamless adjacent modules.
 */
function renderQRWithImage(
  qrData: QRData,
  imageDataUrl: string,
  resolution: number,
  style: ModuleStyle = "blocks"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const vb = qrData.viewbox;
      const scale = resolution / vb.width;
      const canvasWidth = resolution;
      const canvasHeight = Math.round(resolution * (vb.height / vb.width));
      
      // Create a temporary canvas to get image data for luminance analysis
      const imgCanvas = document.createElement("canvas");
      imgCanvas.width = canvasWidth;
      imgCanvas.height = canvasHeight;
      const imgCtx = imgCanvas.getContext("2d");
      if (!imgCtx) {
        reject(new Error("Failed to get image canvas context"));
        return;
      }
      
      // Draw the image scaled to fit
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
      
      // Start with white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Build merged path from all modules based on style
      const allModules = [...qrData.qrModules, ...qrData.noiseModules];
      let mergedPathData: string;
      if (style === "circles") {
        mergedPathData = buildCircularMergedPath(allModules);
      } else if (style === "lines") {
        mergedPathData = buildLinesMergedPath(allModules);
      } else {
        mergedPathData = buildMergedPath(allModules);
      }
      
      // Convert to Path2D for clipping
      const clipPath = svgPathToPath2D(mergedPathData, scale, vb.min_x, vb.min_y);
      
      // Draw the image clipped to the merged shape
      ctx.save();
      ctx.clip(clipPath);
      ctx.drawImage(imgCanvas, 0, 0);
      ctx.restore();
      
      // Calculate average luminance of the clipped area
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
      
      // Apply a single overlay for contrast over the entire clipped region
      ctx.save();
      ctx.clip(clipPath);
      if (avgLuminance > 0.5) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      
      // Draw finder and alignment patterns on top based on style
      if (style === "circles") {
        drawCircularPatterns(ctx, qrData, scale, vb.min_x, vb.min_y);
      } else if (style === "lines") {
        drawLinesPatterns(ctx, qrData, scale, vb.min_x, vb.min_y);
      } else {
        drawPatterns(ctx, qrData, scale, vb.min_x, vb.min_y);
      }
      
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

export function usePyodide() {
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initStarted = useRef(false);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    async function init() {
      try {
        // Load pyodide from CDN
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js";
        document.head.appendChild(script);

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Pyodide"));
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loadPyodide = (window as any).loadPyodide;
        const py = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/",
        });

        // Install dependencies
        await py.loadPackage(["micropip", "numpy"]);
        const micropip = py.pyimport("micropip");
        await micropip.install(["qrcode"]);

        // Fetch and run the Python code in dependency order
        const basePath = process.env.NODE_ENV === "production" ? "/qr_shapes" : "";
        
        const pythonFiles = [
          "shapes/base_shape.py",
          "shapes/square.py",
          "shapes/circle.py",
          "shapes/diamond.py",
          "shapes/hexagon.py",
          "shapes/triangle.py",
          "shapes/heart.py",
          "qr_generator.py",
        ];
        
        for (const file of pythonFiles) {
          const response = await fetch(`${basePath}/${file}`);
          const code = await response.text();
          await py.runPythonAsync(code);
        }

        setPyodide(py);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Pyodide");
        setLoading(false);
      }
    }

    init();
  }, []);

  const generateQRData = useCallback(
    async (
      url: string,
      shape: string,
      rotation: number
    ): Promise<QRData> => {
      if (!pyodide) throw new Error("Pyodide not loaded");
      
      const result = await pyodide.runPythonAsync(
        `generate_qr_data("${url}", "${shape}", ${rotation})`
      );
      return JSON.parse(result as string);
    },
    [pyodide]
  );

  const generateSVG = useCallback(
    async (
      url: string,
      shape: string,
      resolution: number,
      rotation: number,
      fill: string,
      style: ModuleStyle = "blocks"
    ): Promise<string> => {
      const qrData = await generateQRData(url, shape, rotation);
      return buildSVG(qrData, resolution, fill, style);
    },
    [generateQRData]
  );

  const generatePNG = useCallback(
    async (
      url: string,
      shape: string,
      resolution: number,
      rotation: number,
      fill: string,
      style: ModuleStyle = "blocks"
    ): Promise<string> => {
      const qrData = await generateQRData(url, shape, rotation);
      const isImage = fill.startsWith("data:image");
      
      if (isImage) {
        // Use canvas-based rendering with contrast-aware modules
        return renderQRWithImage(qrData, fill, resolution, style);
      } else {
        // Generate SVG and convert to PNG
        const svg = buildSVG(qrData, resolution, fill, style);
        return svgToPngBase64(svg);
      }
    },
    [generateQRData]
  );

  return { loading, error, generatePNG, generateSVG, generateQRData };
}
