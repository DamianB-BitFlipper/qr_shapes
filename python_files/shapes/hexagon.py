"""Hexagon shape implementation for QR codes."""

import math
from typing import List, Tuple

from .base_shape import BaseShape


class Hexagon(BaseShape):
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

    def _get_search_range(self) -> Tuple[int, int]:
        """Hexagon can use a smaller search range due to symmetry."""
        return (-15, 16)

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
        px, py = self._rotate_point(px, py, rotation_deg)

        # Check against unrotated flat-bottom hexagon
        dx = abs(px)
        dy = abs(py)
        h = size * math.sqrt(3) / 2  # Half height

        if dx > size or dy > h:
            return False
        if dx <= size / 2:
            return True
        return dy <= h * 2 * (1 - dx / size)

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit hexagon (size=1) at given rotation."""
        # Rotate point in opposite direction
        px, py = self._rotate_point(px, py, rotation_deg)

        dx = abs(px)
        dy = abs(py)
        h = math.sqrt(3) / 2

        if dx > 1 or dy > h:
            return False
        if dx <= 0.5:
            return True
        return dy <= h * 2 * (1 - dx)
