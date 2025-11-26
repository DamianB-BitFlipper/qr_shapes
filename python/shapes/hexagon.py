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

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit hexagon (size=1) at given rotation."""
        # Rotate point in opposite direction
        if rotation_deg != 0:
            angle_rad = -math.radians(rotation_deg)
            cos_a = math.cos(angle_rad)
            sin_a = math.sin(angle_rad)
            px, py = px * cos_a - py * sin_a, px * sin_a + py * cos_a

        dx = abs(px)
        dy = abs(py)
        h = math.sqrt(3) / 2

        if dx > 1 or dy > h:
            return False
        if dx <= 0.5:
            return True
        return dy <= h * 2 * (1 - dx)

    def _find_max_square_at_offset(
        self, offset_x: float, offset_y: float, rotation_deg: float
    ) -> float:
        """Binary search for max square side at given offset."""
        lo, hi = 0.0, 2.0
        for _ in range(40):
            mid = (lo + hi) / 2
            s = mid
            corners = [
                (offset_x + s / 2, offset_y - s / 2),
                (offset_x + s / 2, offset_y + s / 2),
                (offset_x - s / 2, offset_y - s / 2),
                (offset_x - s / 2, offset_y + s / 2),
            ]
            all_inside = all(
                self._point_inside_unit(x, y, rotation_deg) for x, y in corners
            )
            if all_inside:
                lo = mid
            else:
                hi = mid
        return lo

    def max_inscribed_square(
        self, size: float, rotation_deg: float = 0
    ) -> Tuple[float, float, float]:
        """Calculate the maximum inscribed axis-aligned square.

        For arbitrary rotation, we numerically search for the optimal
        square position and size.

        Args:
            size: The hexagon size (center to vertex distance)
            rotation_deg: Rotation angle in degrees

        Returns:
            Tuple of (offset_x, offset_y, square_side)
        """
        # For hexagon, the optimal square is always centered due to symmetry
        # But at odd rotations, the max size varies
        # Search around center
        best_side = 0.0
        best_offset_x = 0.0
        best_offset_y = 0.0

        # Coarse search
        for ox_int in range(-15, 16):
            for oy_int in range(-15, 16):
                offset_x = ox_int * 0.02
                offset_y = oy_int * 0.02
                side = self._find_max_square_at_offset(offset_x, offset_y, rotation_deg)
                if side > best_side:
                    best_side = side
                    best_offset_x = offset_x
                    best_offset_y = offset_y

        # Fine search around best position
        for ox_int in range(-10, 11):
            for oy_int in range(-10, 11):
                offset_x = best_offset_x + ox_int * 0.005
                offset_y = best_offset_y + oy_int * 0.005
                side = self._find_max_square_at_offset(offset_x, offset_y, rotation_deg)
                if side > best_side:
                    best_side = side
                    best_offset_x = offset_x
                    best_offset_y = offset_y

        # Apply 2% safety margin
        best_side *= 0.98

        # Scale by size
        return (best_offset_x * size, best_offset_y * size, best_side * size)
