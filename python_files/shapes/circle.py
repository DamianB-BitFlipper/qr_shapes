"""Circle shape implementation for QR codes."""

from typing import List, Tuple

# At runtime in Pyodide, BaseShape is loaded first into global namespace
# See: web/app/hooks/usePyodide.ts for load order


class Circle(BaseShape):  # type: ignore[name-defined]
    """A circle shape that can contain a QR code.

    The simplest shape - rotation has no effect since a circle is symmetric.
    """

    @property
    def name(self) -> str:
        return "Circle"

    @property
    def rotation_presets(self) -> List[Tuple[str, int]]:
        # Circle has no meaningful rotation, return empty list to disable
        return []

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit circle (radius=1).

        Rotation is ignored since circles are rotationally symmetric.
        """
        # Simple distance check: x² + y² <= 1
        return (px * px + py * py) <= 1.0
