# 🤝 Contributing to Little Lucey Woodcraft

First off, thank you for considering contributing to Little Lucey Woodcraft! It’s community members like you that help build the ultimate 3D woodshop design helper.

Please review this guide to understand our contribution process, coding conventions, and pull request guidelines.

---

## 🏗️ Development Setup

The application is structured inside a modern monorepo build system:

1.  **Fork** the repository on GitHub.
2.  **Clone** your fork locally:
    ```bash
    git clone https://github.com/your-username/sketch.git
    cd sketch
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    ```
4.  **Create your feature branch**:
    ```bash
    git checkout -b feature/your-awesome-feature
    ```
5.  **Run in development mode**:
    ```bash
    npm run dev
    ```

---

## 🎨 Coding Standards & Conventions

To keep our codebase clean, robust, and readable:

### 1. Code Style & Linting
We enforce ESLint standard rules. Before submitting a pull request, run the linter and resolve any errors:
```bash
npm run lint
```

### 2. State Management (Zustand)
*   **Store Actions**: All application states reside in `src/store/useStore.js`. Do not modify store fields directly inside components. Instead, write a clean setter or action function inside the store slice and invoke it from components.
*   **Performance**: Use selective state hooks (e.g. `const boards = useStore(s => s.boards)` rather than `const { boards } = useStore()`) to prevent unnecessary component re-renders.

### 3. Coordinate Coordinate Conventions
Our woodshop grid coordinates adhere strictly to standard woodworking axes:
*   **X Axis**: Left-to-Right (Width)
*   **Y Axis**: Vertical / Ground-to-Sky (Height)
*   **Z Axis**: Front-to-Back (Depth)

Ensure all CSG cuts, board generation vectors, and builder templates respect these bounds.

---

## 🔄 Pull Request Guidelines

When you are ready to submit your code:

1.  **Sync your branch**: Merge the latest commits from the main repository `upstream/main` branch into your local branch to resolve any merge conflicts early.
2.  **Make atomic commits**: Write short, descriptive commit messages (e.g., `feat: add face frame thickness slider` or `fix: resolve shelf snap collision overlap`).
3.  **Submit the PR**:
    *   Explain what your change accomplishes and the design choices you made.
    *   Reference any related GitHub issues (e.g., `Closes #42`).
    *   Include a screenshot or GIF demonstrating any visual UI/UX or viewport changes!

---

## 🏷️ Releasing & Version Bumping Policy

To keep releases clean and consistent:

> [!IMPORTANT]
> **Please do not manually edit `src/version.json` in your pull requests.**
> 
> The project maintainers manage software versions. When your pull request is approved and merged, a maintainer will run the automated CLI tool (`npm run bump`) to calculate the daily CalVer suffix, commit, tag, and publish the new build. 

---

## 📜 License
By contributing to Little Lucey Woodcraft, you agree that your contributions will be licensed under the project's MIT License. Full open-source attributions can be reviewed in `Attribution.md`.
