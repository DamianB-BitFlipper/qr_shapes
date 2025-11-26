"""Triangle shape implementation for QR codes."""

import math
from typing import List, Tuple

# At runtime in Pyodide, BaseShape is loaded first into global namespace
# See: web/app/hooks/usePyodide.ts for load order


class Triangle(BaseShape):  # type: ignore[name-defined]
    """An equilateral triangle shape that can contain a QR code.

    The triangle is defined by its "size" which is the distance from
    the center (centroid) to each vertex.

    At 0° rotation:
    - One vertex points upward
    - Base is at the bottom
    """

    # Unit triangle vertices (size=1): top, bottom-right, bottom-left
    _UNIT_VERTICES = [
        (0, -1),  # Top vertex
        (math.cos(math.radians(30)), math.sin(math.radians(30))),  # Bottom right
        (math.cos(math.radians(150)), math.sin(math.radians(150))),  # Bottom left
    ]

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

    def _get_num_edge_points(self) -> int:
        """Triangle has 3 vertices."""
        return 3

    def _get_edge_point(self, t: float, rotation_deg: float) -> Tuple[float, float]:
        """Get a point on the unit triangle's edge at parameter t.

        t=0 starts at top vertex, goes clockwise:
        - t=0 to 1/3: top to bottom-right edge
        - t=1/3 to 2/3: bottom-right to bottom-left edge
        - t=2/3 to 1: bottom-left to top edge
        """
        t = t % 1.0  # Ensure t is in [0, 1)
        n = 3
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
        """Check if a point is inside the triangle."""
        # Translate point to origin
        px = x - cx
        py = y - cy

        # Rotate point in opposite direction (to simulate triangle rotation)
        px, py = self._rotate_point(px, py, rotation_deg)

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

        def sign(p1: Tuple[float, float], p2: Tuple[float, float], p3: Tuple[float, float]) -> float:
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
        px, py = self._rotate_point(px, py, rotation_deg)

        v0, v1, v2 = self._UNIT_VERTICES

        def sign(p1: Tuple[float, float], p2: Tuple[float, float], p3: Tuple[float, float]) -> float:
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

        p = (px, py)
        d1 = sign(p, v0, v1)
        d2 = sign(p, v1, v2)
        d3 = sign(p, v2, v0)

        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)

        return not (has_neg and has_pos)
