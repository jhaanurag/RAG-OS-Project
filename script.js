const canvas = document.getElementById("ragCanvas");
const ctx = canvas.getContext("2d");
const logContainer = document.getElementById("logContainer");
const aboutModal = document.getElementById("aboutModal");
const addProcessModal = document.getElementById("addProcessModal");
const addResourceModal = document.getElementById("addResourceModal");
const scriptModal = document.getElementById("scriptModal");
const exportModal = document.getElementById("exportModal");
const aboutButton = document.getElementById("aboutButton");
const closeModalButton = document.getElementById("closeModalButton");
const scriptButton = document.getElementById("scriptButton");
const exportScriptButton = document.getElementById("exportScriptButton");
const processIdInput = document.getElementById("processIdInput");
const resourceIdInput = document.getElementById("resourceIdInput");
const resourceInstancesInput = document.getElementById(
  "resourceInstancesInput"
);
const scriptInput = document.getElementById("scriptInput");
const exportScriptArea = document.getElementById("exportScriptArea");
const copyScriptButton = document.getElementById("copyScriptButton");
const visualizeDeadlockBtn = document.getElementById("visualizeDeadlockBtn");
const stepDeadlockVizBtn = document.getElementById("stepDeadlockVizBtn");
const runDeadlockVizBtn = document.getElementById("runDeadlockVizBtn");
const stopDeadlockVizBtn = document.getElementById("stopDeadlockVizBtn");
const bodyElement = document.body;

const PROCESS_COLOR = "#bae6fd";
const RESOURCE_COLOR = "#fed7aa";
const REQUEST_EDGE_COLOR = "#ef4444";
const ASSIGN_EDGE_COLOR = "#22c55e";
const NODE_SELECTED_COLOR = "#facc15";
const NODE_STROKE_COLOR = "#1f2937";
const TEXT_COLOR = "#1f2937";
const INSTANCE_TEXT_COLOR = "#374151";
const PROCESS_RADIUS = 31;
const RESOURCE_SIZE = 55;
const RESOURCE_TEXT_FONT_SIZE = 12;
const ARROW_SIZE = 8;
const GAP = 5;
const ANIMATION_DURATION = 600;
const MAX_LOG_ENTRIES = 150;

let nodes = [];
let edges = [];
let logs = [];
let processCounter = 0;
let resourceCounter = 0;
let selectedNode1 = null;
let selectedNode2 = null;
let draggingNode = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let animationFrameId = null;
let activeModal = null;

let deadlockedNodes = new Set();
let isVisualizingDeadlock = false;
let deadlockVizState = null;
let deadlockVizGeneratorInstance = null;

function closeIntroModal() {
  const dontShowCheckbox = document.getElementById("dontShowIntroAgain");
  if (dontShowCheckbox && dontShowCheckbox.checked) {
    try {
      localStorage.setItem("ragIntroShown", "true");
      logMessage("INFO", "Introduction modal won't be shown again.");
    } catch (e) {
      console.error("LocalStorage not available or failed:", e);
      logMessage(
        "WARN",
        "Could not save 'don't show again' preference (LocalStorage might be disabled)."
      );
    }
  }
  closeModal("introModal");
}

function logMessage(level, message, isStep = false) {
  const timestamp = new Date().toLocaleTimeString([], {
    hour12: false,
  });
  const entry = { timestamp, level, message, isStep };
  logs.push(entry);
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.shift();
  }
  renderLogs();
}
function renderLogs() {
  logContainer.innerHTML = "";
  logs.forEach((entry) => {
    const div = document.createElement("div");
    div.className = "log-entry";
    if (entry.isStep) {
      div.classList.add("viz-step");
    }
    if (entry.level === "DEADLOCK" || entry.level === "VIZ_RESULT") {
      div.classList.add("viz-result");
    }
    let levelIndicator = "";
    let colorClass = "text-gray-700";
    if (entry.level === "ERROR") {
      levelIndicator = "[ERR] ";
      colorClass = "text-red-600 font-semibold";
    } else if (entry.level === "WARN") {
      levelIndicator = "[WARN] ";
      colorClass = "text-yellow-600";
    } else if (entry.level === "DEADLOCK") {
      levelIndicator = "[DEADLOCK] ";
      colorClass = "text-purple-600 font-semibold";
    } else if (entry.level === "SUCCESS") {
      levelIndicator = "[OK] ";
      colorClass = "text-green-600";
    } else if (entry.level === "VIZ") {
      levelIndicator = "[VIZ] ";
      colorClass = "text-blue-600";
    } else if (entry.level === "VIZ_RESULT") {
      levelIndicator = "[RESULT] ";
      colorClass = entry.message.includes("DEADLOCK")
        ? "text-purple-600"
        : "text-green-600";
    }
    div.innerHTML = `<time>${entry.timestamp}</time> <span class="${colorClass}">${levelIndicator}${entry.message}</span>`;
    logContainer.appendChild(div);
  });
  logContainer.scrollTop = logContainer.scrollHeight;
}
function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY,
  };
}
function isPointInNode(node, x, y) {
  const scale = node.currentScale ?? 1.0;
  if (node.type === "process") {
    const dx = x - node.x;
    const dy = y - node.y;
    return dx * dx + dy * dy <= Math.pow(PROCESS_RADIUS * scale, 2);
  } else {
    const halfSize = (RESOURCE_SIZE / 2) * scale;
    return (
      x >= node.x - halfSize &&
      x <= node.x + halfSize &&
      y >= node.y - halfSize &&
      y <= node.y + halfSize
    );
  }
}
function getNodeAtPos(x, y) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (
      isPointInNode(nodes[i], x, y) &&
      (!nodes[i].isAnimating || nodes[i].currentScale > 0.8)
    ) {
      return nodes[i];
    }
  }
  return null;
}
function findNodeById(nodeId) {
  return nodes.find((n) => n.id === nodeId);
}
function clearSelection() {
  if (selectedNode1 || selectedNode2) {
    logMessage("INFO", `Selection cleared.`);
    selectedNode1 = null;
    selectedNode2 = null;
    ensureAnimationLoop();
  }
}
function removeEdge(node1Id, node2Id) {
  const initialLength = edges.length;
  let removedType = null;
  edges = edges.filter((edge) => {
    const match =
      (edge.from === node1Id && edge.to === node2Id) ||
      (edge.from === node2Id && edge.to === node1Id);
    if (match) removedType = edge.type;
    return !match;
  });
  return { success: edges.length < initialLength, type: removedType };
}
function getAvailableInstances(resourceNode) {
  if (!resourceNode || resourceNode.type !== "resource") return 0;
  const assignedCount = edges.filter(
    (edge) => edge.from === resourceNode.id && edge.type === "assignment"
  ).length;
  return resourceNode.totalInstances - assignedCount;
}
function getEdgePoints(node1, node2) {
  const dx = node2.x - node1.x;
  const dy = node2.y - node1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0)
    return {
      start: { x: node1.x, y: node1.y },
      end: { x: node2.x, y: node2.y },
    };
  const unitX = dx / dist;
  const unitY = dy / dist;
  const node1Scale = node1.currentScale ?? 1.0;
  const node2Scale = node2.currentScale ?? 1.0;
  const startOffsetBase =
    node1.type === "process"
      ? PROCESS_RADIUS * node1Scale
      : (RESOURCE_SIZE / 2) * node1Scale;
  const endOffsetBase =
    node2.type === "process"
      ? PROCESS_RADIUS * node2Scale
      : (RESOURCE_SIZE / 2) * node2Scale;
  const startOffset = startOffsetBase + GAP;
  const endOffset = endOffsetBase + GAP;
  const totalOffset = startOffset + endOffset;
  const effectiveStartOffset =
    dist > totalOffset
      ? startOffset
      : dist * (startOffset / totalOffset || 0.5);
  const effectiveEndOffset =
    dist > totalOffset ? endOffset : dist * (endOffset / totalOffset || 0.5);
  return {
    start: {
      x: node1.x + unitX * effectiveStartOffset,
      y: node1.y + unitY * effectiveStartOffset,
    },
    end: {
      x: node2.x - unitX * effectiveEndOffset,
      y: node2.y - unitY * effectiveEndOffset,
    },
  };
}
function drawArrow(ctx, fromX, fromY, toX, toY, color) {
  if (Math.abs(fromX - toX) < 0.1 && Math.abs(fromY - toY) < 0.1) return;
  const headlen = ARROW_SIZE;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headlen * Math.cos(angle - Math.PI / 6),
    toY - headlen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headlen * Math.cos(angle + Math.PI / 6),
    toY - headlen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
function ensureAnimationLoop() {
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(draw);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const now = performance.now();
  let needsAnotherFrame = false;

  nodes.forEach((node) => {
    if (node.isAnimating) {
      needsAnotherFrame = true;
      const elapsed = now - node.animationStart;
      let progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      let easedProgress = easeOutCubic(progress);
      node.currentScale = easedProgress;
      node.currentAlpha = easedProgress;
      node.currentBlur = (1 - easedProgress) * 5;
      if (progress >= 1) {
        node.isAnimating = false;
        node.currentScale = 1.0;
        node.currentAlpha = 1.0;
        node.currentBlur = 0.0;
      }
    } else {
      node.currentScale = 1.0;
      node.currentAlpha = 1.0;
      node.currentBlur = 0.0;
    }
  });

  edges.forEach((edge) => {
    const node1 = findNodeById(edge.from);
    const node2 = findNodeById(edge.to);
    if (!node1 || !node2) return;
    const alpha1 = node1.currentAlpha ?? 1.0;
    const alpha2 = node2.currentAlpha ?? 1.0;
    const edgeAlpha = Math.min(alpha1, alpha2);
    if (edgeAlpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = edgeAlpha;
    const points = getEdgePoints(node1, node2);
    const color =
      edge.type === "request" ? REQUEST_EDGE_COLOR : ASSIGN_EDGE_COLOR;
    drawArrow(
      ctx,
      points.start.x,
      points.start.y,
      points.end.x,
      points.end.y,
      color
    );
    ctx.restore();
  });

  nodes.forEach((node) => {
    ctx.save();
    const scale = node.currentScale ?? 1.0;
    let alpha = node.currentAlpha ?? 1.0;
    const blur = node.currentBlur ?? 0.0;
    if (alpha <= 0.01 || scale <= 0.01) {
      ctx.restore();
      return;
    }

    ctx.globalAlpha = alpha;
    if (blur > 0.1) {
      ctx.filter = `blur(${blur}px)`;
    }

    let baseFillStyle =
      node.type === "process" ? PROCESS_COLOR : RESOURCE_COLOR;
    let strokeStyle = NODE_STROKE_COLOR;
    let lineWidth = 1;

    if (isVisualizingDeadlock && deadlockVizState) {
      needsAnotherFrame = true;
      const { visited, stack, current } = deadlockVizState;
      if (visited?.has(node.id)) {
        baseFillStyle = getComputedStyle(document.documentElement)
          .getPropertyValue("--viz-visited-fill")
          .trim();
        alpha = Math.min(alpha, 0.8);
      }
      if (stack?.has(node.id)) {
        strokeStyle = getComputedStyle(document.documentElement)
          .getPropertyValue("--viz-stack-stroke")
          .trim();
        lineWidth = 3;
      }
      if (current === node.id) {
        strokeStyle = getComputedStyle(document.documentElement)
          .getPropertyValue("--viz-current-stroke")
          .trim();
        lineWidth = 4;
      }
      ctx.globalAlpha = alpha;
    } else {
      let isSelected = node === selectedNode1 || node === selectedNode2;
      let isDeadlocked = deadlockedNodes.has(node.id);
      if (isDeadlocked) {
        strokeStyle = getComputedStyle(document.documentElement)
          .getPropertyValue("--viz-final-deadlock-stroke")
          .trim();
        lineWidth = 4;
        needsAnotherFrame = true;
      } else if (isSelected) {
        strokeStyle = NODE_SELECTED_COLOR;
        lineWidth = 3;
        needsAnotherFrame = true;
      }
    }

    ctx.fillStyle = baseFillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;

    if (node.type === "process") {
      const currentRadius = PROCESS_RADIUS * scale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      const currentSize = RESOURCE_SIZE * scale;
      const halfSize = currentSize / 2;
      ctx.fillRect(
        node.x - halfSize,
        node.y - halfSize,
        currentSize,
        currentSize
      );
      ctx.strokeRect(
        node.x - halfSize,
        node.y - halfSize,
        currentSize,
        currentSize
      );

      if (node.totalInstances > 1 && scale > 0.7 && alpha > 0.7) {
        ctx.filter = "none";
        const available = getAvailableInstances(node);
        ctx.fillStyle = INSTANCE_TEXT_COLOR;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const fontSize = Math.max(
          8,
          Math.round(RESOURCE_TEXT_FONT_SIZE * Math.min(scale, 1))
        );
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillText(
          `${available}/${node.totalInstances}`,
          node.x,
          node.y + fontSize * 0.1 + 8
        );
      }
    }

    if (scale > 0.6 && alpha > 0.6) {
      ctx.filter = "none";
      ctx.fillStyle = TEXT_COLOR;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.max(
        8,
        Math.round(14 * Math.min(scale, 1))
      )}px sans-serif`;
      ctx.globalAlpha = Math.min(1, alpha * 1.5);
      let textY = node.y;
      if (node.type === "resource" && node.totalInstances > 1) {
        textY -= RESOURCE_TEXT_FONT_SIZE * 0.6;
      }
      ctx.fillText(node.id, node.x, textY);
    }
    ctx.restore();
  });

  if (needsAnotherFrame || draggingNode || isVisualizingDeadlock) {
    animationFrameId = requestAnimationFrame(draw);
  } else {
    animationFrameId = null;
  }
}

function* visualizeDeadlockGenerator() {
  const adj = new Map();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((edge) => adj.get(edge.from)?.push(edge.to));
  const visited = new Set();
  const recursionStack = new Set();
  const path = [];
  let cycleFound = null;
  function* detectCycleUtil(nodeId) {
    if (cycleFound) return;
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);
    yield {
      visited: new Set(visited),
      stack: new Set(recursionStack),
      current: nodeId,
      path: [...path],
      status: `Visiting ${nodeId}, adding to stack. Path: ${path.join("->")}`,
    };
    const neighbors = adj.get(nodeId) || [];
    yield {
      visited: new Set(visited),
      stack: new Set(recursionStack),
      current: nodeId,
      path: [...path],
      status: `Exploring neighbors of ${nodeId}: [${neighbors.join(", ")}]`,
    };
    for (const neighborId of neighbors) {
      if (cycleFound) return;
      const neighborNode = findNodeById(neighborId);
      if (!neighborNode) {
        yield {
          visited: new Set(visited),
          stack: new Set(recursionStack),
          current: nodeId,
          path: [...path],
          status: `Neighbor ${neighborId} of ${nodeId} not found, skipping.`,
        };
        continue;
      }
      yield {
        visited: new Set(visited),
        stack: new Set(recursionStack),
        current: nodeId,
        path: [...path],
        status: `Checking neighbor ${neighborId} of ${nodeId}...`,
      };
      if (!visited.has(neighborId)) {
        yield {
          visited: new Set(visited),
          stack: new Set(recursionStack),
          current: nodeId,
          path: [...path],
          status: `Neighbor ${neighborId} not visited. Recursing...`,
        };
        yield* detectCycleUtil(neighborId);
      } else if (recursionStack.has(neighborId)) {
        const cycleStartIndex = path.indexOf(neighborId);
        cycleFound = path.slice(cycleStartIndex);
        yield {
          visited: new Set(visited),
          stack: new Set(recursionStack),
          current: nodeId,
          path: [...path],
          cycleFound: [...cycleFound],
          status: `CYCLE DETECTED! ${neighborId} is already in recursion stack. Cycle: ${cycleFound.join(
            " -> "
          )} -> ${neighborId}`,
        };
        return;
      } else {
        yield {
          visited: new Set(visited),
          stack: new Set(recursionStack),
          current: nodeId,
          path: [...path],
          status: `Neighbor ${neighborId} already visited but not in stack (no cycle via this path).`,
        };
      }
    }
    path.pop();
    recursionStack.delete(nodeId);
    yield {
      visited: new Set(visited),
      stack: new Set(recursionStack),
      current: nodeId,
      path: [...path],
      status: `Finished exploring ${nodeId}, removing from stack (backtracking).`,
    };
  }
  for (const node of nodes) {
    if (cycleFound) break;
    if (!visited.has(node.id)) {
      yield {
        visited: new Set(visited),
        stack: new Set(recursionStack),
        current: null,
        path: [...path],
        status: `Starting DFS from unvisited node ${node.id}...`,
      };
      yield* detectCycleUtil(node.id);
    }
  }
  if (cycleFound) {
    yield {
      visited: new Set(visited),
      stack: new Set(recursionStack),
      current: null,
      path: [],
      cycleFound: [...cycleFound],
      status: `DEADLOCK DETECTED involving: ${cycleFound.join(" -> ")} -> ${
        cycleFound[0]
      }`,
      finalResult: true,
    };
  } else {
    yield {
      visited: new Set(visited),
      stack: new Set(recursionStack),
      current: null,
      path: [],
      status: "No deadlock detected after checking all nodes.",
      finalResult: true,
    };
  }
}
function startDeadlockVisualization() {
  if (isVisualizingDeadlock) return;
  if (nodes.length === 0) {
    logMessage("WARN", "Cannot visualize deadlock: No nodes on canvas.");
    return;
  }
  isVisualizingDeadlock = true;
  deadlockedNodes.clear();
  deadlockVizGeneratorInstance = visualizeDeadlockGenerator();
  deadlockVizState = {
    visited: new Set(),
    stack: new Set(),
    current: null,
    path: [],
    status: "Visualization starting...",
    cycleFound: null,
  };
  logMessage("VIZ", "Starting deadlock detection visualization...");
  updateVisualizationUI();
  nextDeadlockStep();
  ensureAnimationLoop();
}
function stopDeadlockVisualization(completed = false) {
  if (!isVisualizingDeadlock) return;
  isVisualizingDeadlock = false;
  deadlockVizGeneratorInstance = null;
  if (!completed) {
    logMessage("VIZ", "Deadlock visualization stopped by user.");
  }
  deadlockVizState = null;
  updateVisualizationUI();
  ensureAnimationLoop();
}
function nextDeadlockStep() {
  if (!isVisualizingDeadlock || !deadlockVizGeneratorInstance) return;
  const result = deadlockVizGeneratorInstance.next();
  if (!result.done) {
    deadlockVizState = result.value;
    logMessage("VIZ", deadlockVizState.status, true);
    updateVisualizationUI();
    ensureAnimationLoop();
  } else {
    deadlockVizState = null;
    const finalState = result.value || {
      status: "Visualization completed unexpectedly.",
      cycleFound: null,
    };
    if (finalState.cycleFound) {
      finalState.cycleFound.forEach((id) => deadlockedNodes.add(id));
      logMessage(
        "VIZ_RESULT",
        `DEADLOCK DETECTED involving: ${finalState.cycleFound.join(
          " -> "
        )} -> ${finalState.cycleFound[0]}`
      );
    } else {
      deadlockedNodes.clear();
      logMessage("VIZ_RESULT", "No deadlock detected.");
    }
    stopDeadlockVisualization(true);
  }
}
function runDeadlockVizToEnd() {
  if (!isVisualizingDeadlock || !deadlockVizGeneratorInstance) return;
  logMessage("VIZ", "Running visualization to end...");
  let safetyCounter = 0;
  const maxSteps = nodes.length * nodes.length * 2;
  let result = deadlockVizGeneratorInstance.next();
  while (!result.done && safetyCounter++ < maxSteps) {
    result = deadlockVizGeneratorInstance.next();
  }
  deadlockVizState = null;
  const finalState = result.value || {
    status: "Visualization completed.",
    cycleFound: null,
  };
  if (finalState.cycleFound) {
    finalState.cycleFound.forEach((id) => deadlockedNodes.add(id));
    logMessage(
      "VIZ_RESULT",
      `DEADLOCK DETECTED involving: ${finalState.cycleFound.join(" -> ")} -> ${
        finalState.cycleFound[0]
      }`
    );
  } else {
    deadlockedNodes.clear();
    logMessage("VIZ_RESULT", "No deadlock detected.");
  }
  stopDeadlockVisualization(true);
  if (safetyCounter >= maxSteps) {
    logMessage("ERROR", "Visualization run exceeded maximum steps, stopping.");
  }
}
function updateVisualizationUI() {
  bodyElement.classList.toggle("visualizing", isVisualizingDeadlock);
  canvas.classList.toggle("visualizing", isVisualizingDeadlock);
  stepDeadlockVizBtn.disabled = !isVisualizingDeadlock;
  runDeadlockVizBtn.disabled = !isVisualizingDeadlock;
}

canvas.addEventListener("mousedown", (e) => {
  if (activeModal || isVisualizingDeadlock) return;
  const mousePos = getMousePos(canvas, e);
  const clickedNode = getNodeAtPos(mousePos.x, mousePos.y);
  if (clickedNode) {
    draggingNode = clickedNode;
    dragOffsetX = mousePos.x - clickedNode.x;
    dragOffsetY = mousePos.y - clickedNode.y;
    if (!selectedNode1) {
      selectedNode1 = clickedNode;
      logMessage("INFO", `Selected ${clickedNode.id}.`);
    } else if (selectedNode1 === clickedNode) {
    } else if (!selectedNode2) {
      if (selectedNode1.type === clickedNode.type) {
        logMessage("INFO", `Cleared selection. Selected ${clickedNode.id}.`);
        selectedNode1 = clickedNode;
        selectedNode2 = null;
      } else {
        selectedNode2 = clickedNode;
        logMessage(
          "INFO",
          `Selected ${selectedNode1.id} and ${selectedNode2.id}. Ready for edge action.`
        );
      }
    } else {
      selectedNode1 = clickedNode;
      selectedNode2 = null;
      logMessage("INFO", `Cleared selection. Selected ${clickedNode.id}.`);
    }
  } else {
    if (selectedNode1 || selectedNode2) {
      clearSelection();
    }
  }
  ensureAnimationLoop();
});
canvas.addEventListener("mousemove", (e) => {
  if (draggingNode && !activeModal && !isVisualizingDeadlock) {
    const mousePos = getMousePos(canvas, e);
    draggingNode.x = mousePos.x - dragOffsetX;
    draggingNode.y = mousePos.y - dragOffsetY;
    const dpr = window.devicePixelRatio || 1;
    const nodeSize =
      draggingNode.type === "process" ? PROCESS_RADIUS : RESOURCE_SIZE / 2;
    draggingNode.x = Math.max(
      nodeSize,
      Math.min(canvas.width / dpr - nodeSize, draggingNode.x)
    );
    draggingNode.y = Math.max(
      nodeSize,
      Math.min(canvas.height / dpr - nodeSize, draggingNode.y)
    );
    ensureAnimationLoop();
  }
});
canvas.addEventListener("mouseup", (e) => {
  if (draggingNode) {
    draggingNode = null;
    ensureAnimationLoop();
  }
});
canvas.addEventListener("mouseout", (e) => {
  if (draggingNode) {
    draggingNode = null;
    ensureAnimationLoop();
  }
});

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    if (modalId === "addProcessModal") {
      processIdInput.value = "";
      processIdInput.placeholder = `e.g., P${
        processCounter + 1
      } (auto-generated)`;
    } else if (modalId === "addResourceModal") {
      resourceIdInput.value = "";
      resourceIdInput.placeholder = `e.g., R${
        resourceCounter + 1
      } (auto-generated)`;
      resourceInstancesInput.value = "1";
    } else if (modalId === "exportModal") {
      exportScriptArea.value = generateScript();
      exportScriptArea.scrollTop = 0;
      copyScriptButton.textContent = "Copy to Clipboard";
    }
    modal.style.display = "flex";
    activeModal = modalId;
    ensureAnimationLoop();
  }
}
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "none";
    if (activeModal === modalId) {
      activeModal = null;
    }
    ensureAnimationLoop();
  }
}
window.addEventListener("click", (event) => {
  if (activeModal && event.target.classList.contains("modal")) {
    closeModal(activeModal);
  }
});

function _addNode(id, type, x, y, instances = 1) {
  if (findNodeById(id)) {
    logMessage("ERROR", `Node with ID '${id}' already exists.`);
    return null;
  }
  const newNode = {
    id: id,
    type: type,
    x: x,
    y: y,
    isAnimating: true,
    animationStart: performance.now(),
    currentScale: 0,
    currentAlpha: 0,
    currentBlur: 5,
  };
  if (type === "resource") {
    newNode.totalInstances = Math.max(1, instances);
  }
  nodes.push(newNode);
  logMessage(
    "SUCCESS",
    `Added ${type} node '${id}'` +
      (type === "resource"
        ? ` with ${newNode.totalInstances} instance(s).`
        : ".")
  );
  ensureAnimationLoop();
  return newNode;
}
function submitAddProcess() {
  let id = processIdInput.value.trim().toUpperCase();
  if (!id) {
    processCounter++;
    id = `P${processCounter}`;
  } else {
    if (!/^[a-zA-Z0-9_]+$/.test(id)) {
      logMessage("ERROR", "Invalid Process ID format.");
      alert("Invalid Process ID format.");
      return;
    }
    if (!id.startsWith("P")) id = "P" + id;
    const numPart = parseInt(id.substring(1));
    if (!isNaN(numPart) && numPart > processCounter) {
      processCounter = numPart;
    }
  }
  const dpr = window.devicePixelRatio || 1;
  const spawnX =
    Math.random() * ((canvas.width / dpr) * 0.8) + (canvas.width / dpr) * 0.1;
  const spawnY =
    Math.random() * ((canvas.height / dpr) * 0.8) + (canvas.height / dpr) * 0.1;
  if (_addNode(id, "process", spawnX, spawnY)) {
    closeModal("addProcessModal");
  }
}
function submitAddResource() {
  let id = resourceIdInput.value.trim().toUpperCase();
  const instances = parseInt(resourceInstancesInput.value) || 1;
  if (!id) {
    resourceCounter++;
    id = `R${resourceCounter}`;
  } else {
    if (!/^[a-zA-Z0-9_]+$/.test(id)) {
      logMessage("ERROR", "Invalid Resource ID format.");
      alert("Invalid Resource ID format.");
      return;
    }
    if (!id.startsWith("R")) id = "R" + id;
    const numPart = parseInt(id.substring(1));
    if (!isNaN(numPart) && numPart > resourceCounter) {
      resourceCounter = numPart;
    }
  }
  if (instances < 1 || instances > 100) {
    logMessage("ERROR", "Invalid instance count (1-100).");
    alert("Invalid instance count (1-100).");
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const spawnX =
    Math.random() * ((canvas.width / dpr) * 0.8) + (canvas.width / dpr) * 0.1;
  const spawnY =
    Math.random() * ((canvas.height / dpr) * 0.8) + (canvas.height / dpr) * 0.1;
  if (_addNode(id, "resource", spawnX, spawnY, instances)) {
    closeModal("addResourceModal");
  }
}
function _createEdge(fromId, toId, type) {
  const node1 = findNodeById(fromId);
  const node2 = findNodeById(toId);
  if (!node1 || !node2) {
    logMessage(
      "ERROR",
      `Cannot create edge: Node ${!node1 ? fromId : toId} not found.`
    );
    return false;
  }
  if (
    type === "request" &&
    !(node1.type === "process" && node2.type === "resource")
  ) {
    logMessage(
      "ERROR",
      `Invalid request edge: Must be P->R. Got ${fromId}(${node1.type}) -> ${toId}(${node2.type}).`
    );
    return false;
  }
  if (
    type === "assignment" &&
    !(node1.type === "resource" && node2.type === "process")
  ) {
    logMessage(
      "ERROR",
      `Invalid assignment edge: Must be R->P. Got ${fromId}(${node1.type}) -> ${toId}(${node2.type}).`
    );
    return false;
  }
  if (type === "assignment") {
    if (getAvailableInstances(node1) <= 0) {
      logMessage(
        "WARN",
        `Cannot assign ${fromId} to ${toId}: No available instances.`
      );
      return false;
    }
  }
  const conflictType = type === "request" ? "assignment" : "request";
  const { success: removedConflict } = removeEdge(node2.id, node1.id);
  if (removedConflict) {
    logMessage(
      "INFO",
      `Removed conflicting ${conflictType} edge between ${node2.id} and ${node1.id}.`
    );
  }
  const exists = edges.some(
    (edge) => edge.from === fromId && edge.to === toId && edge.type === type
  );
  if (exists) {
    logMessage(
      "INFO",
      `${
        type.charAt(0).toUpperCase() + type.slice(1)
      } edge ${fromId} -> ${toId} already exists.`
    );
    return true;
  }
  edges.push({ from: fromId, to: toId, type: type });
  logMessage("SUCCESS", `Added ${type} edge: ${fromId} -> ${toId}.`);
  ensureAnimationLoop();
  return true;
}
function requestEdgeAction(source = "Button") {
  if (!selectedNode1 || !selectedNode2) {
    logMessage("WARN", "Select one Process and one Resource first.");
    return false;
  }
  let pNode = null,
    rNode = null;
  if (selectedNode1.type === "process" && selectedNode2.type === "resource") {
    pNode = selectedNode1;
    rNode = selectedNode2;
  } else if (
    selectedNode1.type === "resource" &&
    selectedNode2.type === "process"
  ) {
    pNode = selectedNode2;
    rNode = selectedNode1;
  } else {
    logMessage(
      "WARN",
      "Select one Process and one Resource to make a request."
    );
    return false;
  }
  if (_createEdge(pNode.id, rNode.id, "request")) {
    clearSelection();
    return true;
  }
  return false;
}
function assignEdgeAction(source = "Button") {
  if (!selectedNode1 || !selectedNode2) {
    logMessage("WARN", "Select one Process and one Resource first.");
    return false;
  }
  let pNode = null,
    rNode = null;
  if (selectedNode1.type === "process" && selectedNode2.type === "resource") {
    pNode = selectedNode1;
    rNode = selectedNode2;
  } else if (
    selectedNode1.type === "resource" &&
    selectedNode2.type === "process"
  ) {
    pNode = selectedNode2;
    rNode = selectedNode1;
  } else {
    logMessage(
      "WARN",
      "Select one Process and one Resource to make an assignment."
    );
    return false;
  }
  if (_createEdge(rNode.id, pNode.id, "assignment")) {
    clearSelection();
    return true;
  }
  return false;
}
function removeEdgeAction() {
  if (!selectedNode1 || !selectedNode2) {
    logMessage("WARN", "Select two connected nodes to remove the edge.");
    return false;
  }
  const { success, type } = removeEdge(selectedNode1.id, selectedNode2.id);
  if (success) {
    logMessage(
      "SUCCESS",
      `Removed ${type ?? "edge"} between ${selectedNode1.id} and ${
        selectedNode2.id
      }.`
    );
    clearSelection();
    ensureAnimationLoop();
    return true;
  } else {
    logMessage(
      "INFO",
      `No direct edge found between ${selectedNode1.id} and ${selectedNode2.id}.`
    );
    return false;
  }
}
function _removeNode(nodeId) {
  const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) {
    logMessage("ERROR", `Cannot remove node: ID '${nodeId}' not found.`);
    return false;
  }
  const node = nodes[nodeIndex];
  nodes.splice(nodeIndex, 1);
  const initialEdgeCount = edges.length;
  edges = edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
  const removedEdges = initialEdgeCount - edges.length;
  deadlockedNodes.delete(nodeId);
  if (node.type === "process" && node.id === `P${processCounter}`) {
    processCounter--;
  } else if (node.type === "resource" && node.id === `R${resourceCounter}`) {
    resourceCounter--;
  }
  logMessage(
    "SUCCESS",
    `Removed node ${nodeId} and ${removedEdges} associated edge(s).`
  );
  ensureAnimationLoop();
  return true;
}
function removeNodeAction(source = "Button") {
  if (!selectedNode1 || selectedNode2) {
    logMessage("WARN", "Select exactly one node to remove.");
    return false;
  }
  const nodeIdToRemove = selectedNode1.id;
  if (_removeNode(nodeIdToRemove)) {
    clearSelection();
    return true;
  }
  return false;
}
function _clearAll() {
  nodes = [];
  edges = [];
  processCounter = 0;
  resourceCounter = 0;
  selectedNode1 = null;
  selectedNode2 = null;
  deadlockedNodes.clear();
  draggingNode = null;
  logs = [];
  if (isVisualizingDeadlock) stopDeadlockVisualization();
  logMessage("INFO", `Canvas cleared.`);
  ensureAnimationLoop();
  return true;
}
function clearAllAction(source = "Button") {
  return _clearAll();
}

function parseScript(scriptText) {
  const commands = [];
  const lines = scriptText.split("\n");

  lines.forEach((line) => {
    let contentWithoutComment = line;
    const commentIndex = line.indexOf("//");

    if (commentIndex !== -1) {
      contentWithoutComment = line.substring(0, commentIndex);
    }

    const parts = contentWithoutComment.split(";");

    parts.forEach((part) => {
      const command = part.trim();
      if (command.length > 0) {
        commands.push(command);
      }
    });
  });

  return commands;
}
function executeCommand(cmd, cmdIndex) {
  const parts = cmd.toUpperCase().split(/\s+/);
  const operation = parts[0];
  const args = parts.slice(1);
  let success = true;
  let errorMsg = "";
  try {
    switch (operation) {
      case "ADD":
        if (args.length < 2 || (args[0] !== "P" && args[0] !== "R"))
          throw new Error("Usage: ADD [P|R] ID [Instances]");
        const type = args[0] === "P" ? "process" : "resource";
        const id = args[1];
        if (!id) throw new Error("Node ID required");
        let instances = 1;
        if (type === "resource") {
          instances = args.length > 2 ? parseInt(args[2]) : 1;
          if (isNaN(instances) || instances < 1)
            throw new Error("Invalid instance count");
        }
        const dpr = window.devicePixelRatio || 1;
        const spawnX =
          Math.random() * ((canvas.width / dpr) * 0.8) +
          (canvas.width / dpr) * 0.1;
        const spawnY =
          Math.random() * ((canvas.height / dpr) * 0.8) +
          (canvas.height / dpr) * 0.1;
        if (!_addNode(id, type, spawnX, spawnY, instances)) success = false;
        break;
      case "REQ":
        if (args.length !== 2)
          throw new Error("Usage: REQ ProcessID ResourceID");
        if (!_createEdge(args[0], args[1], "request")) success = false;
        break;
      case "ASSIGN":
        if (args.length !== 2)
          throw new Error("Usage: ASSIGN ResourceID ProcessID");
        if (!_createEdge(args[0], args[1], "assignment")) success = false;
        break;
      case "REMOVE":
        if (args.length === 1) {
          if (!_removeNode(args[0])) success = false;
        } else if (args.length === 2) {
          const { success: removed } = removeEdge(args[0], args[1]);
          if (removed) {
            logMessage(
              "SUCCESS",
              `Script: Removed edge between ${args[0]} and ${args[1]}.`
            );
          } else {
            logMessage(
              "INFO",
              `Script: No edge found between ${args[0]} and ${args[1]} to remove.`
            );
          }
        } else {
          throw new Error("Usage: REMOVE NodeID | REMOVE NodeID1 NodeID2");
        }
        break;
      case "CLEAR":
        _clearAll();
        logMessage("INFO", `Script: Cleared canvas.`);
        break;
      default:
        throw new Error(`Unknown command: ${operation}`);
    }
  } catch (error) {
    success = false;
    errorMsg = error.message;
    logMessage(
      "ERROR",
      `Script error on line ${cmdIndex + 1} ('${cmd}'): ${errorMsg}`
    );
  }
  return success;
}
function runScript() {
  const scriptText = scriptInput.value;
  const commands = parseScript(scriptText);
  closeModal("scriptModal");
  if (commands.length === 0) {
    logMessage("WARN", "Script is empty.");
    return;
  }
  if (isVisualizingDeadlock) stopDeadlockVisualization();
  logMessage("INFO", "--- Running Full Script ---");
  let errors = 0;
  commands.forEach((cmd, index) => {
    if (!executeCommand(cmd, index)) {
      errors++;
    }
  });
  logMessage("INFO", `--- Script Finished (${errors} error(s)) ---`);
  clearSelection();
  ensureAnimationLoop();
}

function generateScript() {
  const scriptLines = [];
  scriptLines.push("// Generated RAG Script");
  scriptLines.push("// Add nodes first, then edges");
  scriptLines.push("\n// Nodes");
  nodes.forEach((node) => {
    if (node.type === "process") {
      scriptLines.push(`ADD P ${node.id}`);
    } else {
      scriptLines.push(`ADD R ${node.id} ${node.totalInstances}`);
    }
  });
  scriptLines.push("\n// Edges");
  edges.forEach((edge) => {
    if (edge.type === "request") {
      scriptLines.push(`REQ ${edge.from} ${edge.to}`);
    } else {
      scriptLines.push(`ASSIGN ${edge.from} ${edge.to}`);
    }
  });
  return scriptLines.join(";\n") + ";";
}
copyScriptButton.addEventListener("click", () => {
  navigator.clipboard
    .writeText(exportScriptArea.value)
    .then(() => {
      copyScriptButton.textContent = "Copied!";
      logMessage("INFO", "Generated script copied to clipboard.");
    })
    .catch((err) => {
      copyScriptButton.textContent = "Copy Failed";
      logMessage("ERROR", `Failed to copy script: ${err}`);
    });
});

document
  .getElementById("addProcessBtn")
  .addEventListener("click", () => openModal("addProcessModal"));
document
  .getElementById("addResourceBtn")
  .addEventListener("click", () => openModal("addResourceModal"));
document
  .getElementById("requestEdge")
  .addEventListener("click", () => requestEdgeAction("Button"));
document
  .getElementById("assignEdge")
  .addEventListener("click", () => assignEdgeAction("Button"));
document
  .getElementById("removeEdge")
  .addEventListener("click", removeEdgeAction);
document
  .getElementById("removeNode")
  .addEventListener("click", () => removeNodeAction("Button"));
visualizeDeadlockBtn.addEventListener("click", startDeadlockVisualization);
document
  .getElementById("clearSelection")
  .addEventListener("click", clearSelection);
document
  .getElementById("scriptButton")
  .addEventListener("click", () => openModal("scriptModal"));
document
  .getElementById("exportScriptButton")
  .addEventListener("click", () => openModal("exportModal"));
document.getElementById("clearAllButton").addEventListener("click", () => {
  if (confirm("Are you sure you want to clear everything?")) {
    clearAllAction("Button");
  }
});
aboutButton.addEventListener("click", () => openModal("aboutModal"));
closeModalButton.addEventListener("click", () => closeModal("aboutModal"));

stepDeadlockVizBtn.addEventListener("click", nextDeadlockStep);
runDeadlockVizBtn.addEventListener("click", runDeadlockVizToEnd);
stopDeadlockVizBtn.addEventListener("click", () => stopDeadlockVisualization());

function handleKeyPress(event) {
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
    if (event.key === "Escape" && activeModal) {
      closeModal(activeModal);
      event.preventDefault();
    }
    return;
  }
  if (activeModal) {
    if (event.key === "Escape") {
      closeModal(activeModal);
      event.preventDefault();
    }
    return;
  }
  let actionHandled = false;
  if (isVisualizingDeadlock) {
    if (event.key === " " || event.key === "Spacebar") {
      nextDeadlockStep();
      actionHandled = true;
    } else if (event.key === "Escape") {
      stopDeadlockVisualization();
      actionHandled = true;
    } else if (event.key === "r") {
      runDeadlockVizToEnd();
      actionHandled = true;
    }
  } else {
    switch (event.key.toLowerCase()) {
      case "p":
        openModal("addProcessModal");
        actionHandled = true;
        break;
      case "r":
        openModal("addResourceModal");
        actionHandled = true;
        break;
      case "q":
        actionHandled = requestEdgeAction("Key");
        break;
      case "a":
        actionHandled = assignEdgeAction("Key");
        break;
      case "delete":
      case "backspace":
      case "x":
        actionHandled = removeNodeAction("Key");
        break;
      case "d":
        startDeadlockVisualization();
        actionHandled = true;
        break;
      case "escape":
        clearSelection();
        actionHandled = true;
        break;
      case "c":
        if (confirm("Clear everything? (C key)")) {
          actionHandled = clearAllAction("Key");
        } else {
          actionHandled = true;
        }
        break;
      case "s":
        openModal("scriptModal");
        actionHandled = true;
        break;
      case "e":
        openModal("exportModal");
        actionHandled = true;
        break;
    }
  }
  if (actionHandled) {
    event.preventDefault();
  }
}
window.addEventListener("keydown", handleKeyPress);

function resizeCanvas() {
  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.scale(dpr, dpr);
  logMessage(
    "INFO",
    `Canvas resized to ${canvas.width / dpr}x${
      canvas.height / dpr
    } (CSS pixels)`
  );
  ensureAnimationLoop();
}
window.addEventListener("resize", resizeCanvas);

function initialize() {
  resizeCanvas();
  updateVisualizationUI();

  let introAlreadyShown = false;
  try {
    introAlreadyShown = localStorage.getItem("ragIntroShown") === "true";
  } catch (e) {
    console.error("LocalStorage read error:", e);
  }

  if (!introAlreadyShown) {
    openModal("introModal");
  }

  logMessage("INFO", "RAG Simulator v2.2 Initialized.");
  ensureAnimationLoop();
}
document.addEventListener("DOMContentLoaded", initialize);
