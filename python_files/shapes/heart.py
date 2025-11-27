"""Heart shape implementation for QR codes."""

import numpy as np

# At runtime in Pyodide, BaseShape is loaded first into global namespace
# See: web/app/hooks/usePyodide.ts for load order


class Heart(BaseShape):  # type: ignore[name-defined]
    """A heart shape that can contain a QR code.

    The heart is defined using a parametric equation scaled to fit within
    a unit circle. At 0° rotation, the heart is in classic orientation with
    lobes at the top and point at the bottom.

    The shape uses the classic heart curve:
        x = 16 * sin^3(t)
        y = 13*cos(t) - 5*cos(2t) - 2*cos(3t) - cos(4t)
    Normalized to fit within a unit circle.
    """

    # Normalization factor to fit heart in unit circle
    # The raw heart curve has max radius ~17, we scale to 1
    _SCALE = 1 / 17.0

    # Cache for precomputed edge arrays
    _HEART_CACHE: dict = {}

    def _get_heart_edges(
        self, num_samples: int = 1024
    ) -> tuple[
        np.ndarray,
        np.ndarray,
        np.ndarray,
        np.ndarray,
        np.ndarray,
        float,
        float,
        float,
        float,
    ]:
        """Get precomputed heart edge data for ray casting.

        Returns cached edge arrays and bounding box for efficient point-in-polygon tests.
        """
        key = (num_samples, float(self._SCALE))
        cached = self._HEART_CACHE.get(key)
        if cached is not None:
            return cached

        # Sample closed polygon once
        t = np.linspace(0.0, 2.0 * np.pi, num_samples + 1, dtype=np.float64)
        sin_t = np.sin(t)
        cos_t = np.cos(t)

        x = 16.0 * (sin_t**3)
        # Negative y to flip the heart so it points up by default
        y = -(13.0 * cos_t - 5.0 * np.cos(2.0 * t) - 2.0 * np.cos(3.0 * t) - np.cos(4.0 * t))

        x *= self._SCALE
        y *= self._SCALE

        x0, y0 = x[:-1], y[:-1]
        x1, y1 = x[1:], y[1:]
        dx = x1 - x0
        dy = y1 - y0

        xmin, xmax = float(x.min()), float(x.max())
        ymin, ymax = float(y.min()), float(y.max())

        cached = (x0, y0, dx, dy, y1, xmin, xmax, ymin, ymax)
        self._HEART_CACHE[key] = cached
        return cached

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit heart (size=1) at given rotation.

        Uses vectorized ray casting algorithm with precomputed curve points.
        """
        # Rotate point in opposite direction
        px, py = self._rotate_point(px, py, rotation_deg)

        x0, y0, dx, dy, y1, xmin, xmax, ymin, ymax = self._get_heart_edges(num_samples=1024)

        # Fast bounding box rejection
        if px < xmin or px > xmax or py < ymin or py > ymax:
            return False

        # Vectorized ray casting to +x direction
        # Segment crosses horizontal ray if py is in [min(y0,y1), max(y0,y1))
        # with half-open rule to avoid double counts
        dy_nonzero = dy != 0.0
        cond = dy_nonzero & (((y0 <= py) & (py < y1)) | ((y1 <= py) & (py < y0)))

        # x intersection at y=py
        t = (py - y0) / dy
        x_int = x0 + t * dx

        hits = cond & (x_int > px)
        return (int(hits.sum()) & 1) == 1
