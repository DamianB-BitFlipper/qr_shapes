"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { QRData, ModuleStyle } from "../lib/qr/types";
import { buildSVG, svgToPngBase64 } from "../lib/qr/svgBuilder";
import { renderQRWithImage } from "../lib/qr/canvasRendering";

// Re-export types for convenience
export type { QRData, ModuleStyle } from "../lib/qr/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

/**
 * Hook for loading Pyodide and generating QR codes.
 * This is a thin shim layer between Python (Pyodide) and the frontend.
 */
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

  /**
   * Generate QR data from Python.
   */
  const generateQRData = useCallback(
    async (url: string, shape: string, rotation: number): Promise<QRData> => {
      if (!pyodide) throw new Error("Pyodide not loaded");
      
      const result = await pyodide.runPythonAsync(
        `generate_qr_data("${url}", "${shape}", ${rotation})`
      );
      return JSON.parse(result as string);
    },
    [pyodide]
  );

  /**
   * Generate SVG string for a QR code.
   */
  const generateSVG = useCallback(
    async (
      url: string,
      shape: string,
      resolution: number,
      rotation: number,
      fill: string,
      style: ModuleStyle = "blocks",
      transparentBg: boolean = false
    ): Promise<string> => {
      const qrData = await generateQRData(url, shape, rotation);
      return buildSVG(qrData, resolution, fill, style, transparentBg);
    },
    [generateQRData]
  );

  /**
   * Generate PNG base64 for a QR code.
   */
  const generatePNG = useCallback(
    async (
      url: string,
      shape: string,
      resolution: number,
      rotation: number,
      fill: string,
      style: ModuleStyle = "blocks",
      transparentBg: boolean = false
    ): Promise<string> => {
      const qrData = await generateQRData(url, shape, rotation);
      const isImage = fill.startsWith("data:image");
      
      if (isImage) {
        // Use canvas-based rendering with contrast-aware modules
        return renderQRWithImage(qrData, fill, resolution, style, transparentBg);
      } else {
        // Generate SVG and convert to PNG
        const svg = buildSVG(qrData, resolution, fill, style, transparentBg);
        return svgToPngBase64(svg);
      }
    },
    [generateQRData]
  );

  return { loading, error, generatePNG, generateSVG, generateQRData };
}
