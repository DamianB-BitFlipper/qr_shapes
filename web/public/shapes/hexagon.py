"""Hexagon shape implementation for QR codes."""

import math
from typing import List, Tuple

# At runtime in Pyodide, BaseShape is loaded first into global namespace
# See: web/app/hooks/usePyodide.ts for load order


class Hexagon(BaseShape):  # type: ignore[name-defined]
    """A flat-bottom hexagon shape that can contain a QR code.

    The hexagon is defined by its "size" which is the distance from
    the center to each vertex (corner point).

    At 0° rotation:
    - Width at middle = 2 * size
    - Height = sqrt(3) * size
    - Flat edges at top and bottom
    """

    # Unit hexagon vertices (size=1), starting from right, going counter-clockwise
    # Flat-bottom orientation: vertices at 0°, 60°, 120°, 180°, 240°, 300°
    _UNIT_VERTICES = [
        (1, 0),  # Right
        (0.5, math.sqrt(3) / 2),  # Top-right
        (-0.5, math.sqrt(3) / 2),  # Top-left
        (-1, 0),  # Left
        (-0.5, -math.sqrt(3) / 2),  # Bottom-left
        (0.5, -math.sqrt(3) / 2),  # Bottom-right
    ]

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

    def _get_num_edge_points(self) -> int:
        """Hexagon has 6 vertices."""
        return 6

    def _get_edge_point(self, t: float, rotation_deg: float) -> Tuple[float, float]:
        """Get a point on the unit hexagon's edge at parameter t.

        t=0 starts at right vertex (1, 0), goes counter-clockwise.
        """
        t = t % 1.0  # Ensure t is in [0, 1)
        n = 6
        segment = int(t * n)
        segment_t = (t * n) - segment  # Position within segment [0, 1)

        if segment >= n:
            segment = n - 1
            segment_t = 1.0

        # Get the two vertices for this segment
        v1 = self._UNIT_VERTICES[segment]
        v2 = self._UNIT_VERTICES[(segment + 1) % n]

        # Interpolate between vertices
        px = v1[0] + segment_t * (v2[0] - v1[0])
        py = v1[1] + segment_t * (v2[1] - v1[1])

        # Apply rotation
        if rotation_deg != 0:
            angle_rad = math.radians(rotation_deg)
            cos_a = math.cos(angle_rad)
            sin_a = math.sin(angle_rad)
            px, py = px * cos_a - py * sin_a, px * sin_a + py * cos_a

        return (px, py)

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
