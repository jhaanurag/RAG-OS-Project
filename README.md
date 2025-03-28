# Resource Allocation Graph Simulator with Deadlock detection
# Python Resource Allocation Graph (RAG) Simulator

A graphical user interface (GUI) tool built with Python, Tkinter, Matplotlib, and NetworkX to simulate Resource Allocation Graphs (RAGs), visualize resource requests and allocations, and detect potential deadlock scenarios.


## Overview

This application provides an interactive way to understand concepts related to resource allocation and deadlocks in operating systems. Users can:

*   Add processes and resources to the graph.
*   Simulate resource allocation (a resource assigned to a process).
*   Simulate resource waiting (a process requesting an allocated resource).
*   Release resources held by processes.
*   Visualize the RAG dynamically using Matplotlib embedded in a Tkinter window.
*   Automatically detect and visually highlight deadlock cycles within the graph.
*   Run simulations step-by-step or continuously.
*   View a log of all actions performed.

## Features

*   **GUI Interface:** Built with Tkinter for user-friendly interaction.
*   **Graph Visualization:** Uses NetworkX for graph data structure and Matplotlib for plotting the RAG.
    *   Processes shown as blue circles.
    *   Resources shown as red squares (free) or orange squares (allocated).
    *   Allocation edges (Resource -> Process) shown as solid black arrows.
    *   Wait/Request edges (Process -> Resource) shown as dashed gray arrows.
*   **Interactive Controls:** Buttons for adding nodes, creating allocation/wait edges, and releasing resources.
*   **Deadlock Detection:** Automatically detects cycles using `networkx.simple_cycles` whenever the graph is updated. It specifically checks if cycles represent valid deadlock conditions (processes waiting for resources held by other processes within the cycle).
*   **Deadlock Highlighting:** Nodes involved in a detected deadlock flash between yellow and red.
*   **Step-by-Step Simulation:** Option to queue actions and execute them one by one to observe the graph's evolution.
*   **Action Logging:** A scrolled text area displays a timestamped log of all operations.
*   **Graph Clearing:** Reset the simulation environment.
*   **(Basic) Drag-and-Drop:** Rudimentary support for creating edges by dragging between nodes on the canvas (may require careful clicking near node centers).

## Requirements

*   Python 3.x
*   Tkinter (usually included with standard Python distributions)
*   Matplotlib
*   NetworkX

## Installation

1.  **Clone the repository or download the script:**
    ```bash
    git clone <repository-url> # Or download the .py file
    cd <repository-directory>
    ```
2.  **Install the required libraries:**
    ```bash
    pip install matplotlib networkx
    ```

## How to Use

1.  **Run the script:**
    ```bash
    python your_script_name.py
    ```
    (Replace `your_script_name.py` with the actual name of the Python file).

2.  **Interact with the GUI:**
    *   **Add Process/Resource:** Click the buttons to add new nodes to the graph.
    *   **Select Nodes:** Click on process or resource names in the listboxes on the right to select them for edge operations.
    *   **Allocate:** Assigns the selected *free* resource to the selected process (creates R -> P edge).
    *   **Wait Allocation:** Makes the selected process request the selected *allocated* resource (creates P -> R edge).
    *   **Release:** Removes the edge associated with the selected process and resource (either allocation or wait edge). If an allocation is released and the resource becomes free, its color changes back to red.
    *   **Toggle Step Mode:** Switch between immediate execution of actions and queuing them for step-by-step execution using the "Next Step" button.
    *   **Next Step:** (Visible in Step Mode) Executes the next queued action.
    *   **Clear Graph:** Resets the entire simulation.
    *   **Observe:** The graph display updates automatically. Deadlocks, if detected, will be highlighted with flashing nodes, and a message box will appear. Check the log area for details on actions and deadlock detection.

## Deadlock Detection Logic

*   The simulator uses NetworkX's `simple_cycles` function to find all elementary cycles in the directed graph.
*   For each cycle found, it verifies if it represents a valid potential deadlock by checking if all resources within that cycle are currently in an "allocated" state.
*   If a valid deadlock cycle is found, the `deadlock_flag` is set, a message is logged and displayed, and the nodes in the cycle start flashing on the graph visualization.

## Limitations

*   The deadlock detection logic assumes **single-instance resources**. It correctly identifies cycles, which correspond to deadlocks in single-instance scenarios. It does not implement more complex algorithms (like Banker's) needed for multi-instance resources.
*   The graph layout uses `nx.spring_layout`, which can result in different node positions each time the graph is plotted.
*   The drag-and-drop functionality is basic and might require precise clicks near node centers.
*   GUI layout is functional but could be enhanced.

## Future Scope

*   Implement support for multiple instances of resources.
*   Integrate deadlock avoidance algorithms (e.g., Banker's Algorithm).
*   Improve graph layout options (e.g., fixed positions, other layout algorithms).
*   Enhance the GUI design and user experience.
*   Add functionality to save and load graph states.

---

Feel free to contribute by reporting issues or submitting pull requests!
