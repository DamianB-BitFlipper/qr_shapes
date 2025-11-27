"""Triangle shape implementation for QR codes."""

import numpy as np

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
    _UNIT_VERTICES = np.array(
        [
            [0, -1],  # Top vertex
            [np.cos(np.radians(30)), np.sin(np.radians(30))],  # Bottom right
            [np.cos(np.radians(150)), np.sin(np.radians(150))],  # Bottom left
        ]
    )

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit triangle (size=1) at given rotation."""
        # Rotate point in opposite direction
        px, py = self._rotate_point(px, py, rotation_deg)

        v = self._UNIT_VERTICES
        p = np.array([px, py])

        # Compute barycentric sign tests using cross products
        def sign(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

        d1 = sign(p, v[0], v[1])
        d2 = sign(p, v[1], v[2])
        d3 = sign(p, v[2], v[0])

        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)

        return not (has_neg and has_pos)
