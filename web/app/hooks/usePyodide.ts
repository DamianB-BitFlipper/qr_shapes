"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

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

  const generateSVG = useCallback(
    async (
      url: string,
      shape: string,
      resolution: number,
      rotation: number,
      fill: string // Can be a color like "#000000" or a data URL for an image
    ): Promise<string> => {
      if (!pyodide) throw new Error("Pyodide not loaded");
      
      // Check if fill is an image data URL
      const isImage = fill.startsWith("data:image");
      
      if (isImage) {
        // Pass the image data URL to Python for pattern-based fill
        // We need to escape the string properly for Python
        const escapedFill = fill.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const result = await pyodide.runPythonAsync(
          `generate_qr_svg("${url}", "${shape}", ${resolution}, ${rotation}, "${escapedFill}")`
        );
        return result as string;
      } else {
        const result = await pyodide.runPythonAsync(
          `generate_qr_svg("${url}", "${shape}", ${resolution}, ${rotation}, "${fill}")`
        );
        return result as string;
      }
    },
    [pyodide]
  );

  const generatePNG = useCallback(
    async (
      url: string,
      shape: string,
      resolution: number,
      rotation: number,
      color: string
    ): Promise<string> => {
      // Generate SVG first, then convert to PNG using browser canvas
      const svg = await generateSVG(url, shape, resolution, rotation, color);
      return svgToPngBase64(svg);
    },
    [generateSVG]
  );

  return { loading, error, generatePNG, generateSVG };
}
