"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

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
        await py.loadPackage("micropip");
        const micropip = py.pyimport("micropip");
        await micropip.install(["qrcode", "pillow"]);

        // Fetch and run the Python code
        const basePath = process.env.NODE_ENV === "production" ? "/qr_shapes" : "";
        const response = await fetch(`${basePath}/qr_generator.py`);
        const pythonCode = await response.text();
        await py.runPythonAsync(pythonCode);

        setPyodide(py);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Pyodide");
        setLoading(false);
      }
    }

    init();
  }, []);

  const generatePNG = useCallback(
    async (url: string, resolution: number, rotation: number): Promise<string> => {
      if (!pyodide) throw new Error("Pyodide not loaded");
      const result = await pyodide.runPythonAsync(
        `generate_hexagon_qr_png("${url}", ${resolution}, ${rotation})`
      );
      return result as string;
    },
    [pyodide]
  );

  const generateSVG = useCallback(
    async (url: string, resolution: number, rotation: number): Promise<string> => {
      if (!pyodide) throw new Error("Pyodide not loaded");
      const result = await pyodide.runPythonAsync(
        `generate_hexagon_qr_svg("${url}", ${resolution}, ${rotation})`
      );
      return result as string;
    },
    [pyodide]
  );

  return { loading, error, generatePNG, generateSVG };
}
