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
        """Check if a point (x, y) is inside the shape.

        Args:
            x: X coordinate of the point
            y: Y coordinate of the point
            cx: X coordinate of shape center
            cy: Y coordinate of shape center
            size: Size of the shape (interpretation depends on shape)
            rotation_deg: Rotation angle in degrees

        Returns:
            True if the point is inside the shape
        """
        raise NotImplementedError

    def _point_inside_unit(self, px: float, py: float, rotation_deg: float) -> bool:
        """Check if point is inside unit shape (size=1) at given rotation.

        Args:
            px: X coordinate relative to shape center
            py: Y coordinate relative to shape center
            rotation_deg: Rotation angle in degrees

        Returns:
            True if the point is inside the unit shape
        """
        raise NotImplementedError

    def _rotate_point(self, px: float, py: float, rotation_deg: float) -> Tuple[float, float]:
        """Rotate a point by the given angle (inverse rotation for shape simulation).

        Args:
            px: X coordinate
            py: Y coordinate
            rotation_deg: Rotation angle in degrees

        Returns:
            Tuple of (rotated_x, rotated_y)
        """
        if rotation_deg == 0:
            return px, py
        angle_rad = -math.radians(rotation_deg)
        cos_a = math.cos(angle_rad)
        sin_a = math.sin(angle_rad)
        return px * cos_a - py * sin_a, px * sin_a + py * cos_a

    def _find_max_square_at_offset(
        self, offset_x: float, offset_y: float, rotation_deg: float
    ) -> float:
        """Binary search for max square side at given offset.

        Args:
            offset_x: X offset from center
            offset_y: Y offset from center
            rotation_deg: Rotation angle in degrees

        Returns:
            Maximum square side length that fits at this offset
        """
        lo, hi = 0.0, 2.0
        for _ in range(40):
            mid = (lo + hi) / 2
            s = mid
            corners = [
                (offset_x + s / 2, offset_y - s / 2),
                (offset_x + s / 2, offset_y + s / 2),
                (offset_x - s / 2, offset_y - s / 2),
                (offset_x - s / 2, offset_y + s / 2),
            ]
            all_inside = all(
                self._point_inside_unit(x, y, rotation_deg) for x, y in corners
            )
            if all_inside:
                lo = mid
            else:
                hi = mid
        return lo

    def _get_search_range(self) -> Tuple[int, int]:
        """Get the coarse search range for max inscribed square.

        Override in subclasses for shape-specific optimization.

        Returns:
            Tuple of (min_range, max_range) for grid search
        """
        return (-30, 31)

    def max_inscribed_square(
        self, size: float, rotation_deg: float = 0
    ) -> Tuple[float, float, float]:
        """Calculate the maximum axis-aligned inscribed square.

        Returns the largest square that fits entirely within the shape,
        along with its position offset from the shape center.

        Args:
            size: Size of the shape (interpretation depends on shape)
            rotation_deg: Rotation angle in degrees

        Returns:
            Tuple of (offset_x, offset_y, square_side) where:
            - offset_x: X offset from shape center
            - offset_y: Y offset from shape center
            - square_side: Side length of the inscribed square
        """
        best_side = 0.0
        best_offset_x = 0.0
        best_offset_y = 0.0

        # Coarse search
        min_range, max_range = self._get_search_range()
        for ox_int in range(min_range, max_range):
            for oy_int in range(min_range, max_range):
                offset_x = ox_int * 0.02
                offset_y = oy_int * 0.02
                side = self._find_max_square_at_offset(offset_x, offset_y, rotation_deg)
                if side > best_side:
                    best_side = side
                    best_offset_x = offset_x
                    best_offset_y = offset_y

        # Fine search around best position
        for ox_int in range(-10, 11):
            for oy_int in range(-10, 11):
                offset_x = best_offset_x + ox_int * 0.005
                offset_y = best_offset_y + oy_int * 0.005
                side = self._find_max_square_at_offset(offset_x, offset_y, rotation_deg)
                if side > best_side:
                    best_side = side
                    best_offset_x = offset_x
                    best_offset_y = offset_y

        # Apply 2% safety margin
        best_side *= 0.98

        # Scale by size
        return (best_offset_x * size, best_offset_y * size, best_side * size)
