"""QR code generator with pluggable shape support."""

import math
import random

import qrcode
from qrcode.constants import ERROR_CORRECT_H

# Note: In Pyodide, all files are executed in the same global namespace.
# Hexagon and Triangle are available from previously loaded files.


# Available shapes
SHAPES = {
    "hexagon": Hexagon(),
    "triangle": Triangle(),
}


def _generate_svg_data(url: str, shape, rotation: int = 0) -> tuple:
    """Generate QR code SVG data inside a shape.

    The QR code is maximally sized to fit within the shape boundary,
    positioned according to the shape's max_inscribed_square method.

    Args:
        url: URL to encode in the QR code
        shape: Shape implementing QRAble protocol
        rotation: Rotation angle in degrees

    Returns:
        Tuple of (rects_svg, viewbox_dict)
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

    # We want the QR to fill the shape maximally.
    # First, determine a fixed shape size, then find where the QR fits.
    # We'll use the QR module count to set the scale.

    # Get the inscribed square info for a unit-sized shape
    # Then scale everything so the QR (with padding) fits exactly
    padding_modules = 1  # Minimal padding for maximum size
    qr_with_padding = qr_modules + 2 * padding_modules

    # Get inscribed square for unit size, then scale
    _, _, unit_square = shape.max_inscribed_square(1.0, rotation)

    # Scale factor: we want the inscribed square to equal qr_with_padding
    scale = qr_with_padding / unit_square
    shape_size = scale  # Shape size after scaling

    # Now get the actual offset for the scaled shape
    offset_x, offset_y, square_side = shape.max_inscribed_square(shape_size, rotation)

    # Canvas size to fit the shape with margin
    canvas_size = int(math.ceil(shape_size * 2)) + 4

    # Shape center
    cx = canvas_size / 2
    cy = canvas_size / 2

    # QR position: centered within the inscribed square
    qr_center_x = cx + offset_x
    qr_center_y = cy + offset_y
    qr_x = int(round(qr_center_x - qr_modules / 2))
    qr_y = int(round(qr_center_y - qr_modules / 2))

    qr_start_module_x = qr_x
    qr_start_module_y = qr_y
    qr_end_module_x = qr_start_module_x + qr_modules
    qr_end_module_y = qr_start_module_y + qr_modules

    # Build SVG rectangles
    rects = []

    # Add random noise outside QR area but inside shape
    for module_y in range(canvas_size):
        for module_x in range(canvas_size):
            module_cx = module_x + 0.5
            module_cy = module_y + 0.5

            if not shape.point_inside(
                module_cx, module_cy, cx, cy, shape_size, rotation
            ):
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

    # Calculate viewBox
    margin = 2
    min_x = cx - shape_size - margin
    min_y = cy - shape_size - margin
    vb_width = (shape_size + margin) * 2
    vb_height = vb_width

    viewbox = {
        "min_x": min_x,
        "min_y": min_y,
        "width": vb_width,
        "height": vb_height,
    }

    rects_svg = "".join(rects)

    return rects_svg, viewbox


def _build_svg(rects_svg: str, viewbox: dict, resolution: int) -> str:
    """Build complete SVG string from parts."""
    svg_width = resolution
    svg_height = int(resolution * viewbox["height"] / viewbox["width"])

    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="{svg_height}" viewBox="{viewbox["min_x"]} {viewbox["min_y"]} {viewbox["width"]} {viewbox["height"]}">
  <rect x="{viewbox["min_x"]}" y="{viewbox["min_y"]}" width="{viewbox["width"]}" height="{viewbox["height"]}" fill="white"/>
  <g fill="black">
    {rects_svg}
  </g>
</svg>'''


# Public API functions (called from frontend)


def generate_qr_svg(
    url: str, shape_name: str = "hexagon", resolution: int = 1000, rotation: int = 0
) -> str:
    """Generate shaped QR as SVG, returns SVG string."""
    shape = SHAPES.get(shape_name, SHAPES["hexagon"])
    rects_svg, viewbox = _generate_svg_data(url, shape, rotation)
    return _build_svg(rects_svg, viewbox, resolution)
