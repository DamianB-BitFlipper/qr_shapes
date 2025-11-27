"""Circle shape implementation for QR codes."""

# At runtime in Pyodide, BaseShape is loaded first into global namespace
# See: web/app/hooks/usePyodide.ts for load order


class Circle(BaseShape):  # type: ignore[name-defined]
    """A circle shape that can contain a QR code.

    The simplest shape - rotation has no effect since a circle is symmetric.
    """

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit circle (radius=1).

        Rotation is ignored since circles are rotationally symmetric.
        """
        # Simple distance check: x² + y² <= 1
        return (px * px + py * py) <= 1.0
