/**
 * SVG path building functions for different module styles.
 */

/**
 * Build a merged path from module coordinates by tracing boundaries.
 * 
 * Each module is a unit square at grid position (x, y), occupying pixel space [x, x+1] × [y, y+1].
 * We trace the boundary clockwise (keeping filled cells on our right), outputting vertices.
 */
export function buildBlocksPath(modules: [number, number][]): string {
  if (modules.length === 0) return "";

  // Create a set for O(1) lookup
  const moduleSet = new Set<string>();
  for (const [x, y] of modules) {
    moduleSet.add(`${x},${y}`);
  }

  const hasModule = (x: number, y: number): boolean => moduleSet.has(`${x},${y}`);

  // Track which directed edges we've visited
  const visitedEdges = new Set<string>();

  // A directed edge goes from vertex (x1,y1) to vertex (x2,y2)
  // We trace clockwise, so filled cell is always on the RIGHT of our direction
  type DirEdge = { x1: number; y1: number; x2: number; y2: number };

  const edgeKey = (e: DirEdge): string => `${e.x1},${e.y1}-${e.x2},${e.y2}`;

  // Build the list of all boundary edges
  // For a module at (mx, my), its boundary edges are those where the neighbor is empty
  const boundaryEdges: DirEdge[] = [];
  for (const [mx, my] of modules) {
    // Top edge: if no module above, edge goes left-to-right (y stays at my)
    if (!hasModule(mx, my - 1)) {
      boundaryEdges.push({ x1: mx, y1: my, x2: mx + 1, y2: my });
    }
    // Right edge: if no module to the right, edge goes top-to-bottom (x stays at mx+1)
    if (!hasModule(mx + 1, my)) {
      boundaryEdges.push({ x1: mx + 1, y1: my, x2: mx + 1, y2: my + 1 });
    }
    // Bottom edge: if no module below, edge goes right-to-left (y stays at my+1)
    if (!hasModule(mx, my + 1)) {
      boundaryEdges.push({ x1: mx + 1, y1: my + 1, x2: mx, y2: my + 1 });
    }
    // Left edge: if no module to the left, edge goes bottom-to-top (x stays at mx)
    if (!hasModule(mx - 1, my)) {
      boundaryEdges.push({ x1: mx, y1: my + 1, x2: mx, y2: my });
    }
  }

  // Build a map from start vertex to list of edges starting there
  const edgesFromVertex = new Map<string, DirEdge[]>();
  for (const edge of boundaryEdges) {
    const key = `${edge.x1},${edge.y1}`;
    if (!edgesFromVertex.has(key)) {
      edgesFromVertex.set(key, []);
    }
    edgesFromVertex.get(key)!.push(edge);
  }

  // Given an incoming edge direction, find the next edge from the endpoint
  // We want to turn RIGHT as much as possible (tightest clockwise turn)
  const getNextEdge = (current: DirEdge): DirEdge | null => {
    const endKey = `${current.x2},${current.y2}`;
    const candidates = edgesFromVertex.get(endKey);
    if (!candidates || candidates.length === 0) return null;

    // Direction we arrived from (incoming direction vector)
    const dx = current.x2 - current.x1;
    const dy = current.y2 - current.y1;

    // For clockwise boundary tracing (keeping filled on right), we want the tightest right turn.
    // In screen coordinates (y down), cross product > 0 means clockwise turn.
    // We use atan2(-cross, dot) to get angle where clockwise is negative.
    // Then we pick the minimum angle (most clockwise turn).
    
    let bestEdge: DirEdge | null = null;
    let bestAngle = Infinity;

    for (const candidate of candidates) {
      const cdx = candidate.x2 - candidate.x1;
      const cdy = candidate.y2 - candidate.y1;
      
      // Cross product in screen coords: positive = clockwise turn (right)
      const cross = dx * cdy - dy * cdx;
      const dot = dx * cdx + dy * cdy;
      
      // atan2(-cross, dot) gives us angle where right turn is negative
      const angle = Math.atan2(-cross, dot);
      
      if (angle < bestAngle) {
        bestAngle = angle;
        bestEdge = candidate;
      }
    }

    return bestEdge;
  };

  const pathParts: string[] = [];

  // Trace all closed loops
  for (const startEdge of boundaryEdges) {
    const startKey = edgeKey(startEdge);
    if (visitedEdges.has(startKey)) continue;

    // Trace this loop
    const points: { x: number; y: number }[] = [];
    let currentEdge: DirEdge | null = startEdge;

    while (currentEdge) {
      const key = edgeKey(currentEdge);
      if (visitedEdges.has(key)) break;
      visitedEdges.add(key);

      points.push({ x: currentEdge.x1, y: currentEdge.y1 });

      currentEdge = getNextEdge(currentEdge);
      if (currentEdge && edgeKey(currentEdge) === startKey) break;
    }

    if (points.length >= 3) {
      const pathData = points
        .map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`))
        .join(" ");
      pathParts.push(pathData + " Z");
    }
  }

  return pathParts.join(" ");
}

/**
 * Build a path of individual circles for each module.
 * Each module is rendered as a simple circle - no merging to avoid overlap issues.
 */
export function buildCirclesPath(modules: [number, number][]): string {
  if (modules.length === 0) return "";

  const paths: string[] = [];
  const radius = 0.45; // Slightly smaller than 0.5 to leave small gaps

  // Draw a circle for each module
  for (const [x, y] of modules) {
    const cx = x + 0.5;
    const cy = y + 0.5;
    // Draw circle using two arcs
    paths.push(
      `M${cx - radius} ${cy} ` +
      `a${radius} ${radius} 0 1 0 ${radius * 2} 0 ` +
      `a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
    );
  }

  return paths.join(" ");
}

/**
 * Helper to create a rounded rectangle SVG path.
 */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const x1 = x + r;
  const x2 = x + w - r;
  const y1 = y + r;
  const y2 = y + h - r;
  return `M${x1} ${y} L${x2} ${y} Q${x + w} ${y} ${x + w} ${y1} L${x + w} ${y2} Q${x + w} ${y + h} ${x2} ${y + h} L${x1} ${y + h} Q${x} ${y + h} ${x} ${y2} L${x} ${y1} Q${x} ${y} ${x1} ${y} Z`;
}

/**
 * Build a merged path with rounded corners for connected modules.
 * Adjacent modules are joined into lines/shapes with rounded ends and corners.
 */
export function buildLinesPath(modules: [number, number][]): string {
  if (modules.length === 0) return "";

  const moduleSet = new Set<string>();
  for (const [x, y] of modules) {
    moduleSet.add(`${x},${y}`);
  }

  const hasModule = (x: number, y: number): boolean => moduleSet.has(`${x},${y}`);

  const radius = 0.45;
  const paths: string[] = [];
  const visited = new Set<string>();

  // Find horizontal runs first
  for (const [x, y] of modules) {
    const key = `${x},${y}`;
    if (visited.has(key)) continue;

    // Check if this is part of a horizontal run
    let runStartX = x;
    let runEndX = x;

    // Extend left
    while (hasModule(runStartX - 1, y) && !visited.has(`${runStartX - 1},${y}`)) {
      runStartX--;
    }
    // Extend right
    while (hasModule(runEndX + 1, y) && !visited.has(`${runEndX + 1},${y}`)) {
      runEndX++;
    }

    const runLength = runEndX - runStartX + 1;

    // Only create horizontal run if length > 1
    if (runLength > 1) {
      // Mark all in this run as visited
      for (let rx = runStartX; rx <= runEndX; rx++) {
        visited.add(`${rx},${y}`);
      }
      
      // Draw rounded pill for horizontal run
      const margin = 0.5 - radius;
      paths.push(roundedRectPath(
        runStartX + margin,
        y + margin,
        runLength - 2 * margin,
        1 - 2 * margin,
        radius
      ));
    }
  }

  // Find vertical runs for remaining unvisited modules
  for (const [x, y] of modules) {
    const key = `${x},${y}`;
    if (visited.has(key)) continue;

    // Check if this is part of a vertical run
    let runStartY = y;
    let runEndY = y;

    // Extend up
    while (hasModule(x, runStartY - 1) && !visited.has(`${x},${runStartY - 1}`)) {
      runStartY--;
    }
    // Extend down
    while (hasModule(x, runEndY + 1) && !visited.has(`${x},${runEndY + 1}`)) {
      runEndY++;
    }

    const runLength = runEndY - runStartY + 1;

    if (runLength > 1) {
      // Mark all in this run as visited
      for (let ry = runStartY; ry <= runEndY; ry++) {
        visited.add(`${x},${ry}`);
      }
      
      // Draw rounded pill for vertical run
      const margin = 0.5 - radius;
      paths.push(roundedRectPath(
        x + margin,
        runStartY + margin,
        1 - 2 * margin,
        runLength - 2 * margin,
        radius
      ));
    }
  }

  // Draw circles for any remaining isolated modules
  for (const [x, y] of modules) {
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cx = x + 0.5;
    const cy = y + 0.5;
    paths.push(
      `M${cx - radius} ${cy} ` +
      `a${radius} ${radius} 0 1 0 ${radius * 2} 0 ` +
      `a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
    );
  }

  return paths.join(" ");
}
