"use client";

import { useState } from "react";
import { usePyodide } from "./hooks/usePyodide";

export default function Home() {
  const { loading, loadingStatus, error, generateQR } = usePyodide();
  const [url, setUrl] = useState("");
  const [hexagon, setHexagon] = useState(true);
  const [boxSize, setBoxSize] = useState(20);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!url.trim()) return;

    setGenerating(true);
    setGenError(null);

    try {
      const base64 = await generateQR(url, hexagon, boxSize);
      setQrImage(`data:image/png;base64,${base64}`);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to generate QR");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!qrImage) return;

    const link = document.createElement("a");
    link.href = qrImage;
    link.download = hexagon ? "qr-hexagon.png" : "qr-code.png";
    link.click();
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

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hexagon}
                    onChange={(e) => setHexagon(e.target.checked)}
                    className="w-5 h-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                  />
                  <span className="text-zinc-700">
                    Hexagon shape
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="boxSize"
                    className="text-sm text-zinc-700"
                  >
                    Size:
                  </label>
                  <input
                    id="boxSize"
                    type="range"
                    min="10"
                    max="40"
                    value={boxSize}
                    onChange={(e) => setBoxSize(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-zinc-600 w-8">
                    {boxSize}
                  </span>
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
                <img
                  src={qrImage}
                  alt="Generated QR Code"
                  className="max-w-full h-auto"
                />
                <button
                  onClick={handleDownload}
                  className="py-2 px-6 border border-zinc-300 text-zinc-700 font-medium rounded-lg hover:bg-zinc-100 transition"
                >
                  Download PNG
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
