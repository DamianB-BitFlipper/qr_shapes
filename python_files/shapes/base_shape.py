"""Base class for QR code shape generators."""

import math
import random
from typing import List, Tuple

Point = Tuple[float, float]


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

    def _square_fits(self, cx: float, cy: float, half_size: float, rotation_deg: float) -> bool:
        """Check if an axis-aligned square fits inside the unit shape.
        
        Args:
            cx, cy: Center of the square in unit coordinates
            half_size: Half the side length of the square
            rotation_deg: Shape rotation in degrees
        
        Returns:
            True if all 4 corners are inside the shape
        """
        corners = [
            (cx - half_size, cy - half_size),
            (cx + half_size, cy - half_size),
            (cx + half_size, cy + half_size),
            (cx - half_size, cy + half_size),
        ]
        return all(self._point_inside_unit(x, y, rotation_deg) for x, y in corners)

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
        lo, hi = 0.0, 2.0  # Max possible half-size in unit coords
        
        for _ in range(40):  # Enough iterations for good precision
            mid = (lo + hi) / 2
            if self._square_fits(cx, cy, mid, rotation_deg):
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

    def _get_bounding_box(self, rotation_deg: float) -> Tuple[float, float, float, float]:
        """Get bounding box of unit shape at given rotation.
        
        Returns:
            Tuple of (min_x, min_y, max_x, max_y)
        """
        # Sample points around the shape to find bounds
        # For unit shapes, max extent is typically around 1.0
        return (-1.0, -1.0, 1.0, 1.0)

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
        # Get bounding box for search bounds
        min_x, min_y, max_x, max_y = self._get_bounding_box(rotation_deg)
        
        best_cx, best_cy = 0.0, 0.0
        best_size = 0.0
        best_loss = float("inf")
        
        # Try multiple starting points
        n_starts = 15
        for i in range(n_starts):
            if i == 0:
                # Start at centroid
                cx = (min_x + max_x) / 2
                cy = (min_y + max_y) / 2
            else:
                # Random point inside bounding box
                cx = min_x + random.random() * (max_x - min_x)
                cy = min_y + random.random() * (max_y - min_y)
                
                # Skip if outside shape
                if not self._point_inside_unit(cx, cy, rotation_deg):
                    continue
            
            # Gradient descent
            step = 0.02
            min_step = 1e-6
            max_step = 0.1
            min_delta = 1e-10
            prev_loss = float("inf")
            
            best_iter_cx, best_iter_cy = cx, cy
            best_iter_loss = float("inf")
            
            for iteration in range(100):
                loss = self._compute_loss(cx, cy, rotation_deg)
                
                # Track best for this starting point
                if loss < best_iter_loss:
                    best_iter_loss = loss
                    best_iter_cx, best_iter_cy = cx, cy
                
                # Adaptive step
                delta = prev_loss - loss
                step, should_revert = self._compute_adaptive_step(
                    step, delta, min_delta, max_step
                )
                
                if should_revert:
                    cx, cy = best_iter_cx, best_iter_cy
                
                if step < min_step:
                    break
                
                prev_loss = loss
                
                # Numerical gradient
                eps = 0.001
                grad_x = (self._compute_loss(cx + eps, cy, rotation_deg) - 
                          self._compute_loss(cx - eps, cy, rotation_deg)) / (2 * eps)
                grad_y = (self._compute_loss(cx, cy + eps, rotation_deg) - 
                          self._compute_loss(cx, cy - eps, rotation_deg)) / (2 * eps)
                
                # Update
                new_cx = cx - step * grad_x
                new_cy = cy - step * grad_y
                
                # Clamp to bounding box
                new_cx = max(min_x, min(max_x, new_cx))
                new_cy = max(min_y, min(max_y, new_cy))
                
                # Only move if still inside shape
                if self._point_inside_unit(new_cx, new_cy, rotation_deg):
                    cx, cy = new_cx, new_cy
            
            # Check final result for this starting point
            final_size = self._max_square_at_center(best_iter_cx, best_iter_cy, rotation_deg)
            final_loss = -final_size
            
            if final_loss < best_loss:
                best_loss = final_loss
                best_cx, best_cy = best_iter_cx, best_iter_cy
                best_size = final_size
        
        # best_size is half the side length in unit coordinates
        # We want scale such that the full side length equals qr_modules
        side_length = 2 * best_size
        scale = qr_modules / side_length
        
        return (best_cx, best_cy, scale)
