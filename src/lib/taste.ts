export interface TasteMember {
  postId: number;
  weight: number;
  kind: "favorite" | "view";
}

export interface TasteCluster {
  index: number;
  centroid: Float32Array;
  memberPostIds: number[];
  favoritePostIds: number[];
  mass: number;
}

export interface TasteModel {
  clusters: TasteCluster[];
  dimensions: number;
}

export interface TasteConfig {
  clusterCount: number;
  minClusterSize: number;
  maxIterations: number;
}

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeRows(
  vectors: Float32Array,
  dimensions: number,
): Float32Array {
  if (dimensions <= 0 || vectors.length % dimensions !== 0) {
    if (vectors.length === 0 && dimensions >= 0) {
      return vectors;
    }
    throw new RangeError("Vector length must be divisible by dimensions");
  }

  for (let rowOffset = 0; rowOffset < vectors.length; rowOffset += dimensions) {
    let squaredNorm = 0;
    const rowEnd = rowOffset + dimensions;
    for (let offset = rowOffset; offset < rowEnd; offset += 1) {
      const value = vectors[offset];
      squaredNorm += value * value;
    }
    if (squaredNorm === 0) {
      continue;
    }
    const inverseNorm = 1 / Math.sqrt(squaredNorm);
    for (let offset = rowOffset; offset < rowEnd; offset += 1) {
      vectors[offset] *= inverseNorm;
    }
  }
  return vectors;
}

export function fitTasteModel(
  members: readonly TasteMember[],
  vectors: Float32Array,
  dimensions: number,
  config: TasteConfig,
  seed: number,
  warmStart?: Float32Array | null,
): TasteModel {
  const memberCount = members.length;
  if (memberCount === 0) {
    return { clusters: [], dimensions };
  }
  if (dimensions <= 0 || vectors.length !== memberCount * dimensions) {
    throw new RangeError("Vectors must contain one complete row per member");
  }

  const clusterCount = Math.min(
    Math.max(0, Math.floor(config.clusterCount)),
    memberCount,
  );
  if (clusterCount === 0) {
    return { clusters: [], dimensions };
  }
  const centroids = new Float32Array(clusterCount * dimensions);
  let warmClusterCount = 0;
  if (
    warmStart &&
    warmStart.length > 0 &&
    warmStart.length % dimensions === 0
  ) {
    const candidateCount = warmStart.length / dimensions;
    if (candidateCount <= clusterCount) {
      warmClusterCount = candidateCount;
      centroids.set(warmStart);
    }
  }

  // Reserve, for each warm centroid, the one unused member row it (nearly)
  // coincides with, so expanding a partial warm start cannot seed that row
  // again as a duplicate centroid. Warm centroids are renormalized weighted
  // means, so a singleton cluster's centroid equals its member only up to
  // float rounding — match by cosine, not component equality.
  const usedRows = new Uint8Array(memberCount);
  const WARM_ROW_MATCH_COSINE = 0.9999;
  for (let cluster = 0; cluster < warmClusterCount; cluster += 1) {
    const centroidOffset = cluster * dimensions;
    let bestRow = -1;
    let bestSimilarity = WARM_ROW_MATCH_COSINE;
    for (let row = 0; row < memberCount; row += 1) {
      if (usedRows[row] !== 0) {
        continue;
      }
      const rowOffset = row * dimensions;
      let similarity = 0;
      for (let dimension = 0; dimension < dimensions; dimension += 1) {
        similarity +=
          vectors[rowOffset + dimension] * centroids[centroidOffset + dimension];
      }
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestRow = row;
      }
    }
    if (bestRow !== -1) {
      usedRows[bestRow] = 1;
    }
  }

  const availableRows = new Int32Array(memberCount);
  let availableCount = 0;
  for (let row = 0; row < memberCount; row += 1) {
    if (usedRows[row] === 0) {
      availableRows[availableCount] = row;
      availableCount += 1;
    }
  }
  const random = mulberry32(seed);
  for (
    let cluster = warmClusterCount;
    cluster < clusterCount;
    cluster += 1
  ) {
    const seededCount = cluster - warmClusterCount;
    const selectedIndex =
      seededCount + Math.floor(random() * (availableCount - seededCount));
    const selectedRow = availableRows[selectedIndex];
    availableRows[selectedIndex] = availableRows[seededCount];
    availableRows[seededCount] = selectedRow;
    const sourceOffset = selectedRow * dimensions;
    const targetOffset = cluster * dimensions;
    for (let dimension = 0; dimension < dimensions; dimension += 1) {
      centroids[targetOffset + dimension] = vectors[sourceOffset + dimension];
    }
  }
  normalizeRows(centroids, dimensions);

  const assignments = new Int32Array(memberCount);
  assignments.fill(-1);
  const counts = new Int32Array(clusterCount);
  const sums = new Float32Array(clusterCount * dimensions);
  const iterationLimit = Math.max(1, Math.floor(config.maxIterations));

  for (let iteration = 0; iteration < iterationLimit; iteration += 1) {
    let changed = false;
    counts.fill(0);
    sums.fill(0);

    for (let row = 0; row < memberCount; row += 1) {
      const rowOffset = row * dimensions;
      let bestCluster = 0;
      let bestSimilarity = -Infinity;
      for (let cluster = 0; cluster < clusterCount; cluster += 1) {
        const centroidOffset = cluster * dimensions;
        let similarity = 0;
        for (let dimension = 0; dimension < dimensions; dimension += 1) {
          similarity +=
            vectors[rowOffset + dimension] *
            centroids[centroidOffset + dimension];
        }
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = cluster;
        }
      }
      if (assignments[row] !== bestCluster) {
        assignments[row] = bestCluster;
        changed = true;
      }
      counts[bestCluster] += 1;
      // Weighted centroid: a capped view (weight <= 0.35) moves a centroid
      // proportionally less than a fresh favorite (weight ~1).
      const weight = members[row].weight;
      const sumOffset = bestCluster * dimensions;
      for (let dimension = 0; dimension < dimensions; dimension += 1) {
        sums[sumOffset + dimension] += weight * vectors[rowOffset + dimension];
      }
    }

    centroids.fill(0);
    for (let cluster = 0; cluster < clusterCount; cluster += 1) {
      if (counts[cluster] === 0) {
        continue;
      }
      const centroidOffset = cluster * dimensions;
      for (let dimension = 0; dimension < dimensions; dimension += 1) {
        centroids[centroidOffset + dimension] =
          sums[centroidOffset + dimension];
      }
    }
    normalizeRows(centroids, dimensions);
    if (!changed) {
      break;
    }
  }

  const survivingClusters: number[] = [];
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    if (counts[cluster] > 0 && counts[cluster] >= config.minClusterSize) {
      survivingClusters.push(cluster);
    }
  }
  if (survivingClusters.length === 0) {
    let largestCluster = 0;
    for (let cluster = 1; cluster < clusterCount; cluster += 1) {
      if (counts[cluster] > counts[largestCluster]) {
        largestCluster = cluster;
      }
    }
    survivingClusters.push(largestCluster);
  }

  const survivorByCluster = new Int32Array(clusterCount);
  survivorByCluster.fill(-1);
  for (let index = 0; index < survivingClusters.length; index += 1) {
    survivorByCluster[survivingClusters[index]] = index;
  }

  for (let row = 0; row < memberCount; row += 1) {
    if (survivorByCluster[assignments[row]] !== -1) {
      continue;
    }
    const rowOffset = row * dimensions;
    let nearestCluster = survivingClusters[0];
    let nearestSimilarity = -Infinity;
    for (let index = 0; index < survivingClusters.length; index += 1) {
      const cluster = survivingClusters[index];
      const centroidOffset = cluster * dimensions;
      let similarity = 0;
      for (let dimension = 0; dimension < dimensions; dimension += 1) {
        similarity +=
          vectors[rowOffset + dimension] *
          centroids[centroidOffset + dimension];
      }
      if (similarity > nearestSimilarity) {
        nearestSimilarity = similarity;
        nearestCluster = cluster;
      }
    }
    assignments[row] = nearestCluster;
  }

  const finalCentroids = new Float32Array(
    survivingClusters.length * dimensions,
  );
  for (let row = 0; row < memberCount; row += 1) {
    const finalCluster = survivorByCluster[assignments[row]];
    const rowOffset = row * dimensions;
    const centroidOffset = finalCluster * dimensions;
    const weight = members[row].weight;
    for (let dimension = 0; dimension < dimensions; dimension += 1) {
      finalCentroids[centroidOffset + dimension] +=
        weight * vectors[rowOffset + dimension];
    }
  }
  normalizeRows(finalCentroids, dimensions);

  const clusters: TasteCluster[] = survivingClusters.map((_, index) => ({
    index,
    centroid: finalCentroids.slice(
      index * dimensions,
      (index + 1) * dimensions,
    ),
    memberPostIds: [],
    favoritePostIds: [],
    mass: 0,
  }));
  for (let row = 0; row < memberCount; row += 1) {
    const cluster = clusters[survivorByCluster[assignments[row]]];
    const member = members[row];
    cluster.memberPostIds.push(member.postId);
    if (member.kind === "favorite") {
      cluster.favoritePostIds.push(member.postId);
    }
    cluster.mass += member.weight;
  }

  return { clusters, dimensions };
}

export interface AllocationConfig {
  pageSize: number;
  pageCount: number;
  floorShare: number;
}

export function allocateAcrossClusters<T extends { id: number }>(
  rankedByCluster: ReadonlyMap<number, readonly T[]>,
  massByCluster: ReadonlyMap<number, number>,
  groupIdsByPostId: ReadonlyMap<number, number[]>,
  config: AllocationConfig,
): { item: T; cluster: number }[] {
  const pageSize = Math.max(0, Math.floor(config.pageSize));
  const pageCount = Math.max(0, Math.floor(config.pageCount));
  if (pageSize === 0 || pageCount === 0) {
    return [];
  }

  const clusterSet = new Set<number>();
  for (const cluster of rankedByCluster.keys()) {
    clusterSet.add(cluster);
  }
  for (const cluster of massByCluster.keys()) {
    clusterSet.add(cluster);
  }
  const clusters = Array.from(clusterSet).sort((left, right) => left - right);
  if (clusters.length === 0) {
    return [];
  }

  const massFor = (cluster: number): number =>
    Math.max(0, massByCluster.get(cluster) ?? 0);
  const clustersByMass = [...clusters].sort(
    (left, right) => massFor(right) - massFor(left) || left - right,
  );
  let totalMass = 0;
  for (let index = 0; index < clusters.length; index += 1) {
    totalMass += massFor(clusters[index]);
  }

  const shares = new Map<number, number>();
  let shareTotal = 0;
  for (let index = 0; index < clusters.length; index += 1) {
    const cluster = clusters[index];
    const proportionalShare =
      totalMass > 0 ? massFor(cluster) / totalMass : 1 / clusters.length;
    const share = Math.max(proportionalShare, config.floorShare);
    shares.set(cluster, share);
    shareTotal += share;
  }

  const quotas = new Map<number, number>();
  const quotaOrder: { cluster: number; fraction: number; mass: number }[] = [];
  let assignedSlots = 0;
  for (let index = 0; index < clusters.length; index += 1) {
    const cluster = clusters[index];
    const idealQuota = ((shares.get(cluster) ?? 0) / shareTotal) * pageSize;
    const baseQuota = Math.floor(idealQuota);
    quotas.set(cluster, baseQuota);
    assignedSlots += baseQuota;
    quotaOrder.push({
      cluster,
      fraction: idealQuota - baseQuota,
      mass: massFor(cluster),
    });
  }
  quotaOrder.sort(
    (left, right) =>
      right.fraction - left.fraction ||
      right.mass - left.mass ||
      left.cluster - right.cluster,
  );
  for (
    let remainder = pageSize - assignedSlots, index = 0;
    remainder > 0;
    remainder -= 1, index += 1
  ) {
    const cluster = quotaOrder[index % quotaOrder.length].cluster;
    quotas.set(cluster, (quotas.get(cluster) ?? 0) + 1);
  }

  const cursors = new Map<number, number>();
  const takenIds = new Set<number>();
  const takenGroups = new Set<number>();
  const result: { item: T; cluster: number }[] = [];
  const takeNext = (cluster: number): T | undefined => {
    const ranked = rankedByCluster.get(cluster) ?? [];
    let cursor = cursors.get(cluster) ?? 0;
    while (cursor < ranked.length) {
      const item = ranked[cursor];
      cursor += 1;
      if (takenIds.has(item.id)) {
        continue;
      }
      const groupIds = groupIdsByPostId.get(item.id) ?? [];
      let overlapsTakenGroup = false;
      for (let index = 0; index < groupIds.length; index += 1) {
        if (takenGroups.has(groupIds[index])) {
          overlapsTakenGroup = true;
          break;
        }
      }
      if (overlapsTakenGroup) {
        continue;
      }
      cursors.set(cluster, cursor);
      takenIds.add(item.id);
      for (let index = 0; index < groupIds.length; index += 1) {
        takenGroups.add(groupIds[index]);
      }
      return item;
    }
    cursors.set(cluster, cursor);
    return undefined;
  };

  for (let page = 0; page < pageCount; page += 1) {
    const selectedByCluster = new Map<number, T[]>();
    let selectedCount = 0;
    for (let index = 0; index < clusters.length; index += 1) {
      const cluster = clusters[index];
      const selected: T[] = [];
      const quota = quotas.get(cluster) ?? 0;
      while (selected.length < quota) {
        const item = takeNext(cluster);
        if (!item) {
          break;
        }
        selected.push(item);
        selectedCount += 1;
      }
      selectedByCluster.set(cluster, selected);
    }

    let unfilledSlots = pageSize - selectedCount;
    for (
      let index = 0;
      index < clustersByMass.length && unfilledSlots > 0;
      index += 1
    ) {
      const cluster = clustersByMass[index];
      const selected = selectedByCluster.get(cluster) ?? [];
      while (unfilledSlots > 0) {
        const item = takeNext(cluster);
        if (!item) {
          break;
        }
        selected.push(item);
        selectedCount += 1;
        unfilledSlots -= 1;
      }
      selectedByCluster.set(cluster, selected);
    }

    if (selectedCount === 0) {
      break;
    }
    for (let round = 0; ; round += 1) {
      let emitted = false;
      for (let index = 0; index < clustersByMass.length; index += 1) {
        const cluster = clustersByMass[index];
        const item = selectedByCluster.get(cluster)?.[round];
        if (item) {
          result.push({ item, cluster });
          emitted = true;
        }
      }
      if (!emitted) {
        break;
      }
    }
  }

  return result;
}
