"""Square shape implementation for QR codes."""

import math

# At runtime in Pyodide, BaseShape is loaded first into global namespace
# See: web/app/hooks/usePyodide.ts for load order


class Square(BaseShape):  # type: ignore[name-defined]
    """A square shape that can contain a QR code.

    At 0° rotation, the square has flat top/bottom edges.
    At 45° rotation, it appears as a diamond (rhombus).
    """

    def bounding_box_factor(self, rotation_deg: float) -> float:
        """Get bounding box expansion factor for rotated square.

        A square rotated by angle θ has bounding box that expands by:
        |cos(θ)| + |sin(θ)|, which is √2 at 45°.
        """
        angle_rad = math.radians(rotation_deg)
        return abs(math.cos(angle_rad)) + abs(math.sin(angle_rad))

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit square (side=2, centered at origin)."""
        # Rotate point in opposite direction
        px, py = self._rotate_point(px, py, rotation_deg)

        # Simple box check: -1 <= x <= 1 and -1 <= y <= 1
        return abs(px) <= 1.0 and abs(py) <= 1.0
