# QR Code Generator

Generate high-definition QR code PNGs from URLs.

## Usage

```bash
# Basic usage
uv run python generate_qr.py "https://your-url.com"

# Custom output filename
uv run python generate_qr.py "https://your-url.com" -o my_qr.png

# Custom size (larger = higher resolution)
uv run python generate_qr.py "https://your-url.com" -s 30
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `url` | The URL to encode | (required) |
| `-o, --output` | Output filename | `qrcode.png` |
| `-s, --size` | Box size in pixels | `20` |

## Examples

```bash
# Generate a standard QR code
uv run python generate_qr.py "https://example.com"

# Generate a large QR code for print
uv run python generate_qr.py "https://example.com" -s 40 -o print_qr.png
```
