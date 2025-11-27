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
 * Build SVG string from QR data coordinates.
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

  // Build all rect elements
  const allModules = [...qrData.qrModules, ...qrData.noiseModules];
  const rects = allModules
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${svgWidth}" height="${svgHeight}" viewBox="${vbStr}">
  ${patternDef}
  <rect x="${vb.min_x}" y="${vb.min_y}" width="${vb.width}" height="${vb.height}" fill="white"/>
  <g fill="${fillAttr}">
    ${rects}
  </g>
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
 * Render QR code with image showing only within the shape boundary.
 * The image is visible through the QR modules and noise modules,
 * with contrast-aware darkening/lightening for scanability.
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
      
      // Create a temporary canvas to get image data
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
      
      // Start with white background (areas outside shape will stay white)
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Helper to convert viewbox coords to canvas coords
      const toCanvasX = (x: number) => (x - vb.min_x) * scale;
      const toCanvasY = (y: number) => (y - vb.min_y) * scale;
      const moduleSize = scale; // Each module is 1 unit in viewbox coords
      
      // All modules (QR + noise) define where the image is visible
      const allModules = [...qrData.qrModules, ...qrData.noiseModules];
      
      for (const [mx, my] of allModules) {
        const canvasX = toCanvasX(mx);
        const canvasY = toCanvasY(my);
        
        // Get luminance of the region under this module
        const luminance = getRegionLuminance(
          imageData,
          canvasX,
          canvasY,
          moduleSize,
          moduleSize
        );
        
        // First, draw the image portion for this module
        ctx.drawImage(
          imgCanvas,
          canvasX, canvasY, moduleSize, moduleSize,  // Source rect
          canvasX, canvasY, moduleSize, moduleSize   // Dest rect
        );
        
        // Then overlay a semi-transparent layer for contrast
        // If background is light, darken it; if dark, lighten it
        if (luminance > 0.5) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        }
        ctx.fillRect(canvasX, canvasY, moduleSize, moduleSize);
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
