# 🙋 Getting Support for Little Lucey Woodcraft

Thank you for using Little Lucey Woodcraft!

> [!NOTE]
> **A quick note about this project:** I am not a professional software developer. I am a hobby tech nerd and a passionate woodworker building this tool in my spare time to solve real challenges in my own shop.
> 
> **Please be understanding and kind:** This is a very new open-source release, and you will likely encounter some rough edges, bugs, or missing features. If you find something frustrating or unintuitive about the app, please just say so in our **Discussions** area. Honest, constructive feedback is exactly what will help us learn and improve!
> 
> Because this is a solo hobby project, I don't have the capacity to offer dedicated, individual technical support, personal debugging, or email troubleshooting. To ensure this project remains sustainable, fun, and open to all, **I highly encourage everyone to steer toward our GitHub community support features.** Let's help each other build better things together!

---

## 💬 Community Q&A and Discussions

If you have general woodworking questions, need advice on structuring a particular cabinet assembly, or want to discuss the future of this project:
*   **Join the GitHub Discussions**: Head over to the [GitHub Discussions tab](https://github.com/vinyasa/sketch/discussions) on our repository.
*   **Share Your Layouts**: Post screenshots of your 3D models or share photos of your completed real-world woodworking projects!
*   **Help Your Fellow Builders**: If you see someone asking a question, please jump in and share your knowledge!

---

## 🐞 Reporting Bugs

If you find a collision-physics issue, a builder rendering bug, or viewport layout glitch, please open a bug report on GitHub:

1.  **Check existing issues**: Before filing a new report, search our [GitHub Issues](https://github.com/vinyasa/sketch/issues) to see if someone else has already reported the problem.
2.  **Provide context**: When creating a new issue, please include:
    *   **🚨 Software Version**: Go to the **Settings Panel** (⚙️) inside the application, scroll to the bottom, and copy the version string (e.g., `v0.8.26.05.29`). **This is the most critical piece of information for us!**
    *   **Operating System**: (e.g., Windows 11, macOS Sequoia, Ubuntu)
    *   **Web Browser**: (e.g., Chrome 124, Firefox 125, Safari 17)
    *   **Step-by-Step Reproduction**: Explain exactly what you clicked or generated to cause the error.
    *   **Screenshots/Console Logs**: If possible, attach a screenshot of your 3D viewport or paste any red error text appearing in the browser's developer console (F12).

---

##💡 Feature Requests & Feedback

Have an idea for a new builder (e.g., drawer glides, mortise-and-tenon templates, specialized crown molding)? Or suggestions on making the 3D orbit controls more intuitive?

We would love to hear them! Please submit feature requests by opening an issue on GitHub and choosing the **Feature Request** template.

---

## 🔧 Quick Troubleshooting Checks

If the application is rendering a blank screen or failing to load your previous workspace save:

### 1. Clear Your Local Cache
The application heavily relies on your browser's persistent `localStorage` cache to autosave your progress. If this data becomes corrupt or outdated:
*   Open the **Settings Panel** (⚙️).
*   Scroll to the very bottom to the **System Storage Cache** card.
*   Click **Wipe Local Cache**, then click **Yes, wipe it**.
*   The page will reload with a fresh, clean workbench canvas.

### 2. Browser WebGL Support
Little Lucey Woodcraft requires WebGL acceleration to run the Three.js 3D viewport. 
*   Ensure that **Hardware Acceleration** is enabled in your browser settings.
*   Visit [get.webgl.org](https://get.webgl.org/) to verify if your device supports WebGL.

---

## 🛡️ Security Vulnerabilities

Please do not report security vulnerabilities publicly via GitHub Issues. Instead, send an email to the project maintainer at `your-email@example.com` (placeholder - please edit in your repository). We will acknowledge and address the vulnerability as quickly as possible.
