"use client";

import { useState } from "react";
import { usePyodide } from "./hooks/usePyodide";

type Shape = "hexagon";

interface ShapeConfig {
  getPoints: (size: number, cx: number, cy: number) => string;
  presets: { label: string; value: number }[];
}

const shapeConfigs: Record<Shape, ShapeConfig> = {
  hexagon: {
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
};

function ShapePreview({ shape, rotation }: { shape: Shape; rotation: number }) {
  const size = 20;
  const cx = 20;
  const cy = 20;
  const points = shapeConfigs[shape].getPoints(size, cx, cy);

  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <polygon
        points={points}
        fill="#18181b"
        transform={`rotate(${rotation}, ${cx}, ${cy})`}
      />
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

  const handleGenerate = async () => {
    if (!url.trim()) return;

    setGenerating(true);
    setGenError(null);

    try {
      const base64 = await generatePNG(url, resolution, rotation);
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
      const base64 = await generatePNG(url, resolution, rotation);
      const link = document.createElement("a");
      link.href = `data:image/png;base64,${base64}`;
      link.download = "qr-hexagon.png";
      link.click();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to download PNG");
    }
  };

  const handleDownloadSVG = async () => {
    if (!url.trim()) return;

    try {
      const svg = await generateSVG(url, resolution, rotation);
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "qr-hexagon.svg";
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
            Hexagon QR Generator
          </h1>
          <p className="text-zinc-600">
            Generate high-definition QR codes with a unique hexagon design
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

              <div className="flex items-center gap-4">
                <ShapePreview shape="hexagon" rotation={rotation} />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="rotation"
                      className="text-sm font-medium text-zinc-700"
                    >
                      Rotation:
                    </label>
                    <input
                      id="rotation-number"
                      type="number"
                      min="0"
                      max="360"
                      value={rotation}
                      onChange={(e) => setRotation(Number(e.target.value) % 360)}
                      className="w-16 px-2 py-1 rounded border border-zinc-300 text-zinc-900 text-sm"
                    />
                    <span className="text-sm text-zinc-500">°</span>
                  </div>
                  <input
                    id="rotation"
                    type="range"
                    min="0"
                    max="360"
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex flex-wrap gap-2">
                    {shapeConfigs.hexagon.presets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setRotation(preset.value)}
                        className={`px-2 py-1 text-xs rounded border transition ${
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
              </div>

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
