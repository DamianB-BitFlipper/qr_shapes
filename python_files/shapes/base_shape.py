"""Base class for QR code shape generators."""

import math
from typing import List, Tuple


class BaseShape:
    """Abstract base class for shapes that can contain a QR code.

    Subclasses must implement:
    - name: Human-readable name of the shape
    - rotation_presets: List of (label, degrees) rotation presets
    - _point_inside_unit: Check if point is inside unit shape (size=1)
    """

    @property
    def name(self) -> str:
        """Human-readable name of the shape."""
        raise NotImplementedError

    @property
    def rotation_presets(self) -> List[Tuple[str, int]]:
        """List of (label, degrees) rotation presets for this shape."""
        raise NotImplementedError

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit shape (size=1) at given rotation."""
        raise NotImplementedError

    def _rotate_point(self, px: float, py: float, rotation_deg: float) -> Tuple[float, float]:
        """Rotate a point by the given angle (inverse rotation for shape simulation)."""
        if rotation_deg == 0:
            return px, py
        angle_rad = -math.radians(rotation_deg)
        cos_a = math.cos(angle_rad)
        sin_a = math.sin(angle_rad)
        return px * cos_a - py * sin_a, px * sin_a + py * cos_a

    def point_inside(
        self,
        x: float,
        y: float,
        cx: float,
        cy: float,
        size: float,
        rotation_deg: float = 0,
    ) -> bool:
        """Check if a point (x, y) is inside the shape."""
        # Translate to origin and normalize by size
        px = (x - cx) / size
        py = (y - cy) / size
        return self._point_inside_unit(px, py, rotation_deg)

    def _max_square_at_center(self, cx: float, cy: float, rotation_deg: float) -> float:
        """Find the maximum half-size of a square centered at (cx, cy).

        Uses binary search to find the largest square that fits.

        Args:
            cx, cy: Center point in unit coordinates
            rotation_deg: Shape rotation in degrees

        Returns:
            Maximum half-size (half of side length) that fits
        """
        # First check if center is even inside
        if not self._point_inside_unit(cx, cy, rotation_deg):
            return 0.0

        # Binary search for max size
        lo, hi = 0.0, 2.0
        eps = 1e-9
        prev_mid = 0.0

        for _ in range(40):
            mid = (lo + hi) / 2

            if abs(mid - prev_mid) < eps:
                break
            prev_mid = mid

            # Check if all 4 corners are inside
            corners = [
                (cx - mid, cy - mid),
                (cx + mid, cy - mid),
                (cx + mid, cy + mid),
                (cx - mid, cy + mid),
            ]
            if all(self._point_inside_unit(x, y, rotation_deg) for x, y in corners):
                lo = mid
            else:
                hi = mid

        return lo

    def _compute_loss(self, cx: float, cy: float, rotation_deg: float) -> float:
        """Compute loss (negative of max square size) for optimization.

        We want to maximize square size, so we minimize negative size.
        """
        max_size = self._max_square_at_center(cx, cy, rotation_deg)
        return -max_size

    def _compute_adaptive_step(
        self,
        step: float,
        delta: float,
        min_delta: float,
        max_step: float,
    ) -> Tuple[float, bool]:
        """Compute adaptive step size based on loss improvement.

        Args:
            step: Current step size
            delta: Change in loss (prev_loss - loss), positive = improvement
            min_delta: Minimum delta to consider as progress
            max_step: Maximum allowed step size

        Returns:
            Tuple of (new_step, should_revert) where should_revert indicates
            whether to revert to best known params
        """
        if delta > min_delta:
            # Making progress - slightly increase step
            return min(step * 1.1, max_step), False
        elif delta < 0:
            # Got worse - reduce step and signal to revert
            return step * 0.5, True
        else:
            # Stalled - reduce step
            return step * 0.8, False

    def max_inscribed_square(
        self, qr_modules: int, rotation_deg: float = 0
    ) -> Tuple[float, float, float]:
        """Find the maximum inscribed axis-aligned square using gradient descent.

        Args:
            qr_modules: Number of QR modules (determines scale)
            rotation_deg: Shape rotation in degrees

        Returns:
            Tuple of (center_x, center_y, scale_factor)
        """
        # Start at centroid (0, 0 for unit shape)
        cx, cy = 0.0, 0.0

        # Gradient descent
        step = 0.02
        min_step = 1e-6
        max_step = 0.1
        min_delta = 1e-10
        prev_loss = float("inf")

        best_cx, best_cy = cx, cy

        for _ in range(100):
            loss = self._compute_loss(cx, cy, rotation_deg)

            # Adaptive step
            delta = prev_loss - loss
            step, should_revert = self._compute_adaptive_step(step, delta, min_delta, max_step)

            if should_revert:
                cx, cy = best_cx, best_cy
            elif delta > min_delta:
                # Made progress, update best
                best_cx, best_cy = cx, cy

            if step < min_step:
                break

            prev_loss = loss

            # Numerical gradient
            eps = 0.001
            grad_x = (
                self._compute_loss(cx + eps, cy, rotation_deg)
                - self._compute_loss(cx - eps, cy, rotation_deg)
            ) / (2 * eps)
            grad_y = (
                self._compute_loss(cx, cy + eps, rotation_deg)
                - self._compute_loss(cx, cy - eps, rotation_deg)
            ) / (2 * eps)

            # Update
            new_cx = cx - step * grad_x
            new_cy = cy - step * grad_y

            # Only move if still inside shape
            if self._point_inside_unit(new_cx, new_cy, rotation_deg):
                cx, cy = new_cx, new_cy

        # best_size is half the side length in unit coordinates
        best_size = self._max_square_at_center(best_cx, best_cy, rotation_deg)
        scale = qr_modules / (2 * best_size)

        return (best_cx, best_cy, scale)
