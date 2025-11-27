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

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit triangle (size=1) at given rotation."""
        # Rotate point in opposite direction
        px, py = self._rotate_point(px, py, rotation_deg)

        v0, v1, v2 = self._UNIT_VERTICES

        def sign(
            p1: Tuple[float, float], p2: Tuple[float, float], p3: Tuple[float, float]
        ) -> float:
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

        p = (px, py)
        d1 = sign(p, v0, v1)
        d2 = sign(p, v1, v2)
        d3 = sign(p, v2, v0)

        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)

        return not (has_neg and has_pos)
