"""QR code generator with pluggable shape support."""

import json
import math
import random
from typing import Dict, List, Set, Tuple

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


def get_finder_pattern_coords(size: int) -> Set[Tuple[int, int]]:
    """Get the coordinates of the three finder patterns (position detection patterns).

    Finder patterns are 7x7 squares in three corners:
    - Top-left: (0,0) to (6,6)
    - Top-right: (size-7, 0) to (size-1, 6)
    - Bottom-left: (0, size-7) to (6, size-1)

    Args:
        size: The QR code module count (width/height)

    Returns:
        Set of (col, row) tuples for all finder pattern modules
    """
    coords: Set[Tuple[int, int]] = set()

    # Each finder pattern is 7x7, plus 1 module separator around it
    # We include the separator (white) modules too since frontend draws the whole pattern
    finder_size = 7
    separator = 1

    # Top-left finder + separator
    for row in range(finder_size + separator):
        for col in range(finder_size + separator):
            coords.add((col, row))

    # Top-right finder + separator
    for row in range(finder_size + separator):
        for col in range(size - finder_size - separator, size):
            coords.add((col, row))

    # Bottom-left finder + separator
    for row in range(size - finder_size - separator, size):
        for col in range(finder_size + separator):
            coords.add((col, row))

    return coords


def get_alignment_pattern_coords(version: int, size: int) -> Set[Tuple[int, int]]:
    """Get the coordinates of alignment patterns.

    Alignment patterns are 5x5 squares that appear in QR codes version 2+.
    Their positions are defined by the QR code specification.

    Args:
        version: The QR code version (1-40)
        size: The QR code module count

    Returns:
        Set of (col, row) tuples for all alignment pattern modules
    """
    if version < 2:
        return set()

    coords: Set[Tuple[int, int]] = set()

    # Alignment pattern positions per version (center coordinates)
    # These are the standard positions from QR code specification
    alignment_positions = {
        2: [6, 18],
        3: [6, 22],
        4: [6, 26],
        5: [6, 30],
        6: [6, 34],
        7: [6, 22, 38],
        8: [6, 24, 42],
        9: [6, 26, 46],
        10: [6, 28, 50],
        11: [6, 30, 54],
        12: [6, 32, 58],
        13: [6, 34, 62],
        14: [6, 26, 46, 66],
        15: [6, 26, 48, 70],
        16: [6, 26, 50, 74],
        17: [6, 30, 54, 78],
        18: [6, 30, 56, 82],
        19: [6, 30, 58, 86],
        20: [6, 34, 62, 90],
        21: [6, 28, 50, 72, 94],
        22: [6, 26, 50, 74, 98],
        23: [6, 30, 54, 78, 102],
        24: [6, 28, 54, 80, 106],
        25: [6, 32, 58, 84, 110],
        26: [6, 30, 58, 86, 114],
        27: [6, 34, 62, 90, 118],
        28: [6, 26, 50, 74, 98, 122],
        29: [6, 30, 54, 78, 102, 126],
        30: [6, 26, 52, 78, 104, 130],
        31: [6, 30, 56, 82, 108, 134],
        32: [6, 34, 60, 86, 112, 138],
        33: [6, 30, 58, 86, 114, 142],
        34: [6, 34, 62, 90, 118, 146],
        35: [6, 30, 54, 78, 102, 126, 150],
        36: [6, 24, 50, 76, 102, 128, 154],
        37: [6, 28, 54, 80, 106, 132, 158],
        38: [6, 32, 58, 84, 110, 136, 162],
        39: [6, 26, 54, 82, 110, 138, 166],
        40: [6, 30, 58, 86, 114, 142, 170],
    }

    if version not in alignment_positions:
        return coords

    positions = alignment_positions[version]

    # Finder pattern centers (to avoid placing alignment patterns there)
    finder_centers = [(6, 6), (6, size - 7), (size - 7, 6)]

    # Generate all combinations of positions
    for row_center in positions:
        for col_center in positions:
            # Skip if this would overlap with a finder pattern
            if (col_center, row_center) in finder_centers:
                continue

            # Alignment pattern is 5x5, centered at (col_center, row_center)
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    coords.add((col_center + dc, row_center + dr))

    return coords


def generate_qr_data(
    url: str,
    shape_name: str = "hexagon",
    rotation: int = 0,
) -> str:
    """Generate QR code data as JSON with module coordinates.

    Returns JSON with module positions and viewbox info for frontend
    SVG/canvas-based rendering. The finder patterns and alignment patterns
    are excluded from qrModules so the frontend can render them separately.

    Args:
        url: URL to encode in the QR code
        shape_name: Name of the shape to use
        rotation: Rotation angle in degrees

    Returns:
        JSON string with structure:
        {
            "qrModules": [[x, y], ...],  // Black QR modules (excluding patterns)
            "noiseModules": [[x, y], ...],  // Random noise module positions
            "viewbox": {"min_x", "min_y", "width", "height"},
            "shapeSize": float,
            "center": [cx, cy],
            "qrOrigin": [x, y],  // Top-left corner of QR code area
            "qrSize": int,  // Size of QR code in modules
            "version": int  // QR code version (1-40)
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
    qr_version = qr.version
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

    # Get pattern coordinates to exclude
    finder_coords = get_finder_pattern_coords(qr_modules_count)
    alignment_coords = get_alignment_pattern_coords(qr_version, qr_modules_count)
    pattern_coords = finder_coords | alignment_coords

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

    # Collect QR module positions (black modules only, excluding patterns)
    qr_module_positions: List[List[float]] = []
    matrix = qr.modules
    for row_idx, row in enumerate(matrix):
        for col_idx, is_black in enumerate(row):
            # Skip if this module is part of a pattern
            if (col_idx, row_idx) in pattern_coords:
                continue
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
        "qrOrigin": [qr_x, qr_y],
        "qrSize": qr_modules_count,
        "version": qr_version,
    }

    return json.dumps(result)
