"""Diamond shape implementation for QR codes."""

from typing import List, Tuple

# At runtime in Pyodide, BaseShape is loaded first into global namespace
# See: web/app/hooks/usePyodide.ts for load order


class Diamond(BaseShape):  # type: ignore[name-defined]
    """A gem/jewel diamond shape that can contain a QR code.

    The diamond has a flat top with angled upper corners and comes
    to a point at the bottom, like a cut gemstone.

    At 0° rotation, the diamond points downward.
    """

    # Diamond vertices (normalized to fit in unit circle):
    # Flat top edge, angled sides, point at bottom
    # The shape is defined by 5 points:
    #   - Top left corner
    #   - Top right corner
    #   - Right corner (where top meets the side going to point)
    #   - Bottom point
    #   - Left corner (where top meets the side going to point)

    # Proportions based on the reference image:
    # Top edge is about 50% of total width
    # Upper corners are at about 25% down from top

    _TOP_HALF_WIDTH = 0.5  # Half-width of flat top
    _FULL_HALF_WIDTH = 0.95  # Half-width at widest point (corners)
    _TOP_Y = -0.65  # Y of flat top edge
    _CORNER_Y = -0.35  # Y of upper corners
    _BOTTOM_Y = 0.75  # Y of bottom point

    def _get_vertices(self) -> List[Tuple[float, float]]:
        """Get the 5 vertices of the diamond shape."""
        return [
            (-self._TOP_HALF_WIDTH, self._TOP_Y),  # Top left
            (self._TOP_HALF_WIDTH, self._TOP_Y),  # Top right
            (self._FULL_HALF_WIDTH, self._CORNER_Y),  # Right corner
            (0.0, self._BOTTOM_Y),  # Bottom point
            (-self._FULL_HALF_WIDTH, self._CORNER_Y),  # Left corner
        ]

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit diamond at given rotation.

        Uses ray casting algorithm for polygon containment.
        """
        # Rotate point in opposite direction
        px, py = self._rotate_point(px, py, rotation_deg)

        vertices = self._get_vertices()
        n = len(vertices)

        # Ray casting algorithm
        inside = False
        j = n - 1

        for i in range(n):
            xi, yi = vertices[i]
            xj, yj = vertices[j]

            if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
                inside = not inside

            j = i

        return inside
