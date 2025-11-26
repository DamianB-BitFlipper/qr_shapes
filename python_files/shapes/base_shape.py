"""Base class for QR code shape generators."""

import math
from typing import List, Tuple


class BaseShape:
    """Abstract base class for shapes that can contain a QR code.

    Subclasses must implement:
    - name: Human-readable name of the shape
    - rotation_presets: List of (label, degrees) rotation presets
    - point_inside: Check if a point is inside the shape
    - _point_inside_unit: Check if point is inside unit shape (size=1)
    - _get_edge_point: Get a point on the shape's edge at parameter t (0-1)
    - _get_num_edge_points: Number of vertices/segments for edge parameterization
    """

    @property
    def name(self) -> str:
        """Human-readable name of the shape."""
        raise NotImplementedError

    @property
    def rotation_presets(self) -> List[Tuple[str, int]]:
        """List of (label, degrees) rotation presets for this shape."""
        raise NotImplementedError

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
        raise NotImplementedError

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit shape (size=1) at given rotation."""
        raise NotImplementedError

    def _get_edge_point(self, t: float, rotation_deg: float) -> Tuple[float, float]:
        """Get a point on the unit shape's edge at parameter t.

        Args:
            t: Parameter from 0 to 1 representing position along perimeter
            rotation_deg: Rotation angle in degrees

        Returns:
            Tuple of (x, y) coordinates on the edge
        """
        raise NotImplementedError

    def _get_num_edge_points(self) -> int:
        """Get number of vertices for edge parameterization."""
        raise NotImplementedError

    def _rotate_point(self, px: float, py: float, rotation_deg: float) -> Tuple[float, float]:
        """Rotate a point by the given angle (inverse rotation for shape simulation)."""
        if rotation_deg == 0:
            return px, py
        angle_rad = -math.radians(rotation_deg)
        cos_a = math.cos(angle_rad)
        sin_a = math.sin(angle_rad)
        return px * cos_a - py * sin_a, px * sin_a + py * cos_a

    def _compute_square_quality(
        self, t0: float, t1: float, t2: float, t3: float, rotation_deg: float
    ) -> Tuple[float, float, Tuple[float, float]]:
        """Compute how close 4 edge points are to forming a square.

        Returns:
            Tuple of (quality_score, side_length, center) where:
            - quality_score: 0 = perfect square, higher = worse
            - side_length: average side length (valid if quality is good)
            - center: center point of the quadrilateral
        """
        # Get the 4 points on the edge
        p0 = self._get_edge_point(t0, rotation_deg)
        p1 = self._get_edge_point(t1, rotation_deg)
        p2 = self._get_edge_point(t2, rotation_deg)
        p3 = self._get_edge_point(t3, rotation_deg)

        # For an axis-aligned square, we need:
        # - p0 and p1 to have same x (right edge)
        # - p2 and p3 to have same x (left edge)
        # - p0 and p3 to have same y (top edge)
        # - p1 and p2 to have same y (bottom edge)
        # - All sides equal length

        # Calculate side lengths
        def dist(a: Tuple[float, float], b: Tuple[float, float]) -> float:
            return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)

        # Sides: p0->p1, p1->p2, p2->p3, p3->p0
        s01 = dist(p0, p1)
        s12 = dist(p1, p2)
        s23 = dist(p2, p3)
        s30 = dist(p3, p0)

        sides = [s01, s12, s23, s30]
        avg_side = sum(sides) / 4

        # Diagonals should be equal and sqrt(2) * side
        d02 = dist(p0, p2)
        d13 = dist(p1, p3)

        # Quality metrics:
        # 1. Side length variance (all sides should be equal)
        side_variance = sum((s - avg_side) ** 2 for s in sides) / 4

        # 2. Diagonal equality and correct ratio
        expected_diag = avg_side * math.sqrt(2)
        diag_error = (d02 - expected_diag) ** 2 + (d13 - expected_diag) ** 2
        diag_equality_error = (d02 - d13) ** 2

        # 3. Right angles - check dot products of adjacent sides
        def dot(v1: Tuple[float, float], v2: Tuple[float, float]) -> float:
            return v1[0] * v2[0] + v1[1] * v2[1]

        v01 = (p1[0] - p0[0], p1[1] - p0[1])
        v12 = (p2[0] - p1[0], p2[1] - p1[1])
        v23 = (p3[0] - p2[0], p3[1] - p2[1])
        v30 = (p0[0] - p3[0], p0[1] - p3[1])

        # For 90° angles, dot product should be 0
        angle_error = dot(v01, v12) ** 2 + dot(v12, v23) ** 2 + dot(v23, v30) ** 2 + dot(v30, v01) ** 2

        # 4. Axis alignment - sides should be horizontal or vertical
        # Horizontal sides: v12, v30 should have y ≈ 0
        # Vertical sides: v01, v23 should have x ≈ 0
        axis_error = v01[0] ** 2 + v23[0] ** 2 + v12[1] ** 2 + v30[1] ** 2

        # Combined quality score (lower is better)
        quality = side_variance + diag_error + diag_equality_error + angle_error * 0.1 + axis_error

        # Center of the quadrilateral
        center = (
            (p0[0] + p1[0] + p2[0] + p3[0]) / 4,
            (p0[1] + p1[1] + p2[1] + p3[1]) / 4,
        )

        return quality, avg_side, center

    def _compute_adaptive_step(
        self,
        step: float,
        delta: float,
        min_delta: float,
        min_step: float,
        max_step: float,
    ) -> Tuple[float, bool]:
        """Compute adaptive step size based on loss improvement.

        Args:
            step: Current step size
            delta: Change in loss (prev_quality - quality), positive = improvement
            min_delta: Minimum delta to consider as progress
            min_step: Minimum allowed step size
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

    def _optimize_square_params(
        self, t0: float, t1: float, t2: float, t3: float, rotation_deg: float, max_iterations: int = 100
    ) -> Tuple[float, float, float, float, float, float]:
        """Optimize 4 edge parameters to form the best square.

        Uses gradient descent with adaptive step size:
        - Increases step when making progress
        - Decreases step when loss increases or stalls

        Args:
            t0, t1, t2, t3: Initial edge parameters (0-1)
            rotation_deg: Shape rotation in degrees
            max_iterations: Maximum iterations before stopping

        Returns:
            Tuple of (t0, t1, t2, t3, quality, side_length)
        """
        params = [t0, t1, t2, t3]
        best_params = params.copy()
        best_quality = float("inf")

        step = 0.02  # Initial step size
        min_step = 1e-6
        max_step = 0.1
        min_delta = 1e-10
        stall_count = 0
        prev_quality = float("inf")

        for iteration in range(max_iterations):
            quality, side, _ = self._compute_square_quality(
                params[0], params[1], params[2], params[3], rotation_deg
            )

            # Track best result
            if quality < best_quality:
                best_quality = quality
                best_params = params.copy()

            # Adaptive step size
            delta = prev_quality - quality
            step, should_revert = self._compute_adaptive_step(
                step, delta, min_delta, min_step, max_step
            )

            if should_revert:
                params = best_params.copy()
                stall_count += 1
            elif delta <= min_delta:
                stall_count += 1
            else:
                stall_count = 0

            # Early stopping if step too small or stalled too long
            if step < min_step or stall_count > 10:
                break

            prev_quality = quality

            # Compute numerical gradient using central difference
            gradient = [0.0] * 4
            eps = 0.001
            for i in range(4):
                params_plus = params.copy()
                params_plus[i] = (params_plus[i] + eps) % 1.0
                q_plus, _, _ = self._compute_square_quality(
                    params_plus[0], params_plus[1], params_plus[2], params_plus[3], rotation_deg
                )

                params_minus = params.copy()
                params_minus[i] = (params_minus[i] - eps) % 1.0
                q_minus, _, _ = self._compute_square_quality(
                    params_minus[0], params_minus[1], params_minus[2], params_minus[3], rotation_deg
                )

                gradient[i] = (q_plus - q_minus) / (2 * eps)

            # Update parameters (gradient descent)
            for i in range(4):
                params[i] = (params[i] - step * gradient[i]) % 1.0

            # Ensure ordering is maintained (t0 < t1 < t2 < t3)
            params.sort()

        final_quality, final_side, _ = self._compute_square_quality(
            best_params[0], best_params[1], best_params[2], best_params[3], rotation_deg
        )
        return (best_params[0], best_params[1], best_params[2], best_params[3], final_quality, final_side)

    def max_inscribed_square(
        self, size: float, rotation_deg: float = 0
    ) -> Tuple[float, float, float]:
        """Calculate the maximum axis-aligned inscribed square.

        Uses an edge-walking algorithm:
        1. Start with 4 points evenly distributed on the shape's edge
        2. Optimize their positions to form a square
        3. Try multiple starting configurations and keep the best

        Returns:
            Tuple of (offset_x, offset_y, square_side)
        """
        # Initial positions: evenly spaced
        t0, t1, t2, t3 = 0.0, 0.25, 0.5, 0.75

        t0, t1, t2, t3, _, side = self._optimize_square_params(
            t0, t1, t2, t3, rotation_deg, max_iterations=100
        )

        _, _, center = self._compute_square_quality(t0, t1, t2, t3, rotation_deg)

        # Scale by size
        return (center[0] * size, center[1] * size, side * size)
