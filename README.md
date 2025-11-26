# Hexagon QR Code Generator

Generate high-definition QR codes with a unique hexagon design. Available as a CLI tool and a web app.

## Web App

### Development

```bash
cd web
pnpm install
pnpm dev
```

Open http://localhost:5600 in your browser. The page auto-reloads when you edit files.

### Deployment

The site automatically deploys to GitHub Pages when you push to the `main` branch.

**Setup (one-time):**
1. Go to your repo Settings > Pages
2. Set Source to "GitHub Actions"

The GitHub Action will build and deploy the static site on every push to `main`.

## CLI Tool

### Usage

```bash
# Standard QR code
uv run python generate_qr.py "https://your-url.com"

# Hexagon QR code
uv run python generate_qr.py "https://your-url.com" --hex

# Custom output and size
uv run python generate_qr.py "https://your-url.com" --hex -o my_qr.png -s 30
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `url` | The URL to encode | (required) |
| `--hex` | Generate hexagon shape | `false` |
| `-o, --output` | Output filename | `qrcode.png` |
| `-s, --size` | Box size in pixels | `20` |
