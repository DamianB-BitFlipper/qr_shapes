"""Hexagon shape implementation for QR codes."""

import numpy as np

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

    _H = np.sqrt(3) / 2  # Half-height of unit hexagon

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit hexagon (size=1) at given rotation."""
        # Rotate point in opposite direction
        px, py = self._rotate_point(px, py, rotation_deg)

        dx = abs(px)
        dy = abs(py)

        if dx > 1 or dy > self._H:
            return False
        if dx <= 0.5:
            return True
        return dy <= self._H * 2 * (1 - dx)
