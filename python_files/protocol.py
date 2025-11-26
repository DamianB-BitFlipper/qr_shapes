"""Protocol definition for QR code shape generators."""

from typing import Protocol, List, Tuple


class QRAble(Protocol):
    """Protocol for shapes that can contain a QR code.

    Implementations must provide methods to:
    - Check if a point is inside the shape
    - Calculate the maximum inscribed square for the QR code
    - Get rotation presets for the shape
    """

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
        ...

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
        ...

    @property
    def name(self) -> str:
        """Human-readable name of the shape."""
        ...

    @property
    def rotation_presets(self) -> List[Tuple[str, int]]:
        """List of (label, degrees) rotation presets for this shape."""
        ...
