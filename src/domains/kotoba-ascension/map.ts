import type { AscensionMap, AscensionNode, AscensionNodeType } from './types';

const BODY_TYPES: readonly AscensionNodeType[] = ['combat', 'combat', 'elite', 'rest', 'shop'];

function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(1664525, value) + 1013904223;
    return (value >>> 0) / 4294967296;
  };
}

export function createAscensionMap(seed: number, layers = 5): AscensionMap {
  const boundedLayers = Math.max(4, Math.min(7, Math.floor(layers)));
  const next = random(seed);
  const nodes: AscensionNode[] = [];
  const byLayer: AscensionNode[][] = [];
  const makeNode = (layer: number, type: AscensionNodeType, index: number): AscensionNode => ({
    id: `${seed}-${layer}-${index}`,
    layer,
    type,
    label: type === 'boss' ? 'Topic boss' : type === 'elite' ? 'Elite' : type.charAt(0).toUpperCase() + type.slice(1),
    connections: [],
  });
  const start = makeNode(0, 'combat', 0);
  nodes.push(start);
  byLayer.push([start]);
  for (let layer = 1; layer < boundedLayers - 1; layer += 1) {
    const count = 2 + (next() > 0.7 ? 1 : 0);
    const layerNodes = Array.from({ length: count }, (_, index) => {
      const type = BODY_TYPES[Math.floor(next() * BODY_TYPES.length)] ?? 'combat';
      return makeNode(layer, type, index);
    });
    nodes.push(...layerNodes);
    byLayer.push(layerNodes);
  }
  const boss = makeNode(boundedLayers - 1, 'boss', 0);
  nodes.push(boss);
  byLayer.push([boss]);
  byLayer.slice(0, -1).forEach((layerNodes, index) => {
    const nextLayer = byLayer[index + 1] ?? [];
    layerNodes.forEach((node, nodeIndex) => {
      const primary = nextLayer[nodeIndex % nextLayer.length];
      if (primary) node.connections.push(primary.id);
      if (nextLayer.length > 1 && next() > 0.35) {
        const alternate = nextLayer[(nodeIndex + 1) % nextLayer.length];
        if (alternate && !node.connections.includes(alternate.id)) node.connections.push(alternate.id);
      }
    });
  });
  return { seed, nodes, currentNodeId: start.id };
}

/** The first run is deliberately authored so a new learner is never asked to
 * choose between unfamiliar systems before seeing a normal combat. */
export function createPrologueMap(seed: number): AscensionMap {
  const nodes: AscensionNode[] = [
    { id: `${seed}-0-0`, layer: 0, type: 'combat', label: 'Start', connections: [`${seed}-1-0`] },
    { id: `${seed}-1-0`, layer: 1, type: 'combat', label: 'First battle', connections: [`${seed}-2-0`] },
    { id: `${seed}-2-0`, layer: 2, type: 'rest', label: 'Rest', connections: [`${seed}-3-0`] },
    { id: `${seed}-3-0`, layer: 3, type: 'boss', label: 'Prologue boss', connections: [] },
  ];
  return { seed, nodes, currentNodeId: nodes[0]!.id };
}

export function availableMapNodes(map: AscensionMap): AscensionNode[] {
  const current = map.nodes.find((node) => node.id === map.currentNodeId);
  if (!current) return [];
  return current.connections.map((id) => map.nodes.find((node) => node.id === id)).filter((node): node is AscensionNode => Boolean(node));
}

export function visitMapNode(map: AscensionMap, nodeId: string): AscensionMap {
  if (!availableMapNodes(map).some((node) => node.id === nodeId)) return map;
  return { ...map, currentNodeId: nodeId };
}
