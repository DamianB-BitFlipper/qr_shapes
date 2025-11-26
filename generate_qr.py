#!/usr/bin/env python3
"""Generate high-definition QR code PNG from a URL."""

import argparse
import qrcode
from qrcode.constants import ERROR_CORRECT_H


def generate_qr(url: str, output: str = "qrcode.png", size: int = 20) -> None:
    """
    Generate a high-definition QR code PNG.

    Args:
        url: The URL to encode in the QR code
        output: Output filename (default: qrcode.png)
        size: Box size in pixels (default: 20 for high-def output)
    """
    qr = qrcode.QRCode(
        version=None,  # Auto-determine version based on data
        error_correction=ERROR_CORRECT_H,  # Highest error correction (30%)
        box_size=size,  # Pixels per box
        border=4,  # Standard border size
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

    args = parser.parse_args()
    generate_qr(args.url, args.output, args.size)


if __name__ == "__main__":
    main()
