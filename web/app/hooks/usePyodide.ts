"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

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
 * Build SVG string from QR data coordinates.
 * Adjacent modules are merged into unified shapes without visible borders.
 */
function buildSVG(
  qrData: QRData,
  resolution: number,
  fill: string
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

  // Build merged path from all modules
  const allModules = [...qrData.qrModules, ...qrData.noiseModules];
  const mergedPath = buildMergedPath(allModules);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${svgWidth}" height="${svgHeight}" viewBox="${vbStr}">
  ${patternDef}
  <rect x="${vb.min_x}" y="${vb.min_y}" width="${vb.width}" height="${vb.height}" fill="white"/>
  <path d="${mergedPath}" fill="${fillAttr}"/>
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
  const commands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
  
  for (const cmd of commands) {
    const type = cmd[0].toUpperCase();
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
    
    switch (type) {
      case "M":
        path.moveTo((args[0] - offsetX) * scale, (args[1] - offsetY) * scale);
        break;
      case "L":
        path.lineTo((args[0] - offsetX) * scale, (args[1] - offsetY) * scale);
        break;
      case "Z":
        path.closePath();
        break;
    }
  }
  
  return path;
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
  resolution: number
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
      
      // Build merged path from all modules
      const allModules = [...qrData.qrModules, ...qrData.noiseModules];
      const mergedPathData = buildMergedPath(allModules);
      
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
      fill: string
    ): Promise<string> => {
      const qrData = await generateQRData(url, shape, rotation);
      return buildSVG(qrData, resolution, fill);
    },
    [generateQRData]
  );

  const generatePNG = useCallback(
    async (
      url: string,
      shape: string,
      resolution: number,
      rotation: number,
      fill: string
    ): Promise<string> => {
      const qrData = await generateQRData(url, shape, rotation);
      const isImage = fill.startsWith("data:image");
      
      if (isImage) {
        // Use canvas-based rendering with contrast-aware modules
        return renderQRWithImage(qrData, fill, resolution);
      } else {
        // Generate SVG and convert to PNG
        const svg = buildSVG(qrData, resolution, fill);
        return svgToPngBase64(svg);
      }
    },
    [generateQRData]
  );

  return { loading, error, generatePNG, generateSVG, generateQRData };
}
