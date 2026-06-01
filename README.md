# 🛠️ Little Lucey Woodcraft

> A premium, interactive 3D Parametric modeler and design tool built for woodworkers, cabinet makers, and DIY enthusiasts.

Little Lucey Woodcraft brings professional-grade 3D woodworking design straight to the browser. Built on React and Three.js, it allows you to dynamically build, modify, and optimize cabinets, furniture, face frames, and shelving in real time. It automatically generates high-accuracy cut lists, boundary dimensions, and step-by-step assembly tutorials.

---

## ✨ Features

*   **⚡ Parametric Builders**: Generate complex assemblies in seconds using specialized builders for Cabinets, Drawers, Boxes, Shaker Doors, Face Frames, Shelving, and Table Bases/Tops.
*   **📐 Active 3D Viewport**: Edit and align components in real time using a precision 3D grid, measurements, boundary selection envelopes, and snapping constraints.
*   **📋 Automated Cut Lists**: Instant generation of material cut lists showing accurate widths, lengths, thickness, and wood species (Pine, Cherry, Walnut, Oak).
*   **🔴 Step-by-Step Recorder**: Record your assembly processes to create visual guides and shop tutorials for your assembly workflows.
*   **💡 Interactive Environments**: Toggle between light and dark workbench settings, adjust directional/ambient lighting, and review wood materials in realistic viewport renders.
*   **🤖 AI Design Helper**: Integrated Gemini assistant trained specifically to help with woodworking calculations, construction advice, and coordinate layout guidelines.

---

## 🛠️ Technology Stack

Little Lucey Woodcraft is built using a modern, lightweight, high-performance web tech stack:

*   **Core Logic**: [React 19](https://react.dev) (UI) & [Zustand 5](https://github.com/pmndrs/zustand) (State Management)
*   **3D Rendering**: [Three.js](https://threejs.org), [React Three Fiber](https://github.com/pmndrs/react-three-fiber), and [Drei](https://github.com/pmndrs/drei)
*   **Geometry Operations**: [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) and [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) for real-time spatial physics, snapping, and CSG cutouts
*   **Build Tool & Styling**: [Vite](https://vite.dev) and Vanilla CSS

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org) (v18 or higher) and a package manager (`npm` or `pnpm`) installed.

### Setup & Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/vinyasa/sketch.git
    cd sketch
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open your browser and navigate to `http://localhost:5173/sketch/` (or the URL printed in your terminal).

### Production Build

To build the static production bundle:
```bash
npm run build
```
This outputs a optimized, single-page bundle in the `/dist` directory, ready to be hosted on GitHub Pages, Netlify, Vercel, or custom shared hosting.

---

## 📖 Documentation & Support

*   **User Guide & Workshop Manual**: Read the step-by-step guide on coordinates, dimensions, and assembly styles inside the application under the **📖 Open User's Guide** settings card, or view the source raw document in [docs/user_manual.md](docs/user_manual.md).
*   **Development & Versioning**: For developers interested in releasing patches or understanding the CalVer pipeline, see our internal [docs_local/versioning_guide.md](docs_local/versioning_guide.md) (local-only guide).

---

## 🤝 Contributing

We welcome contributions from the woodworking and developer communities! Whether you are fixing a physics bug, improving coordinate Snapping, or writing new CSG templates:

1.  Review our guidelines in [CONTRIBUTING.md](CONTRIBUTING.md).
2.  Fork the repo and make your changes on a new branch.
3.  Open a Pull Request!

---

## 🙋 Support & Feedback

If you encounter an overlap physics bug, have an idea for a table builder, or need assembly support, please consult [SUPPORT.md](SUPPORT.md) on how to report issues and join the discussions.

---

## 📜 License

This project is licensed under the MIT License. See [Attribution.md](Attribution.md) for full license text and open-source attributions.
