# Resource Allocation Graph Simulator with Deadlock detection
# Graphical Simulator for Resource Allocation Graphs (RAG)

**Version:** 1.2
**Authors:** Amit, Anurag, Himanshu

A simple, interactive, browser-based graphical simulation tool for visualizing Resource Allocation Graphs (RAGs) and identifying potential deadlock scenarios (cycles). Built with HTML, CSS (Tailwind), and JavaScript Canvas, it serves as a visual aid for learning Operating Systems concepts.

![RAG Simulator Screenshot Placeholder](placeholder.png)
*(Suggestion: Replace placeholder.png with an actual screenshot or GIF of the simulator in action)*

## Overview

**Goal:** To develop a graphical tool using web technologies for visualizing RAGs and analyzing potential deadlock cycles interactively.

**Key Outcomes & Features:**

*   **Graphical RAG Visualization:** Represents processes (circles) and resources (squares).
*   **Interactive Graph Building:**
    *   Add Processes (`P`) and Resources (`R`).
    *   Create Request edges (P->R, `Q`).
    *   Create Assignment edges (R->P, `A`).
    *   Remove selected nodes (`Delete`/`Backspace`/`X`) or edges (button).
*   **Drag-and-Drop:** Reposition nodes easily on the canvas.
*   **On-Demand Deadlock Detection:** Identifies and highlights cycles in the graph (`D`).
*   **Visual Indicators:**
    *   Color-coding for node types and edge types.
    *   Selection highlighting (yellow).
    *   Deadlock highlighting (purple).
    *   Basic node creation animation.
*   **User Feedback:** Status bar provides messages about actions and detection results.
*   **Keyboard Shortcuts:** Speed up interactions (see below).
*   **Clear Options:** Clear current selection (`Escape`) or the entire canvas (`C`).
*   **About Modal:** Provides quick help and shortcut reference.

**Scope:**

*   Primarily designed as an educational tool for OS students.
*   Focuses on single-instance resource scenarios for cycle detection.
*   Does *not* implement step-by-step deadlock analysis or resolution algorithms (like Banker's) in this version.

## How to Use

1.  **Clone or Download:** Get the project files from this repository.
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Open in Browser:** Simply open the `index.html` file (or the main HTML file) in your web browser (like Chrome, Firefox, Edge).

*(Optional: Add a link if you deploy it online)*
*   **Live Demo:** [Link to Live Demo - Add URL here if applicable]

## Keyboard Shortcuts

*   `P`: Add Process node
*   `R`: Add Resource node
*   `Q`: Make Request edge (P->R) - *Requires one Process and one Resource selected*
*   `A`: Make Assignment edge (R->P) - *Requires one Process and one Resource selected*
*   `Delete` / `Backspace` / `X`: Remove the currently selected single node
*   `D`: Detect Deadlock (cycles)
*   `Escape`: Clear current node selection(s)
*   `C`: Clear All nodes and edges (requires confirmation)

## Deadlock Detection

*   The simulator uses a **Depth-First Search (DFS)** algorithm to detect cycles within the graph structure.
*   A cycle in a Resource Allocation Graph indicates a potential deadlock condition (assuming single-instance resources).
*   When a deadlock is detected by pressing `D` or clicking the "Detect Deadlock" button:
    *   A message appears in the status bar indicating the detected cycle.
    *   The nodes involved in the cycle are highlighted with a distinct border color (purple).

## Technology Stack

*   **Languages:** JavaScript (ES6+)
*   **Web:** HTML5, CSS3 (using Tailwind CSS via CDN)
*   **Graphics:** HTML5 Canvas API (2D Context)
*   **Version Control:** Git / GitHub (Assumed)

## Conclusion

This simulator provides a basic but functional tool for interactively learning about Resource Allocation Graphs and the concept of deadlock detection through cycle identification in a visual manner.

## Future Scope

*   Enhance GUI and add more sophisticated animations.
*   Add support for multiple resource instances.
*   Implement deadlock prevention/avoidance algorithms (e.g., Banker's Algorithm).
*   Implement save/load functionality for graph states (e.g., using JSON).
*   Add step-by-step simulation controls to observe allocation/request sequences.
*   Deploy the tool as a persistent web application.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an Issue to discuss potential improvements or report bugs.

## References

*   *Operating System Concepts* – Abraham Silberschatz, Peter Baer Galvin, Greg Gagne.
*   MDN Web Docs: Canvas API - [https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
*   Tailwind CSS - [https://tailwindcss.com/](https://tailwindcss.com/)

---
