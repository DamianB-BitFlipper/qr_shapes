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


def _generate_hexagon_qr_image(url: str, box_size: int = 20):
    """Internal function that returns the PIL Image."""
    qr, qr_img = generate_qr_matrix(url, box_size)
    qr_width, qr_height = qr_img.size
    qr_modules = qr.modules_count

    # The QR code (square) must fit inside the hexagon
    # Add padding around the QR code
    padding_modules = 3
    qr_side = qr_modules * box_size
    
    # For a flat-bottom hexagon centered at origin:
    # - "size" = distance from center to vertex (corner point)
    # - Width at middle (y=0) = 2 * size
    # - Height = sqrt(3) * size
    # 
    # The QR code is a square that must fit entirely inside.
    # The constraint is that all 4 corners of the square must be inside the hexagon.
    # For a centered square of side S, corners are at (±S/2, ±S/2).
    # We need point_in_hexagon to return True for these corners.
    # 
    # The hexagon's half-height h = size * sqrt(3) / 2
    # At x = S/2, the hexagon edge is at y = h * 2 * (1 - (S/2) / size) = h * (2 - S/size)
    # We need S/2 <= h * (2 - S/size)
    # S/2 <= size * sqrt(3)/2 * (2 - S/size)
    # S <= size * sqrt(3) * (2 - S/size)
    # S <= 2*sqrt(3)*size - sqrt(3)*S
    # S + sqrt(3)*S <= 2*sqrt(3)*size
    # S * (1 + sqrt(3)) <= 2*sqrt(3)*size
    # size >= S * (1 + sqrt(3)) / (2*sqrt(3))
    # size >= S * (1 + sqrt(3)) / (2*sqrt(3)) ≈ S * 0.789
    # 
    # So hex_size should be about 0.8 * qr_side to just fit.
    # But we also want padding, so we use the padded size.
    
    padded_qr_side = (qr_modules + 2 * padding_modules) * box_size
    hex_size = padded_qr_side * (1 + math.sqrt(3)) / (2 * math.sqrt(3)) * 1.05  # 5% margin
    hex_width = 2 * hex_size
    hex_height = hex_size * math.sqrt(3)

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

    min_x = int(cx - hex_size) - box_size
    max_x = int(cx + hex_size) + box_size
    min_y = int(cy - hex_height / 2) - box_size
    max_y = int(cy + hex_height / 2) + box_size

    min_x = max(0, (min_x // box_size) * box_size)
    min_y = max(0, (min_y // box_size) * box_size)
    max_x = min(canvas_width, ((max_x + box_size - 1) // box_size) * box_size)
    max_y = min(canvas_height, ((max_y + box_size - 1) // box_size) * box_size)

    return canvas.crop((min_x, min_y, max_x, max_y))


def generate_hexagon_qr_png(url: str, resolution: int = 1000) -> str:
    """Generate hexagon QR as PNG with target resolution, returns base64."""
    # Calculate box_size to achieve target resolution
    # Generate at fixed box_size first, then resize
    box_size = 20
    img = _generate_hexagon_qr_image(url, box_size)
    
    # Resize to target resolution (maintaining aspect ratio based on width)
    aspect = img.height / img.width
    new_width = resolution
    new_height = int(resolution * aspect)
    img = img.resize((new_width, new_height), Image.LANCZOS)
    
    return image_to_base64(img)


def generate_hexagon_qr_svg(url: str, resolution: int = 1000) -> str:
    """Generate hexagon QR as native SVG, returns SVG string."""
    # Use box_size of 1 to get module coordinates, then scale
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=1,
        border=0,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    qr_modules = qr.modules_count
    padding_modules = 3
    
    # Calculate hex_size based on QR size (same logic as PNG)
    padded_qr_side = qr_modules + 2 * padding_modules
    hex_size = padded_qr_side * (1 + math.sqrt(3)) / (2 * math.sqrt(3)) * 1.05
    hex_height = hex_size * math.sqrt(3)
    
    canvas_width = int(math.ceil(hex_size * 2)) + 4
    canvas_height = int(math.ceil(hex_height)) + 4
    
    cx = canvas_width / 2
    cy = canvas_height / 2
    
    qr_x = int(round(cx - qr_modules / 2))
    qr_y = int(round(cy - qr_modules / 2))
    
    qr_start_module_x = qr_x
    qr_start_module_y = qr_y
    qr_end_module_x = qr_start_module_x + qr_modules
    qr_end_module_y = qr_start_module_y + qr_modules
    
    # Build SVG
    rects = []
    
    # Add random dots outside QR area
    for module_y in range(canvas_height):
        for module_x in range(canvas_width):
            module_cx = module_x + 0.5
            module_cy = module_y + 0.5
            
            if not point_in_hexagon(module_cx, module_cy, cx, cy, hex_size):
                continue
            
            if (qr_start_module_x <= module_x < qr_end_module_x and
                qr_start_module_y <= module_y < qr_end_module_y):
                continue
            
            random.seed(module_x * 10000 + module_y)
            if random.random() > 0.5:
                rects.append(f'<rect x="{module_x}" y="{module_y}" width="1" height="1"/>')
    
    # Add QR code modules
    matrix = qr.modules
    for row_idx, row in enumerate(matrix):
        for col_idx, is_black in enumerate(row):
            if is_black:
                x = qr_x + col_idx
                y = qr_y + row_idx
                rects.append(f'<rect x="{x}" y="{y}" width="1" height="1"/>')
    
    # Calculate viewBox to crop to hexagon bounds
    min_x = cx - hex_size - 1
    max_x = cx + hex_size + 1
    min_y = cy - hex_height / 2 - 1
    max_y = cy + hex_height / 2 + 1
    vb_width = max_x - min_x
    vb_height = max_y - min_y
    
    svg_width = resolution
    svg_height = int(resolution * vb_height / vb_width)
    
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="{svg_height}" viewBox="{min_x} {min_y} {vb_width} {vb_height}">
  <rect x="{min_x}" y="{min_y}" width="{vb_width}" height="{vb_height}" fill="white"/>
  <g fill="black">
    {"".join(rects)}
  </g>
</svg>'''
    
    return svg
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

  const generatePNG = useCallback(
    async (url: string, resolution: number = 1000): Promise<string> => {
      if (!pyodide) throw new Error("Pyodide not loaded");
      const result = await pyodide.runPythonAsync(
        `generate_hexagon_qr_png("${url}", ${resolution})`
      );
      return result as string;
    },
    [pyodide]
  );

  const generateSVG = useCallback(
    async (url: string, resolution: number = 1000): Promise<string> => {
      if (!pyodide) throw new Error("Pyodide not loaded");
      const result = await pyodide.runPythonAsync(
        `generate_hexagon_qr_svg("${url}", ${resolution})`
      );
      return result as string;
    },
    [pyodide]
  );

  return { pyodide, loading, loadingStatus, error, generatePNG, generateSVG };
}
