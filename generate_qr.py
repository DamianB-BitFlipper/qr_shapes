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
    The random dots align perfectly with the QR code grid.
    """
    qr, qr_img = generate_qr_matrix(url, box_size)

    qr_width, qr_height = qr_img.size
    qr_modules = qr.modules_count

    # Calculate hexagon size to fully contain the QR code
    # Hexagon width = 2 * size, height = sqrt(3) * size
    padding_modules = 4  # Extra modules of random dots around QR
    total_modules = qr_modules + 2 * padding_modules

    # Size the hexagon so the QR code fits inside with padding
    hex_size = (total_modules * box_size) / 1.5  # Approximate fit
    hex_width = 2 * hex_size
    hex_height = hex_size * math.sqrt(3)

    # Canvas size - add extra padding to ensure hexagon points aren't cut off
    canvas_width = int(math.ceil((hex_width + 4 * box_size) / box_size) * box_size)
    canvas_height = int(math.ceil((hex_height + 4 * box_size) / box_size) * box_size)

    # Center of canvas (aligned to grid)
    cx = canvas_width / 2
    cy = canvas_height / 2

    # QR code position - align to grid!
    # Calculate the top-left position such that QR is centered AND aligned to grid
    qr_x = int(round((cx - qr_width / 2) / box_size) * box_size)
    qr_y = int(round((cy - qr_height / 2) / box_size) * box_size)

    # Create white canvas
    canvas = Image.new("RGB", (canvas_width, canvas_height), "white")
    draw = ImageDraw.Draw(canvas)

    # Calculate QR code module boundaries (in grid coordinates)
    qr_start_module_x = qr_x // box_size
    qr_start_module_y = qr_y // box_size
    qr_end_module_x = qr_start_module_x + qr_modules
    qr_end_module_y = qr_start_module_y + qr_modules

    # Fill the hexagon with module-aligned random dots
    num_modules_x = canvas_width // box_size
    num_modules_y = canvas_height // box_size

    for module_y in range(num_modules_y):
        for module_x in range(num_modules_x):
            # Calculate pixel coordinates for this module
            px = module_x * box_size
            py = module_y * box_size

            # Check if center of module is inside hexagon
            module_cx = px + box_size / 2
            module_cy = py + box_size / 2

            if not point_in_hexagon(module_cx, module_cy, cx, cy, hex_size):
                continue

            # Skip if this module is inside the QR code area
            if (
                qr_start_module_x <= module_x < qr_end_module_x
                and qr_start_module_y <= module_y < qr_end_module_y
            ):
                continue

            # Draw random black or white module
            random.seed(module_x * 10000 + module_y)
            color = "black" if random.random() > 0.5 else "white"

            draw.rectangle([px, py, px + box_size - 1, py + box_size - 1], fill=color)

    # Paste the QR code
    canvas.paste(qr_img, (qr_x, qr_y))

    # Crop to tight hexagon bounds (remove excess white space)
    # For a flat-bottom hexagon: width = 2*size, height = sqrt(3)*size
    # Add padding of one module to ensure points aren't cut off
    min_x = int(cx - hex_size) - box_size
    max_x = int(cx + hex_size) + box_size
    min_y = int(cy - hex_height / 2) - box_size
    max_y = int(cy + hex_height / 2) + box_size

    # Align crop to module grid and clamp to canvas bounds
    min_x = max(0, (min_x // box_size) * box_size)
    min_y = max(0, (min_y // box_size) * box_size)
    max_x = min(canvas_width, ((max_x + box_size - 1) // box_size) * box_size)
    max_y = min(canvas_height, ((max_y + box_size - 1) // box_size) * box_size)

    canvas = canvas.crop((min_x, min_y, max_x, max_y))

    canvas.save(output)
    print(f"Hexagon QR code saved to: {output}")
    print(f"Image dimensions: {canvas.size[0]}x{canvas.size[1]} pixels")


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
