/**
 * Shared type definitions for QR code generation.
 */

export type ModuleStyle = "blocks" | "circles" | "squiggles";

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
  qrOrigin: [number, number];
  qrSize: number;
  version: number;
}
