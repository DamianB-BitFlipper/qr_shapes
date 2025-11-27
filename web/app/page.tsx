"use client";

import { useState, useRef } from "react";
import { usePyodide, ModuleStyle } from "./hooks/usePyodide";

type Shape = "square" | "circle" | "diamond" | "hexagon" | "triangle" | "heart";
type FillMode = "color" | "image";

interface ShapeConfig {
  label: string;
  getPoints: (size: number, cx: number, cy: number) => string;
  presets: { label: string; value: number }[];
  usePath?: boolean; // If true, getPoints returns a path 'd' attribute instead of polygon points
}

const shapeConfigs: Record<Shape, ShapeConfig> = {
  square: {
    label: "Square",
    getPoints: (size, cx, cy) => {
      // Square centered at (cx, cy)
      return [
        `${cx - size},${cy - size}`,
        `${cx + size},${cy - size}`,
        `${cx + size},${cy + size}`,
        `${cx - size},${cy + size}`,
      ].join(" ");
    },
    presets: [
      { label: "Flat", value: 0 },
      { label: "Diamond", value: 45 },
    ],
  },
  circle: {
    label: "Circle",
    usePath: true,
    getPoints: (size, cx, cy) => {
      // Circle as SVG path using two arcs
      // M (cx-r, cy) - start at left
      // A rx ry x-axis-rotation large-arc-flag sweep-flag (cx+r, cy) - top arc
      // A rx ry x-axis-rotation large-arc-flag sweep-flag (cx-r, cy) - bottom arc
      // Z - close path
      return `M ${cx - size} ${cy} A ${size} ${size} 0 1 1 ${cx + size} ${cy} A ${size} ${size} 0 1 1 ${cx - size} ${cy} Z`;
    },
    presets: [], // No rotation presets for circle
  },
  diamond: {
    label: "Diamond",
    getPoints: (size, cx, cy) => {
      // Gem diamond shape: flat top, angled corners, point at bottom
      // Proportions matching the Python implementation
      const topHalfWidth = 0.5;
      const fullHalfWidth = 0.95;
      const topY = -0.65;
      const cornerY = -0.35;
      const bottomY = 0.75;
      
      return [
        `${cx - topHalfWidth * size},${cy + topY * size}`,     // Top left
        `${cx + topHalfWidth * size},${cy + topY * size}`,     // Top right
        `${cx + fullHalfWidth * size},${cy + cornerY * size}`, // Right corner
        `${cx},${cy + bottomY * size}`,                         // Bottom point
        `${cx - fullHalfWidth * size},${cy + cornerY * size}`, // Left corner
      ].join(" ");
    },
    presets: [
      { label: "Point Down", value: 0 },
      { label: "Point Up", value: 180 },
      { label: "Point Right", value: 270 },
      { label: "Point Left", value: 90 },
    ],
  },
  hexagon: {
    label: "Hexagon",
    getPoints: (size, cx, cy) => {
      // Flat-bottom hexagon (matches Python's point_in_hexagon)
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60) * (Math.PI / 180); // Start from right, flat bottom
        points.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
      }
      return points.join(" ");
    },
    presets: [
      { label: "Flat Bottom", value: 0 },
      { label: "Pointed Top", value: 30 },
      { label: "45°", value: 45 },
      { label: "60°", value: 60 },
      { label: "90°", value: 90 },
    ],
  },
  triangle: {
    label: "Triangle",
    getPoints: (size, cx, cy) => {
      // Equilateral triangle with point up (matches Python's Triangle)
      const points = [];
      for (let i = 0; i < 3; i++) {
        // Start at -90° (top), then 30°, 150°
        const angle = (-90 + i * 120) * (Math.PI / 180);
        points.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
      }
      return points.join(" ");
    },
    presets: [
      { label: "Point Up", value: 0 },
      { label: "Point Right", value: 90 },
      { label: "Point Down", value: 180 },
      { label: "Point Left", value: 270 },
    ],
  },
  heart: {
    label: "Heart",
    usePath: true,
    getPoints: (size, cx, cy) => {
      // Heart curve: x = 16sin³(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
      // Scaled to fit in size, with point down at 0° rotation (classic heart ❤️)
      const scale = size / 17;
      const points = [];
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * 2 * Math.PI;
        const sinT = Math.sin(t);
        const cosT = Math.cos(t);
        const x = 16 * Math.pow(sinT, 3);
        // Negative y to flip heart so lobes are at top, point at bottom
        const y = -(13 * cosT - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const px = cx + x * scale;
        const py = cy + y * scale;
        points.push(i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`);
      }
      return points.join(" ") + " Z";
    },
    presets: [
      { label: "Point Down", value: 0 },
      { label: "Point Right", value: 90 },
      { label: "Point Up", value: 180 },
      { label: "Point Left", value: 270 },
    ],
  },
};

const shapeList: Shape[] = ["square", "circle", "diamond", "hexagon", "triangle", "heart"];

function ShapePreview({
  shape,
  rotation,
  color,
}: {
  shape: Shape;
  rotation: number;
  color: string;
}) {
  const size = 20;
  const cx = 20;
  const cy = 20;
  const config = shapeConfigs[shape];
  const points = config.getPoints(size, cx, cy);

  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {config.usePath ? (
        <path
          d={points}
          fill={color}
          transform={`rotate(${rotation}, ${cx}, ${cy})`}
        />
      ) : (
        <polygon
          points={points}
          fill={color}
          transform={`rotate(${rotation}, ${cx}, ${cy})`}
        />
      )}
    </svg>
  );
}

export default function Home() {
  const { loading, error, generatePNG, generateSVG } = usePyodide();
  const [url, setUrl] = useState("");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [resolution, setResolution] = useState(1000);
  const [rotation, setRotation] = useState(0);
  const [shape, setShape] = useState<Shape>("square");
  const [color, setColor] = useState("#000000");
  const [fillMode, setFillMode] = useState<FillMode>("color");
  const [fillImage, setFillImage] = useState<string | null>(null);
  const [moduleStyle, setModuleStyle] = useState<ModuleStyle>("blocks");
  const [transparentBg, setTransparentBg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      img.onload = () => {
        // Validate square image
        if (img.width !== img.height) {
          setGenError(`Image must be square. Got ${img.width}x${img.height}`);
          return;
        }
        setFillImage(dataUrl);
        setFillMode("image");
        setGenError(null);
      };
      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setFillImage(null);
    setFillMode("color");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!url.trim()) return;

    setGenerating(true);
    setGenError(null);

    try {
      const fill = fillMode === "image" && fillImage ? fillImage : color;
      const base64 = await generatePNG(url, shape, resolution, rotation, fill, moduleStyle, transparentBg);
      setQrImage(`data:image/png;base64,${base64}`);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to generate QR");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (!url.trim()) return;

    try {
      const fill = fillMode === "image" && fillImage ? fillImage : color;
      const base64 = await generatePNG(url, shape, resolution, rotation, fill, moduleStyle, transparentBg);
      const link = document.createElement("a");
      link.href = `data:image/png;base64,${base64}`;
      link.download = `qr-${shape}.png`;
      link.click();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to download PNG");
    }
  };

  const handleDownloadSVG = async () => {
    if (!url.trim()) return;

    try {
      const fill = fillMode === "image" && fillImage ? fillImage : color;
      const svg = await generateSVG(url, shape, resolution, rotation, fill, moduleStyle, transparentBg);
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `qr-${shape}.svg`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to download SVG");
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-red-500 text-center">
          <h1 className="text-xl font-bold mb-2">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-8">
      <main className="w-full max-w-2xl flex flex-col gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            Shape QR Generator
          </h1>
          <p className="text-zinc-600">
            Generate high-definition QR codes with unique shape designs
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-300 border-t-zinc-900"></div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm">
              <div>
                <label
                  htmlFor="url"
                  className="block text-sm font-medium text-zinc-700 mb-2"
                >
                  URL
                </label>
                <input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter your URL here..."
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:ring-2 focus:ring-zinc-500 focus:border-transparent outline-none transition"
                />
              </div>

              {/* Shape Selection */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700">
                    Shape
                  </label>
                </div>
                
                {/* Shape Grid */}
                <div className="grid grid-cols-6 gap-2">
                  {shapeList.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setShape(s);
                        setRotation(0);
                      }}
                      className={`aspect-square p-2 rounded-lg border-2 transition flex items-center justify-center ${
                        shape === s
                          ? "border-zinc-900 bg-zinc-50"
                          : "border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50"
                      }`}
                      title={shapeConfigs[s].label}
                    >
                      <svg viewBox="0 0 40 40" className="w-full h-full max-w-[32px] max-h-[32px]">
                        {shapeConfigs[s].usePath ? (
                          <path
                            d={shapeConfigs[s].getPoints(18, 20, 20)}
                            fill={shape === s ? color : "#a1a1aa"}
                          />
                        ) : (
                          <polygon
                            points={shapeConfigs[s].getPoints(18, 20, 20)}
                            fill={shape === s ? color : "#a1a1aa"}
                          />
                        )}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Module Style Selection */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-zinc-700">
                  Module Style
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModuleStyle("blocks")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition ${
                      moduleStyle === "blocks"
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      <rect x="2" y="2" width="8" height="8" fill={moduleStyle === "blocks" ? color : "#a1a1aa"} />
                      <rect x="14" y="2" width="8" height="8" fill={moduleStyle === "blocks" ? color : "#a1a1aa"} />
                      <rect x="2" y="14" width="8" height="8" fill={moduleStyle === "blocks" ? color : "#a1a1aa"} />
                      <rect x="14" y="14" width="8" height="8" fill={moduleStyle === "blocks" ? color : "#a1a1aa"} />
                    </svg>
                    <span className="text-sm text-zinc-700">Blocks</span>
                  </button>
                  <button
                    onClick={() => setModuleStyle("circles")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition ${
                      moduleStyle === "circles"
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      <circle cx="6" cy="6" r="4" fill={moduleStyle === "circles" ? color : "#a1a1aa"} />
                      <circle cx="18" cy="6" r="4" fill={moduleStyle === "circles" ? color : "#a1a1aa"} />
                      <circle cx="6" cy="18" r="4" fill={moduleStyle === "circles" ? color : "#a1a1aa"} />
                      <circle cx="18" cy="18" r="4" fill={moduleStyle === "circles" ? color : "#a1a1aa"} />
                    </svg>
                    <span className="text-sm text-zinc-700">Dots</span>
                  </button>
                  <button
                    onClick={() => setModuleStyle("lines")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition ${
                      moduleStyle === "lines"
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      <rect x="2" y="2" width="20" height="8" rx="4" fill={moduleStyle === "lines" ? color : "#a1a1aa"} />
                      <rect x="2" y="14" width="8" height="8" rx="4" fill={moduleStyle === "lines" ? color : "#a1a1aa"} />
                      <rect x="14" y="14" width="8" height="8" rx="4" fill={moduleStyle === "lines" ? color : "#a1a1aa"} />
                    </svg>
                    <span className="text-sm text-zinc-700">Lines</span>
                  </button>
                </div>
              </div>

              {/* Fill Selection (Color or Image) */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-zinc-700">
                  Fill
                </label>
                <div className="flex items-center gap-3">
                  {/* Color option */}
                  <button
                    onClick={() => setFillMode("color")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition ${
                      fillMode === "color"
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <input
                      id="color"
                      type="color"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        setFillMode("color");
                      }}
                      className="w-6 h-6 rounded cursor-pointer border border-zinc-300"
                    />
                    <span className="text-sm text-zinc-700">Color</span>
                  </button>

                  {/* Image option */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="fill-image"
                  />
                  {fillImage ? (
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition ${
                        fillMode === "image"
                          ? "border-zinc-900 bg-zinc-50"
                          : "border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      <button
                        onClick={() => setFillMode("image")}
                        className="flex items-center gap-2"
                      >
                        <img
                          src={fillImage}
                          alt="Fill pattern"
                          className="w-6 h-6 rounded object-cover"
                        />
                        <span className="text-sm text-zinc-700">Image</span>
                      </button>
                      <button
                        onClick={handleRemoveImage}
                        className="text-zinc-400 hover:text-zinc-600 text-sm"
                        title="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-zinc-300 hover:border-zinc-400 transition"
                    >
                      <div className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs">
                        +
                      </div>
                      <span className="text-sm text-zinc-500">Upload Image</span>
                    </button>
                  )}
                </div>
                {fillMode === "image" && (
                  <p className="text-xs text-zinc-500">
                    Image will show through where QR modules are black
                  </p>
                )}
              </div>

              {/* Transparent Background */}
              <div className="flex items-center gap-3">
                <input
                  id="transparent-bg"
                  type="checkbox"
                  checked={transparentBg}
                  onChange={(e) => setTransparentBg(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
                />
                <label
                  htmlFor="transparent-bg"
                  className="text-sm text-zinc-700 cursor-pointer select-none"
                >
                  Transparent background
                </label>
              </div>

              {/* Rotation Controls - only show if shape has rotation presets */}
              {shapeConfigs[shape].presets.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700">
                    Rotation
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="rotation-number"
                      type="number"
                      min="0"
                      max="360"
                      value={rotation}
                      onChange={(e) => setRotation(Number(e.target.value) % 360)}
                      className="w-14 px-2 py-1 rounded border border-zinc-300 text-zinc-900 text-sm text-right"
                    />
                    <span className="text-sm text-zinc-500">°</span>
                  </div>
                </div>
                
                {/* Slider with preview */}
                <div className="flex items-center gap-3">
                  <input
                    id="rotation"
                    type="range"
                    min="0"
                    max="360"
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="flex-1"
                  />
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                    <ShapePreview shape={shape} rotation={rotation} color={color} />
                  </div>
                </div>
                
                {/* Preset buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {shapeConfigs[shape].presets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setRotation(preset.value)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition ${
                        rotation === preset.value
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "border-zinc-300 text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating || !url.trim()}
                className="w-full py-3 px-6 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {generating ? "Generating..." : "Generate QR Code"}
              </button>

              {genError && (
                <p className="text-red-500 text-sm text-center">{genError}</p>
              )}
            </div>

            {qrImage && (
              <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-xl shadow-sm">
                <div className="flex flex-wrap items-center justify-center gap-4 w-full">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="resolution"
                      className="text-sm text-zinc-700"
                    >
                      Resolution:
                    </label>
                    <input
                      id="resolution"
                      type="number"
                      min="100"
                      max="4000"
                      step="100"
                      value={resolution}
                      onChange={(e) => setResolution(Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded border border-zinc-300 text-zinc-900 text-sm"
                    />
                    <span className="text-sm text-zinc-500">px</span>
                  </div>
                  <button
                    onClick={handleDownloadPNG}
                    className="py-2 px-4 border border-zinc-300 text-zinc-700 font-medium rounded-lg hover:bg-zinc-100 transition"
                  >
                    Download PNG
                  </button>
                  <button
                    onClick={handleDownloadSVG}
                    className="py-2 px-4 border border-zinc-300 text-zinc-700 font-medium rounded-lg hover:bg-zinc-100 transition"
                  >
                    Download SVG
                  </button>
                </div>
                <img
                  src={qrImage}
                  alt="Generated QR Code"
                  className="max-w-full h-auto"
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
