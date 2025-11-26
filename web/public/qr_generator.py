"""QR code generator with hexagon shape support."""

import base64
import io
import math
import random

import qrcode
from PIL import Image, ImageDraw
from qrcode.constants import ERROR_CORRECT_H


def generate_qr_matrix(url: str, box_size: int = 20):
    """Generate a QR code and return the QRCode object and image."""
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


def point_in_hexagon(
    x: float, y: float, cx: float, cy: float, size: float, rotation_deg: float = 0
) -> bool:
    """Check if point is inside a hexagon, with optional rotation.

    The hexagon rotates around its center, but we achieve this by
    rotating the test point in the opposite direction.
    """
    # Translate point to origin
    px = x - cx
    py = y - cy

    # Rotate point in opposite direction (to simulate hexagon rotation)
    if rotation_deg != 0:
        angle_rad = -math.radians(rotation_deg)
        cos_a = math.cos(angle_rad)
        sin_a = math.sin(angle_rad)
        px, py = px * cos_a - py * sin_a, px * sin_a + py * cos_a

    # Now check against unrotated flat-bottom hexagon
    dx = abs(px)
    dy = abs(py)
    h = size * math.sqrt(3) / 2
    if dx > size or dy > h:
        return False
    if dx <= size / 2:
        return True
    return dy <= h * 2 * (1 - dx / size)


def image_to_base64(img):
    """Convert PIL Image to base64 string."""
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def _generate_hexagon_qr_image(url: str, box_size: int = 20, rotation: int = 0):
    """Internal function that returns the PIL Image.

    The rotation rotates the hexagon boundary, but the QR code and noise
    pattern stay axis-aligned (horizontal/vertical).
    """
    qr, qr_img = generate_qr_matrix(url, box_size)
    qr_width, qr_height = qr_img.size
    qr_modules = qr.modules_count

    # The QR code (square) must fit inside the hexagon
    padding_modules = 3

    # Calculate hex_size to contain the padded QR code
    padded_qr_side = (qr_modules + 2 * padding_modules) * box_size
    hex_size = padded_qr_side * (1 + math.sqrt(3)) / (2 * math.sqrt(3)) * 1.05

    # For rotated hexagon, we need a larger canvas to contain it
    max_dim = hex_size * 2 + 4 * box_size
    canvas_width = int(math.ceil(max_dim / box_size) * box_size)
    canvas_height = canvas_width  # Square canvas for any rotation

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

            # Check if inside rotated hexagon
            if not point_in_hexagon(module_cx, module_cy, cx, cy, hex_size, rotation):
                continue

            if (
                qr_start_module_x <= module_x < qr_end_module_x
                and qr_start_module_y <= module_y < qr_end_module_y
            ):
                continue

            random.seed(module_x * 10000 + module_y)
            color = "black" if random.random() > 0.5 else "white"
            draw.rectangle([px, py, px + box_size - 1, py + box_size - 1], fill=color)

    canvas.paste(qr_img, (qr_x, qr_y))

    # Crop to content
    margin = box_size * 2
    min_x = max(0, int(cx - hex_size - margin))
    max_x = min(canvas_width, int(cx + hex_size + margin))
    min_y = max(0, int(cy - hex_size - margin))
    max_y = min(canvas_height, int(cy + hex_size + margin))

    return canvas.crop((min_x, min_y, max_x, max_y))


def generate_hexagon_qr_png(url: str, resolution: int = 1000, rotation: int = 0) -> str:
    """Generate hexagon QR as PNG with target resolution and rotation, returns base64."""
    box_size = 20
    img = _generate_hexagon_qr_image(url, box_size, rotation)

    # Resize to target resolution (maintaining aspect ratio based on width)
    aspect = img.height / img.width
    new_width = resolution
    new_height = int(resolution * aspect)
    img = img.resize((new_width, new_height), Image.LANCZOS)

    return image_to_base64(img)


def generate_hexagon_qr_svg(url: str, resolution: int = 1000, rotation: int = 0) -> str:
    """Generate hexagon QR as native SVG with rotation, returns SVG string.

    The rotation rotates the hexagon boundary, but the QR code and noise
    pattern stay axis-aligned (horizontal/vertical).
    """
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

    # Square canvas for any rotation
    canvas_size = int(math.ceil(hex_size * 2)) + 4

    cx = canvas_size / 2
    cy = canvas_size / 2

    qr_x = int(round(cx - qr_modules / 2))
    qr_y = int(round(cy - qr_modules / 2))

    qr_start_module_x = qr_x
    qr_start_module_y = qr_y
    qr_end_module_x = qr_start_module_x + qr_modules
    qr_end_module_y = qr_start_module_y + qr_modules

    # Build SVG
    rects = []

    # Add random dots outside QR area (using rotated hexagon boundary)
    for module_y in range(canvas_size):
        for module_x in range(canvas_size):
            module_cx = module_x + 0.5
            module_cy = module_y + 0.5

            # Check against rotated hexagon
            if not point_in_hexagon(module_cx, module_cy, cx, cy, hex_size, rotation):
                continue

            if (
                qr_start_module_x <= module_x < qr_end_module_x
                and qr_start_module_y <= module_y < qr_end_module_y
            ):
                continue

            random.seed(module_x * 10000 + module_y)
            if random.random() > 0.5:
                rects.append(
                    f'<rect x="{module_x}" y="{module_y}" width="1" height="1"/>'
                )

    # Add QR code modules
    matrix = qr.modules
    for row_idx, row in enumerate(matrix):
        for col_idx, is_black in enumerate(row):
            if is_black:
                x = qr_x + col_idx
                y = qr_y + row_idx
                rects.append(f'<rect x="{x}" y="{y}" width="1" height="1"/>')

    # Calculate viewBox - use square for rotated hexagon
    margin = 2
    min_x = cx - hex_size - margin
    max_x = cx + hex_size + margin
    min_y = cy - hex_size - margin
    max_y = cy + hex_size + margin
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
