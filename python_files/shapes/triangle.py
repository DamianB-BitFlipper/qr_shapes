"""Triangle shape implementation for QR codes."""

import math
from typing import List, Tuple


class Triangle:
    """An equilateral triangle shape that can contain a QR code.

    The triangle is defined by its "size" which is the distance from
    the center (centroid) to each vertex.

    At 0° rotation:
    - One vertex points upward
    - Base is at the bottom
    """

    @property
    def name(self) -> str:
        return "Triangle"

    @property
    def rotation_presets(self) -> List[Tuple[str, int]]:
        return [
            ("Point Up", 0),
            ("Point Right", 90),
            ("Point Down", 180),
            ("Point Left", 270),
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
        """Check if a point is inside the triangle."""
        # Translate point to origin
        px = x - cx
        py = y - cy

        # Rotate point in opposite direction (to simulate triangle rotation)
        if rotation_deg != 0:
            angle_rad = -math.radians(rotation_deg)
            cos_a = math.cos(angle_rad)
            sin_a = math.sin(angle_rad)
            px, py = px * cos_a - py * sin_a, px * sin_a + py * cos_a

        # Equilateral triangle with point up at 0° rotation
        v0 = (0, -size)  # Top vertex
        v1 = (
            size * math.cos(math.radians(30)),
            size * math.sin(math.radians(30)),
        )  # Bottom right
        v2 = (
            size * math.cos(math.radians(150)),
            size * math.sin(math.radians(150)),
        )  # Bottom left

        def sign(p1, p2, p3):
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

        p = (px, py)
        d1 = sign(p, v0, v1)
        d2 = sign(p, v1, v2)
        d3 = sign(p, v2, v0)

        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)

        return not (has_neg and has_pos)

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit triangle (size=1) at given rotation."""
        # Rotate point in opposite direction
        if rotation_deg != 0:
            angle_rad = -math.radians(rotation_deg)
            cos_a = math.cos(angle_rad)
            sin_a = math.sin(angle_rad)
            px, py = px * cos_a - py * sin_a, px * sin_a + py * cos_a

        # Unit triangle vertices
        v0 = (0, -1)
        v1 = (math.cos(math.radians(30)), math.sin(math.radians(30)))
        v2 = (math.cos(math.radians(150)), math.sin(math.radians(150)))

        def sign(p1, p2, p3):
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

        p = (px, py)
        d1 = sign(p, v0, v1)
        d2 = sign(p, v1, v2)
        d3 = sign(p, v2, v0)

        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)

        return not (has_neg and has_pos)

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
        square position and size, since the analytical formula only
        works for specific angles (0°, 90°, 180°, 270°).

        Args:
            size: The triangle size (center to vertex distance)
            rotation_deg: Rotation angle in degrees

        Returns:
            Tuple of (offset_x, offset_y, square_side)
        """
        # Search over offset positions to find the maximum inscribed square
        # for a unit triangle, then scale by size
        best_side = 0.0
        best_offset_x = 0.0
        best_offset_y = 0.0

        # Search grid - the optimal position is usually near center or toward a flat edge
        for ox_int in range(-30, 31):
            for oy_int in range(-30, 31):
                offset_x = ox_int * 0.02
                offset_y = oy_int * 0.02
                side = self._find_max_square_at_offset(offset_x, offset_y, rotation_deg)
                if side > best_side:
                    best_side = side
                    best_offset_x = offset_x
                    best_offset_y = offset_y

        # Refine the search around the best position
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
