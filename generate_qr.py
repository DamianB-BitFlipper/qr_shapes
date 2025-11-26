#!/usr/bin/env python3
"""Generate high-definition QR code PNG from a URL, optionally in a hexagon."""

import argparse
import math
import random

import qrcode
from PIL import Image, ImageDraw
from qrcode.constants import ERROR_CORRECT_H


def generate_qr_matrix(url: str, box_size: int = 20):
    """
    Generate a QR code and return the QRCode object and image.

    Returns:
        tuple: (qr_object, pil_image)
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=box_size,
        border=0,  # No border - we'll handle spacing ourselves
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    return qr, img.convert("RGB")


def point_in_hexagon(x: float, y: float, cx: float, cy: float, size: float) -> bool:
    """
    Check if a point (x, y) is inside a flat-bottom hexagon centered at (cx, cy).
    Size is the distance from center to vertex.
    """
    # Translate point to origin
    dx = abs(x - cx)
    dy = abs(y - cy)

    # Flat-bottom hexagon dimensions
    # Width = 2 * size, Height = sqrt(3) * size
    h = size * math.sqrt(3) / 2  # Half height

    # Check bounding box first
    if dx > size or dy > h:
        return False

    # Check against the sloped edges
    # The slope cuts off corners: dy <= h - (h/size * (dx - size/2)) for dx > size/2
    if dx <= size / 2:
        return True

    return dy <= h * 2 * (1 - dx / size)


def generate_hexagon_qr(
    url: str, output: str = "qrcode_hex.png", box_size: int = 20
) -> None:
    """
    Generate a QR code embedded in a hexagon with random dots filling the gaps.
    """
    qr, qr_img = generate_qr_matrix(url, box_size)

    qr_width, qr_height = qr_img.size
    qr_modules = qr.modules_count

    # Calculate hexagon size to fully contain the QR code
    # For a flat-bottom hexagon, we need the inscribed square to fit the QR
    # The QR code should fit comfortably inside
    # Hexagon width = 2 * size, height = sqrt(3) * size
    # We want some padding around the QR code for the random dots

    padding_modules = 4  # Extra modules of random dots around QR
    total_modules = qr_modules + 2 * padding_modules

    # Size the hexagon so the QR code fits inside with padding
    # The limiting factor is usually the width
    hex_size = (total_modules * box_size) / 1.5  # Approximate fit
    hex_width = 2 * hex_size
    hex_height = hex_size * math.sqrt(3)

    # Canvas size (add small margin for clean edges)
    canvas_width = int(hex_width) + 2
    canvas_height = int(hex_height) + 2

    # Center of canvas
    cx = canvas_width / 2
    cy = canvas_height / 2

    # Create white canvas
    canvas = Image.new("RGB", (canvas_width, canvas_height), "white")

    # First, fill the entire hexagon area with random dots
    for py in range(canvas_height):
        for px in range(canvas_width):
            if point_in_hexagon(px, py, cx, cy, hex_size):
                # Determine which "module" this pixel belongs to
                module_x = px // box_size
                module_y = py // box_size

                # Use module coordinates to seed consistent random for each cell
                random.seed(module_x * 10000 + module_y)
                color = "black" if random.random() > 0.5 else "white"

                canvas.putpixel(
                    (px, py), (0, 0, 0) if color == "black" else (255, 255, 255)
                )

    # Now overlay the QR code in the center
    qr_x = int(cx - qr_width / 2)
    qr_y = int(cy - qr_height / 2)
    canvas.paste(qr_img, (qr_x, qr_y))

    # Finally, mask out everything outside the hexagon (make it white)
    for py in range(canvas_height):
        for px in range(canvas_width):
            if not point_in_hexagon(px, py, cx, cy, hex_size):
                canvas.putpixel((px, py), (255, 255, 255))

    canvas.save(output)
    print(f"Hexagon QR code saved to: {output}")
    print(f"Image dimensions: {canvas_width}x{canvas_height} pixels")


def generate_qr(url: str, output: str = "qrcode.png", size: int = 20) -> None:
    """
    Generate a high-definition QR code PNG.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=size,
        border=4,
    )

    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(output)

    print(f"QR code saved to: {output}")
    print(f"Image dimensions: {img.size[0]}x{img.size[1]} pixels")


def main():
    parser = argparse.ArgumentParser(
        description="Generate a high-definition QR code PNG from a URL"
    )
    parser.add_argument("url", help="The URL to encode")
    parser.add_argument(
        "-o",
        "--output",
        default="qrcode.png",
        help="Output filename (default: qrcode.png)",
    )
    parser.add_argument(
        "-s", "--size", type=int, default=20, help="Box size in pixels (default: 20)"
    )
    parser.add_argument(
        "--hex", action="store_true", help="Generate hexagon-shaped QR code"
    )

    args = parser.parse_args()

    if args.hex:
        generate_hexagon_qr(args.url, args.output, args.size)
    else:
        generate_qr(args.url, args.output, args.size)


if __name__ == "__main__":
    main()
