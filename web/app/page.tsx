"use client";

import { useState } from "react";
import { usePyodide } from "./hooks/usePyodide";

type Shape = "circle" | "hexagon" | "triangle" | "heart";

interface ShapeConfig {
  label: string;
  getPoints: (size: number, cx: number, cy: number) => string;
  presets: { label: string; value: number }[];
  usePath?: boolean; // If true, getPoints returns a path 'd' attribute instead of polygon points
}

const shapeConfigs: Record<Shape, ShapeConfig> = {
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
      // Scaled to fit in size, with point up at 0° rotation
      const scale = size / 17;
      const points = [];
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * 2 * Math.PI;
        const sinT = Math.sin(t);
        const cosT = Math.cos(t);
        const x = 16 * Math.pow(sinT, 3);
        // Negative y to flip heart so it points up
        const y = -(13 * cosT - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const px = cx + x * scale;
        const py = cy + y * scale;
        points.push(i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`);
      }
      return points.join(" ") + " Z";
    },
    presets: [
      { label: "Point Up", value: 0 },
      { label: "Point Right", value: 90 },
      { label: "Point Down", value: 180 },
      { label: "Point Left", value: 270 },
    ],
  },
};

const shapeList: Shape[] = ["circle", "hexagon", "triangle", "heart"];

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
  const [shape, setShape] = useState<Shape>("hexagon");
  const [color, setColor] = useState("#000000");

  const handleGenerate = async () => {
    if (!url.trim()) return;

    setGenerating(true);
    setGenError(null);

    try {
      const base64 = await generatePNG(url, shape, resolution, rotation, color);
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
      const base64 = await generatePNG(url, shape, resolution, rotation, color);
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
      const svg = await generateSVG(url, shape, resolution, rotation, color);
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
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="color"
                      className="text-sm text-zinc-500"
                    >
                      Color
                    </label>
                    <input
                      id="color"
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border border-zinc-300"
                    />
                  </div>
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
