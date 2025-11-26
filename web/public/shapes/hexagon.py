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
        """Check if a point is inside the hexagon."""
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

    def max_inscribed_square(
        self, size: float, rotation_deg: float = 0
    ) -> Tuple[float, float, float]:
        """Calculate the maximum inscribed axis-aligned square.

        For a flat-bottom hexagon, the max inscribed square is centered.
        The constraint comes from the slanted edges cutting the corners.

        Derivation:
        - Half-height h = sqrt(3)/2 * size
        - At x = s/2, the slanted edge is at y = h * 2 * (1 - s/(2*size))
        - Need s/2 <= this y value
        - Solving: s = 4*h*size / (size + 2*h) = 2*sqrt(3)*size / (1 + sqrt(3))

        Args:
            size: The hexagon size (center to vertex distance)
            rotation_deg: Rotation angle in degrees

        Returns:
            Tuple of (offset_x, offset_y, square_side)
        """
        # s = 2*sqrt(3)*size / (1 + sqrt(3)) ≈ 1.268 * size
        square_side = 2 * math.sqrt(3) * size / (1 + math.sqrt(3))

        # Centered in the hexagon
        return (0, 0, square_side)
