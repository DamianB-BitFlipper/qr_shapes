"""Triangle shape implementation for QR codes."""

import math
from typing import List, Tuple


class Triangle:
    """An equilateral triangle shape that can contain a QR code.

    The triangle is defined by its "size" which is the distance from
    the center (centroid) to each vertex.

    At 0° rotation:
    - One vertex points upward
    - Base is at the bottom
    """

    @property
    def name(self) -> str:
        return "Triangle"

    @property
    def rotation_presets(self) -> List[Tuple[str, int]]:
        return [
            ("Point Up", 0),
            ("Point Right", 90),
            ("Point Down", 180),
            ("Point Left", 270),
        ]

    def point_inside(
        self,
        x: float,
        y: float,
        cx: float,
        cy: float,
        size: float,
        rotation_deg: float = 0,
    ) -> bool:
        """Check if a point is inside the triangle."""
        # Translate point to origin
        px = x - cx
        py = y - cy

        # Rotate point in opposite direction (to simulate triangle rotation)
        if rotation_deg != 0:
            angle_rad = -math.radians(rotation_deg)
            cos_a = math.cos(angle_rad)
            sin_a = math.sin(angle_rad)
            px, py = px * cos_a - py * sin_a, px * sin_a + py * cos_a

        # Equilateral triangle with point up at 0° rotation
        v0 = (0, -size)  # Top vertex
        v1 = (
            size * math.cos(math.radians(30)),
            size * math.sin(math.radians(30)),
        )  # Bottom right
        v2 = (
            size * math.cos(math.radians(150)),
            size * math.sin(math.radians(150)),
        )  # Bottom left

        def sign(p1, p2, p3):
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

        p = (px, py)
        d1 = sign(p, v0, v1)
        d2 = sign(p, v1, v2)
        d3 = sign(p, v2, v0)

        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)

        return not (has_neg and has_pos)

    def max_inscribed_square(
        self, size: float, rotation_deg: float = 0
    ) -> Tuple[float, float, float]:
        """Calculate the maximum inscribed axis-aligned square.

        For an equilateral triangle with point up, the optimal square
        has its bottom edge touching the base.

        Derivation:
        - Top vertex at (0, -size), base at y = size/2
        - Right slant: x = sqrt(3)/3 * (y + size)
        - Square bottom at y = size/2, top-right corner at (s/2, size/2 - s)
        - Top-right must touch slant: s/2 = sqrt(3)/3 * (size/2 - s + size)
        - Solving: s = 3*sqrt(3)*size / (3 + 2*sqrt(3)) ≈ 0.804 * size
        - Square center offset_y = size/2 - s/2 ≈ 0.098 * size

        Args:
            size: The triangle size (center to vertex distance)
            rotation_deg: Rotation angle in degrees

        Returns:
            Tuple of (offset_x, offset_y, square_side)
        """
        # s = 3*sqrt(3)*size / (3 + 2*sqrt(3)) ≈ 0.804 * size
        # Apply 1% safety margin to avoid edge cases
        square_side = 3 * math.sqrt(3) * size / (3 + 2 * math.sqrt(3)) * 0.99

        # Square center is at y = size/2 - s/2 (offset toward base)
        # Adjust slightly inward from the base
        base_offset_y = size / 2 - square_side / 2 - 0.01 * size

        # Apply rotation to the offset vector
        if rotation_deg != 0:
            angle_rad = math.radians(rotation_deg)
            cos_a = math.cos(angle_rad)
            sin_a = math.sin(angle_rad)
            offset_x = -base_offset_y * sin_a
            offset_y = base_offset_y * cos_a
        else:
            offset_x = 0
            offset_y = base_offset_y

        return (offset_x, offset_y, square_side)
