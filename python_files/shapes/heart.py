"""Heart shape implementation for QR codes."""

import math
from typing import List, Tuple

# At runtime in Pyodide, BaseShape is loaded first into global namespace
# See: web/app/hooks/usePyodide.ts for load order


class Heart(BaseShape):  # type: ignore[name-defined]
    """A heart shape that can contain a QR code.

    The heart is defined using a parametric equation scaled to fit within
    a unit circle. At 0° rotation, the heart points upward (top of heart
    at the top).

    The shape uses the classic heart curve:
        x = 16 * sin³(t)
        y = 13*cos(t) - 5*cos(2t) - 2*cos(3t) - cos(4t)
    Normalized to fit within a unit circle.
    """

    # Normalization factor to fit heart in unit circle
    # The raw heart curve has max radius ~17, we scale to 1
    _SCALE = 1 / 17.0

    @property
    def name(self) -> str:
        return "Heart"

    @property
    def rotation_presets(self) -> List[Tuple[str, int]]:
        return [
            ("Point Up", 0),
            ("Point Right", 90),
            ("Point Down", 180),
            ("Point Left", 270),
        ]

    def _heart_curve(self, t: float) -> Tuple[float, float]:
        """Compute point on heart curve for parameter t (0 to 2*pi)."""
        sin_t = math.sin(t)
        cos_t = math.cos(t)

        x = 16 * (sin_t**3)
        # Negative y to flip the heart so it points up by default
        y = -(13 * cos_t - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))

        return x * self._SCALE, y * self._SCALE

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit heart (size=1) at given rotation.

        Uses the implicit form of the heart curve:
            (x² + y² - 1)³ - x²y³ < 0

        But we use a modified version that matches our parametric heart better.
        We use ray casting for accurate inside detection.
        """
        # Rotate point in opposite direction
        px, py = self._rotate_point(px, py, rotation_deg)

        # Quick bounding box check
        if abs(px) > 1.0 or abs(py) > 1.0:
            return False

        # Ray casting algorithm: count intersections with heart boundary
        # Cast a ray from (px, py) to the right (+x direction)
        intersections = 0
        num_samples = 360
        prev_x, prev_y = self._heart_curve(0)

        for i in range(1, num_samples + 1):
            t = 2 * math.pi * i / num_samples
            curr_x, curr_y = self._heart_curve(t)

            # Check if ray intersects this segment
            # Ray goes from (px, py) to (+infinity, py)
            if (prev_y <= py < curr_y) or (curr_y <= py < prev_y):
                # Compute x-coordinate of intersection
                if abs(curr_y - prev_y) > 1e-10:
                    t_intersect = (py - prev_y) / (curr_y - prev_y)
                    x_intersect = prev_x + t_intersect * (curr_x - prev_x)
                    if x_intersect > px:
                        intersections += 1

            prev_x, prev_y = curr_x, curr_y

        # Odd number of intersections means inside
        return intersections % 2 == 1
