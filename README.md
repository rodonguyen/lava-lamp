# Lava Lamp

A fullscreen interactive lava lamp built with React, Three.js, and GLSL ray marching.

**[Live Demo](https://rodonguyen.dev/lava-lamp)** (if deployed)

## Features

- Real-time ray-marched lava blobs with gooey SDF merging
- Bottom-up and top-down lighting with independent color palettes
- Separate water color palette for the liquid tint inside the cylinder
- Adjustable blob count, speed, gooeyness, and light intensities
- Bloom post-processing
- Smooth palette transitions when switching colors
- Orbit camera controls
- Fullscreen mode

## Tech Stack

- **React** + **Vite** for the app shell
- **Three.js** via `@react-three/fiber` for the 3D canvas
- **GLSL fragment shader** — custom ray marcher with SDF primitives (spheres, cylinders, torus)
- **@react-three/postprocessing** for bloom effects

## Getting Started

```bash
npm install
npm run dev
```

## Settings

Open the gear icon to configure:

| Setting | Description |
|---------|-------------|
| Palette | Light color theme (bottom + top light colors) |
| Water | Liquid tint color inside the cylinder |
| Bottom Light | Intensity of the light from below |
| Top Light | Intensity of the light from the top cap |
| Water Strength | How strongly the water color tints the liquid |
| Speed | Blob movement speed (slow / medium / fast) |
| Gooey | How much blobs merge together |
| Blobs | Number of active blobs (2–20) |
| Background | Background darkness level |

## Contributing

Forks and contributions are welcome! Feel free to open issues or submit pull requests.

## Author

Made for fun by [Rodo](https://rodonguyen.dev)
