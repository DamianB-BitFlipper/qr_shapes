"""Hexagon shape implementation for QR codes."""

import math
from typing import List, Tuple


class Hexagon:
    """A flat-bottom hexagon shape that can contain a QR code.

    The hexagon is defined by its "size" which is the distance from
    the center to each vertex (corner point).

    At 0° rotation:
    - Width at middle = 2 * size
    - Height = sqrt(3) * size
    - Flat edges at top and bottom
    """

    @property
    def name(self) -> str:
        return "Hexagon"

    @property
    def rotation_presets(self) -> List[Tuple[str, int]]:
        return [
            ("Flat Bottom", 0),
            ("Pointed Top", 30),
            ("45°", 45),
            ("60°", 60),
            ("90°", 90),
        ]

    def point_inside(
        self,
        x: float,
        y: float,
        cx: float,
        cy: float,
        size: float,
        rotation_deg: float = 0,
    ) -> bool:
        """Check if a point is inside the hexagon.

        The hexagon rotates around its center. We achieve this by
        rotating the test point in the opposite direction, then
        checking against an unrotated hexagon.
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

        # Check against unrotated flat-bottom hexagon
        dx = abs(px)
        dy = abs(py)
        h = size * math.sqrt(3) / 2  # Half height

        if dx > size or dy > h:
            return False
        if dx <= size / 2:
            return True
        return dy <= h * 2 * (1 - dx / size)

    def calculate_size(self, qr_side: float) -> float:
        """Calculate hexagon size to contain a centered square.

        For a flat-bottom hexagon to contain a square of side S centered
        within it, the hexagon size must satisfy:

        size >= S * (1 + sqrt(3)) / (2 * sqrt(3))

        We add a 5% margin for safety.
        """
        return qr_side * (1 + math.sqrt(3)) / (2 * math.sqrt(3)) * 1.05
