"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

// Python code for QR generation
const QR_GENERATOR_CODE = `
import base64
import io
import math
import random

import qrcode
from PIL import Image, ImageDraw
from qrcode.constants import ERROR_CORRECT_H


def generate_qr_matrix(url: str, box_size: int = 20):
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=box_size,
        border=0,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    return qr, img.convert("RGB")


def point_in_hexagon(x: float, y: float, cx: float, cy: float, size: float) -> bool:
    dx = abs(x - cx)
    dy = abs(y - cy)
    h = size * math.sqrt(3) / 2
    if dx > size or dy > h:
        return False
    if dx <= size / 2:
        return True
    return dy <= h * 2 * (1 - dx / size)


def image_to_base64(img):
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def generate_hexagon_qr(url: str, box_size: int = 20) -> str:
    qr, qr_img = generate_qr_matrix(url, box_size)
    qr_width, qr_height = qr_img.size
    qr_modules = qr.modules_count

    padding_modules = 4
    total_modules = qr_modules + 2 * padding_modules

    hex_size = (total_modules * box_size) / 1.5
    hex_width = 2 * hex_size
    hex_height = hex_size * math.sqrt(3)

    # Add extra padding to canvas to ensure hexagon points aren't cut off
    canvas_width = int(math.ceil((hex_width + 4 * box_size) / box_size) * box_size)
    canvas_height = int(math.ceil((hex_height + 4 * box_size) / box_size) * box_size)

    cx = canvas_width / 2
    cy = canvas_height / 2

    qr_x = int(round((cx - qr_width / 2) / box_size) * box_size)
    qr_y = int(round((cy - qr_height / 2) / box_size) * box_size)

    canvas = Image.new("RGB", (canvas_width, canvas_height), "white")
    draw = ImageDraw.Draw(canvas)

    qr_start_module_x = qr_x // box_size
    qr_start_module_y = qr_y // box_size
    qr_end_module_x = qr_start_module_x + qr_modules
    qr_end_module_y = qr_start_module_y + qr_modules

    num_modules_x = canvas_width // box_size
    num_modules_y = canvas_height // box_size

    for module_y in range(num_modules_y):
        for module_x in range(num_modules_x):
            px = module_x * box_size
            py = module_y * box_size

            module_cx = px + box_size / 2
            module_cy = py + box_size / 2

            if not point_in_hexagon(module_cx, module_cy, cx, cy, hex_size):
                continue

            if (qr_start_module_x <= module_x < qr_end_module_x and
                qr_start_module_y <= module_y < qr_end_module_y):
                continue

            random.seed(module_x * 10000 + module_y)
            color = "black" if random.random() > 0.5 else "white"
            draw.rectangle([px, py, px + box_size - 1, py + box_size - 1], fill=color)

    canvas.paste(qr_img, (qr_x, qr_y))

    # Add padding to ensure hexagon points aren't cut off
    min_x = int(cx - hex_size) - box_size
    max_x = int(cx + hex_size) + box_size
    min_y = int(cy - hex_height / 2) - box_size
    max_y = int(cy + hex_height / 2) + box_size

    # Align to grid and clamp to canvas bounds
    min_x = max(0, (min_x // box_size) * box_size)
    min_y = max(0, (min_y // box_size) * box_size)
    max_x = min(canvas_width, ((max_x + box_size - 1) // box_size) * box_size)
    max_y = min(canvas_height, ((max_y + box_size - 1) // box_size) * box_size)

    canvas = canvas.crop((min_x, min_y, max_x, max_y))
    return image_to_base64(canvas)


def generate_qr(url: str, box_size: int = 20) -> str:
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=box_size,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    return image_to_base64(img.convert("RGB"))
`;

export function usePyodide() {
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const initStarted = useRef(false);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    async function init() {
      try {
        setLoadingStatus("Loading Pyodide runtime...");

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

        setLoadingStatus("Installing Python packages...");
        await py.loadPackage("micropip");
        const micropip = py.pyimport("micropip");
        await micropip.install(["qrcode", "pillow"]);

        setLoadingStatus("Loading QR generator...");
        await py.runPythonAsync(QR_GENERATOR_CODE);

        setPyodide(py);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Pyodide");
        setLoading(false);
      }
    }

    init();
  }, []);

  const generateQR = useCallback(
    async (
      url: string,
      hexagon: boolean = true,
      boxSize: number = 20
    ): Promise<string> => {
      if (!pyodide) throw new Error("Pyodide not loaded");

      const funcName = hexagon ? "generate_hexagon_qr" : "generate_qr";
      const result = await pyodide.runPythonAsync(
        `${funcName}("${url}", ${boxSize})`
      );
      return result as string;
    },
    [pyodide]
  );

  return { pyodide, loading, loadingStatus, error, generateQR };
}
