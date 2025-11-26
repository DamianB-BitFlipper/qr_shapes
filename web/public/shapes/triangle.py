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
        """Check if a point is inside the triangle.

        Uses barycentric coordinates to determine if the point is inside.
        The triangle rotates around its centroid.
        """
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
        # Vertices at angles -90°, 30°, 150° from center
        # For point-up triangle: top vertex at -90° (pointing up)
        v0 = (0, -size)  # Top vertex
        v1 = (
            size * math.cos(math.radians(30)),
            size * math.sin(math.radians(30)),
        )  # Bottom right
        v2 = (
            size * math.cos(math.radians(150)),
            size * math.sin(math.radians(150)),
        )  # Bottom left

        # Barycentric coordinate check
        def sign(p1, p2, p3):
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

        p = (px, py)
        d1 = sign(p, v0, v1)
        d2 = sign(p, v1, v2)
        d3 = sign(p, v2, v0)

        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)

        return not (has_neg and has_pos)

    def calculate_size(self, qr_side: float) -> float:
        """Calculate triangle size to contain a centered square.

        For an equilateral triangle to contain a square of side S centered
        at the centroid, we need the triangle to be large enough that all
        four corners of the square are inside.

        The inscribed circle of an equilateral triangle has radius = size/2.
        The square's half-diagonal is S * sqrt(2) / 2.
        So we need: size/2 >= S * sqrt(2) / 2
        Therefore: size >= S * sqrt(2)

        We add a 20% margin because the centroid is not equidistant from all edges.
        """
        return qr_side * math.sqrt(2) * 1.2
