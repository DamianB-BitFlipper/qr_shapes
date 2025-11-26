# Hexagon QR Code Generator

Generate high-definition QR codes with a unique hexagon design.

## Web App

**Live site:** https://www.damianb.dev/qr_shapes/

### Development

```bash
cd web
pnpm install
pnpm dev
```

Open http://localhost:5600 in your browser. The page auto-reloads when you edit files.

### Project Structure

```
qr_code/
├── python_files/              # Python QR generation logic (runs in browser via Pyodide)
│   └── qr_generator.py
├── web/                 # Next.js frontend
│   ├── app/
│   └── public/          # Python files copied here during build
└── .github/workflows/   # GitHub Actions for deployment
```

### Deployment

The site automatically deploys to GitHub Pages when you push to the `main` branch.

**Setup (one-time):**
1. Go to your repo Settings > Pages
2. Set Source to "GitHub Actions"

The GitHub Action will build and deploy the static site on every push to `main`.

---

Made using [ellamind](https://elluminate.de)'s resources.
