"""Square shape implementation for QR codes."""

from typing import List, Tuple

# At runtime in Pyodide, BaseShape is loaded first into global namespace
# See: web/app/hooks/usePyodide.ts for load order


class Square(BaseShape):  # type: ignore[name-defined]
    """A square shape that can contain a QR code.

    At 0° rotation, the square has flat top/bottom edges.
    At 45° rotation, it appears as a diamond (rhombus).
    """

    @property
    def name(self) -> str:
        return "Square"

    @property
    def rotation_presets(self) -> List[Tuple[str, int]]:
        return [
            ("Flat", 0),
            ("Diamond", 45),
        ]

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit square (side=2, centered at origin)."""
        # Rotate point in opposite direction
        px, py = self._rotate_point(px, py, rotation_deg)

        # Simple box check: -1 <= x <= 1 and -1 <= y <= 1
        return abs(px) <= 1.0 and abs(py) <= 1.0
