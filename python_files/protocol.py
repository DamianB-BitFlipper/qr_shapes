"""Protocol definition for QR code shape generators."""

from typing import Protocol, List, Tuple


class QRAble(Protocol):
    """Protocol for shapes that can contain a QR code.

    Implementations must provide methods to:
    - Check if a point is inside the shape
    - Calculate the size needed to contain a QR code
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

    def calculate_size(self, qr_side: float) -> float:
        """Calculate the shape size needed to contain a square QR code.

        Args:
            qr_side: Side length of the QR code (including padding)

        Returns:
            The size parameter for this shape
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
