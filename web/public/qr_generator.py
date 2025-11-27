"""QR code generator with pluggable shape support."""

import json
import math
import random
from typing import Dict, List

import qrcode
from qrcode.constants import ERROR_CORRECT_H

# Note: In Pyodide, all files are executed in the same global namespace.
# BaseShape, Square, Circle, Diamond, Hexagon, Triangle, and Heart are available
# from previously loaded files.


# Available shapes
SHAPES: Dict[str, "BaseShape"] = {  # type: ignore[name-defined]
    "square": Square(),  # type: ignore[name-defined]
    "circle": Circle(),  # type: ignore[name-defined]
    "diamond": Diamond(),  # type: ignore[name-defined]
    "hexagon": Hexagon(),  # type: ignore[name-defined]
    "triangle": Triangle(),  # type: ignore[name-defined]
    "heart": Heart(),  # type: ignore[name-defined]
}


def generate_qr_data(
    url: str,
    shape_name: str = "hexagon",
    rotation: int = 0,
) -> str:
    """Generate QR code data as JSON with module coordinates.

    Returns JSON with module positions and viewbox info for frontend
    SVG/canvas-based rendering.

    Args:
        url: URL to encode in the QR code
        shape_name: Name of the shape to use
        rotation: Rotation angle in degrees

    Returns:
        JSON string with structure:
        {
            "qrModules": [[x, y], ...],  // Black QR module positions
            "noiseModules": [[x, y], ...],  // Random noise module positions
            "viewbox": {"min_x", "min_y", "width", "height"},
            "shapeSize": float,
            "center": [cx, cy]
        }
    """
    shape = SHAPES.get(shape_name, SHAPES["hexagon"])

    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=1,
        border=0,
    )
    qr.add_data(url)
    qr.make(fit=True)

    qr_modules_count = qr.modules_count
    center_x, center_y, scale = shape.max_inscribed_square(qr_modules_count, rotation)
    shape_size = scale
    bbox_factor = shape.bounding_box_factor(rotation)
    canvas_size = int(math.ceil(shape_size * 2 * bbox_factor)) + 4

    cx = canvas_size / 2
    cy = canvas_size / 2

    qr_center_x = cx + center_x * scale
    qr_center_y = cy + center_y * scale
    qr_x = int(round(qr_center_x - qr_modules_count / 2))
    qr_y = int(round(qr_center_y - qr_modules_count / 2))

    qr_start_x = qr_x
    qr_start_y = qr_y
    qr_end_x = qr_start_x + qr_modules_count
    qr_end_y = qr_start_y + qr_modules_count

    # Collect noise module positions
    noise_modules: List[List[float]] = []
    for module_y in range(canvas_size):
        for module_x in range(canvas_size):
            module_cx = module_x + 0.5
            module_cy = module_y + 0.5

            if not shape.point_inside(module_cx, module_cy, cx, cy, shape_size, rotation):
                continue

            if qr_start_x <= module_x < qr_end_x and qr_start_y <= module_y < qr_end_y:
                continue

            random.seed(module_x * 10000 + module_y)
            if random.random() > 0.5:
                noise_modules.append([module_x, module_y])

    # Collect QR module positions (black modules only)
    qr_module_positions: List[List[float]] = []
    matrix = qr.modules
    for row_idx, row in enumerate(matrix):
        for col_idx, is_black in enumerate(row):
            if is_black:
                qr_module_positions.append([qr_x + col_idx, qr_y + row_idx])

    # Calculate viewBox
    margin = 2
    effective_size = shape_size * bbox_factor
    min_x = cx - effective_size - margin
    min_y = cy - effective_size - margin
    vb_width = (effective_size + margin) * 2
    vb_height = vb_width

    result = {
        "qrModules": qr_module_positions,
        "noiseModules": noise_modules,
        "viewbox": {
            "min_x": min_x,
            "min_y": min_y,
            "width": vb_width,
            "height": vb_height,
        },
        "shapeSize": shape_size,
        "center": [cx, cy],
    }

    return json.dumps(result)
