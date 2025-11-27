"""Base class for QR code shape generators."""

from abc import ABC, abstractmethod

import numpy as np
from numpy.typing import NDArray


class BaseShape(ABC):
    """Abstract base class for shapes that can contain a QR code.

    Subclasses must implement:
    - _point_inside_unit: Check if point is inside unit shape (size=1)
    """

    @abstractmethod
    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit shape (size=1) at given rotation."""
        ...

    def _rotate_point(self, px: float, py: float, rotation_deg: float) -> tuple[float, float]:
        """Rotate a point by the given angle (inverse rotation for shape simulation)."""
        if rotation_deg == 0:
            return px, py
        angle_rad = np.radians(-rotation_deg)
        cos_a = np.cos(angle_rad)
        sin_a = np.sin(angle_rad)
        return float(px * cos_a - py * sin_a), float(px * sin_a + py * cos_a)

    def bounding_box_factor(self, rotation_deg: float) -> float:
        """Get the bounding box expansion factor for the shape at given rotation.

        Returns how much larger the axis-aligned bounding box is compared to
        the unrotated shape. Default is 1.0 (no expansion).

        Subclasses should override this if rotation affects their bounding box.
        """
        return 1.0

    def _rotate_points(
        self, points: NDArray[np.floating], rotation_deg: float
    ) -> NDArray[np.floating]:
        """Rotate multiple points by the given angle.

        Args:
            points: Array of shape (N, 2) with x, y coordinates
            rotation_deg: Rotation angle in degrees (inverse rotation applied)

        Returns:
            Rotated points array of shape (N, 2)
        """
        if rotation_deg == 0:
            return points
        angle_rad = np.radians(-rotation_deg)
        cos_a = np.cos(angle_rad)
        sin_a = np.sin(angle_rad)
        rotation_matrix = np.array([[cos_a, -sin_a], [sin_a, cos_a]])
        return points @ rotation_matrix.T

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
        eps = 1e-3
        prev_mid = 0.0

        for _ in range(40):
            mid = (lo + hi) / 2

            if abs(mid - prev_mid) < eps:
                break
            prev_mid = mid

            # Check corners first (more likely to be outside), then edge midpoints
            points = [
                (cx - mid, cy - mid),
                (cx + mid, cy - mid),
                (cx + mid, cy + mid),
                (cx - mid, cy + mid),
                (cx, cy - mid),
                (cx + mid, cy),
                (cx, cy + mid),
                (cx - mid, cy),
            ]
            if all(self._point_inside_unit(x, y, rotation_deg) for x, y in points):
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

    def _compute_gradient(
        self, cx: float, cy: float, rotation_deg: float, eps: float = 0.001
    ) -> tuple[float, float]:
        """Compute numerical gradient of loss function.

        Args:
            cx, cy: Current center position
            rotation_deg: Shape rotation in degrees
            eps: Epsilon for finite difference

        Returns:
            Tuple of (grad_x, grad_y)
        """
        # Compute all 4 loss values needed for gradient
        loss_xp = self._compute_loss(cx + eps, cy, rotation_deg)
        loss_xn = self._compute_loss(cx - eps, cy, rotation_deg)
        loss_yp = self._compute_loss(cx, cy + eps, rotation_deg)
        loss_yn = self._compute_loss(cx, cy - eps, rotation_deg)

        grad_x = (loss_xp - loss_xn) / (2 * eps)
        grad_y = (loss_yp - loss_yn) / (2 * eps)

        return grad_x, grad_y

    def max_inscribed_square(
        self, qr_modules: int, rotation_deg: float = 0
    ) -> tuple[float, float, float]:
        """Find the maximum inscribed axis-aligned square using gradient descent.

        Args:
            qr_modules: Number of QR modules (determines scale)
            rotation_deg: Shape rotation in degrees

        Returns:
            Tuple of (center_x, center_y, scale_factor)
        """
        # Start at centroid (0, 0 for unit shape)
        pos = np.array([0.0, 0.0])

        # Gradient descent parameters
        step = 0.02
        min_step = 1e-6
        max_step = 0.1
        min_delta = 1e-10
        prev_loss = np.inf

        best_pos = pos.copy()

        for _ in range(100):
            cx, cy = pos
            loss = self._compute_loss(cx, cy, rotation_deg)

            # Adaptive step
            delta = prev_loss - loss
            if delta > min_delta:
                # Making progress - slightly increase step
                step = min(step * 1.1, max_step)
                best_pos = pos.copy()
            elif delta < 0:
                # Got worse - reduce step and revert
                step *= 0.5
                pos = best_pos.copy()
            else:
                # Stalled - reduce step
                step *= 0.8

            if step < min_step:
                break

            prev_loss = loss

            # Numerical gradient
            grad = np.array(self._compute_gradient(cx, cy, rotation_deg))

            # Update position
            new_pos = pos - step * grad

            # Only move if still inside shape
            if self._point_inside_unit(new_pos[0], new_pos[1], rotation_deg):
                pos = new_pos

        # best_size is half the side length in unit coordinates
        best_size = self._max_square_at_center(best_pos[0], best_pos[1], rotation_deg)
        scale = qr_modules / (2 * best_size)

        return (float(best_pos[0]), float(best_pos[1]), float(scale))
