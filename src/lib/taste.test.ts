import { describe, expect, it } from "vitest";
import {
  allocateAcrossClusters,
  fitTasteModel,
  normalizeRows,
  type TasteMember,
  type TasteModel,
} from "./taste";

const DIMENSIONS = 8;

function partition(model: TasteModel): number[][] {
  return model.clusters
    .map((cluster) => [...cluster.memberPostIds].sort((left, right) => left - right))
    .sort((left, right) => left[0] - right[0]);
}

function makeMembers(count: number): TasteMember[] {
  return Array.from({ length: count }, (_, index) => ({
    postId: index + 1,
    weight: index + 1,
    kind: index % 2 === 0 ? "favorite" : "view",
  }));
}

function normalizedVectors(rows: readonly number[][]): Float32Array {
  return normalizeRows(
    new Float32Array(rows.flat()),
    rows[0]?.length ?? DIMENSIONS,
  );
}

function items(start: number, count: number): { id: number }[] {
  return Array.from({ length: count }, (_, index) => ({ id: start + index }));
}

describe("normalizeRows", () => {
  it("normalizes nonzero rows in place and preserves a zero row", () => {
    const vectors = new Float32Array([3, 4, 0, 0]);
    const returned = normalizeRows(vectors, 2);

    expect(returned).toBe(vectors);
    expect(Array.from(vectors)).toEqual([0.6000000238418579, 0.800000011920929, 0, 0]);
  });
});

describe("fitTasteModel", () => {
  it("weights centroids by member weight so a weak view barely moves a favorite's centroid", () => {
    // One cluster (K=1): a favorite at e1 and a member at e2. With equal
    // weights the centroid is the 45° bisector; with the e2 member at view
    // weight 0.1 the centroid stays close to e1.
    const vectors = normalizedVectors([
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
    ]);
    const config = { clusterCount: 1, minClusterSize: 1, maxIterations: 10 };
    const equal = fitTasteModel(
      [{ postId: 1, weight: 1, kind: "favorite" }, { postId: 2, weight: 1, kind: "favorite" }],
      vectors, DIMENSIONS, config, 1
    );
    const weak = fitTasteModel(
      [{ postId: 1, weight: 1, kind: "favorite" }, { postId: 2, weight: 0.1, kind: "view" }],
      vectors, DIMENSIONS, config, 1
    );
    expect(equal.clusters[0].centroid[0]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(equal.clusters[0].centroid[1]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(weak.clusters[0].centroid[0]).toBeCloseTo(1 / Math.hypot(1, 0.1), 5);
    expect(weak.clusters[0].centroid[1]).toBeCloseTo(0.1 / Math.hypot(1, 0.1), 5);
    // Mass still counts every member's weight; the view is a weak member, not excluded.
    expect(weak.clusters[0].mass).toBeCloseTo(1.1, 10);
    expect(weak.clusters[0].favoritePostIds).toEqual([1]);
  });

  it("deterministically recovers three well-separated partitions in D=8", () => {
    const members = makeMembers(12);
    const vectors = normalizedVectors([
      [1, 0.08, 0, 0, 0, 0, 0, 0],
      [1, -0.06, 0.02, 0, 0, 0, 0, 0],
      [1, 0.03, -0.04, 0, 0, 0, 0, 0],
      [1, -0.02, 0.06, 0, 0, 0, 0, 0],
      [0.04, 1, 0, 0, 0, 0, 0, 0],
      [-0.05, 1, 0.03, 0, 0, 0, 0, 0],
      [0.02, 1, -0.05, 0, 0, 0, 0, 0],
      [-0.03, 1, 0.06, 0, 0, 0, 0, 0],
      [0.03, 0, 1, 0, 0, 0, 0, 0],
      [-0.04, 0.02, 1, 0, 0, 0, 0, 0],
      [0.05, -0.03, 1, 0, 0, 0, 0, 0],
      [-0.02, 0.05, 1, 0, 0, 0, 0, 0],
    ]);
    const config = { clusterCount: 3, minClusterSize: 2, maxIterations: 30 };

    const first = fitTasteModel(members, vectors, DIMENSIONS, config, 4);
    const repeated = fitTasteModel(members, vectors, DIMENSIONS, config, 4);
    const otherSeed = fitTasteModel(members, vectors, DIMENSIONS, config, 91);
    const expected = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
    ];

    expect(partition(first)).toEqual(expected);
    expect(repeated).toEqual(first);
    expect(partition(otherSeed)).toEqual(expected);
    expect(first.clusters.map((cluster) => cluster.index)).toEqual([0, 1, 2]);
  });

  it("uses a correctly sized converged warm start without changing it in one iteration", () => {
    const members = makeMembers(4);
    const vectors = normalizedVectors([
      [1, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
    ]);
    const warmStart = normalizedVectors([
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
    ]);

    const model = fitTasteModel(
      members,
      vectors,
      DIMENSIONS,
      { clusterCount: 2, minClusterSize: 1, maxIterations: 1 },
      1,
      warmStart,
    );

    expect(partition(model)).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(Array.from(model.clusters[0].centroid)).toEqual(
      Array.from(warmStart.slice(0, DIMENSIONS)),
    );
    expect(Array.from(model.clusters[1].centroid)).toEqual(
      Array.from(warmStart.slice(DIMENSIONS)),
    );
  });

  it("uses a partial warm start and seeds the remaining centroids from unused rows", () => {
    const members = makeMembers(4);
    const vectors = normalizedVectors([
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]);
    const warmStart = normalizedVectors([
      [1, 0],
      [0, 1],
    ]);

    const model = fitTasteModel(
      members,
      vectors,
      2,
      { clusterCount: 4, minClusterSize: 1, maxIterations: 1 },
      11,
      warmStart,
    );

    expect(partition(model)).toEqual([[1], [2], [3], [4]]);
    expect(Array.from(model.clusters[0].centroid)).toEqual([1, 0]);
    expect(Array.from(model.clusters[1].centroid)).toEqual([0, 1]);
  });

  it("ignores malformed warm starts and exactly matches cold seeding", () => {
    const members = makeMembers(4);
    const vectors = normalizedVectors([
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]);
    const config = { clusterCount: 3, minClusterSize: 1, maxIterations: 1 };
    const cold = fitTasteModel(members, vectors, 2, config, 17);
    const malformed = [
      new Float32Array([1, 0, 1]),
      new Float32Array(vectors),
      new Float32Array(),
    ];

    for (const warmStart of malformed) {
      expect(fitTasteModel(members, vectors, 2, config, 17, warmStart)).toEqual(
        cold,
      );
    }
  });

  it("seeds distinct member rows when K equals N", () => {
    const members = makeMembers(4);
    const vectors = normalizedVectors([
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]);

    const model = fitTasteModel(
      members,
      vectors,
      2,
      { clusterCount: 4, minClusterSize: 1, maxIterations: 1 },
      23,
    );

    expect(partition(model)).toEqual([[1], [2], [3], [4]]);
  });

  it("stops early without changing a converged result", () => {
    const members = makeMembers(4);
    const vectors = normalizedVectors([
      [1, 0],
      [1, 0],
      [0, 1],
      [0, 1],
    ]);
    const warmStart = normalizedVectors([
      [1, 0],
      [0, 1],
    ]);

    const oneIteration = fitTasteModel(
      members,
      vectors,
      2,
      { clusterCount: 2, minClusterSize: 1, maxIterations: 1 },
      3,
      warmStart,
    );
    const fiftyIterations = fitTasteModel(
      members,
      vectors,
      2,
      { clusterCount: 2, minClusterSize: 1, maxIterations: 50 },
      3,
      warmStart,
    );

    expect(fiftyIterations).toEqual(oneIteration);
  });

  it("merges a lone outlier into its nearest sufficiently large cluster", () => {
    const members = makeMembers(7);
    const vectors = normalizedVectors([
      [1, 0, 0, 0, 0, 0, 0, 0],
      [1, 0.04, 0, 0, 0, 0, 0, 0],
      [1, -0.04, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
      [0.04, 1, 0, 0, 0, 0, 0, 0],
      [-0.04, 1, 0, 0, 0, 0, 0, 0],
      [0.8, 0, 0.6, 0, 0, 0, 0, 0],
    ]);
    const warmStart = normalizedVectors([
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
      [0.8, 0, 0.6, 0, 0, 0, 0, 0],
    ]);

    const model = fitTasteModel(
      members,
      vectors,
      DIMENSIONS,
      { clusterCount: 3, minClusterSize: 2, maxIterations: 10 },
      3,
      warmStart,
    );

    expect(partition(model)).toEqual([
      [1, 2, 3, 7],
      [4, 5, 6],
    ]);
    expect(model.clusters.reduce((sum, cluster) => sum + cluster.mass, 0)).toBe(28);
    expect(
      model.clusters.flatMap((cluster) => cluster.favoritePostIds).sort((a, b) => a - b),
    ).toEqual([1, 3, 5, 7]);
  });

  it("keeps the largest cluster and reassigns everyone when all clusters are tiny", () => {
    const members = makeMembers(3);
    const vectors = normalizedVectors([
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0],
    ]);

    const model = fitTasteModel(
      members,
      vectors,
      DIMENSIONS,
      { clusterCount: 3, minClusterSize: 2, maxIterations: 1 },
      8,
      new Float32Array(vectors),
    );

    expect(model.clusters).toHaveLength(1);
    expect(model.clusters[0].memberPostIds).toEqual([1, 2, 3]);
    expect(model.clusters[0].index).toBe(0);
  });

  it("caps K at the member count and returns an empty model for no members", () => {
    const members = makeMembers(2);
    const vectors = normalizedVectors([
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
    ]);

    const capped = fitTasteModel(
      members,
      vectors,
      DIMENSIONS,
      { clusterCount: 20, minClusterSize: 1, maxIterations: 2 },
      5,
    );
    const empty = fitTasteModel(
      [],
      new Float32Array(),
      DIMENSIONS,
      { clusterCount: 3, minClusterSize: 1, maxIterations: 2 },
      5,
    );

    expect(capped.clusters).toHaveLength(2);
    expect(partition(capped)).toEqual([[1], [2]]);
    expect(empty).toEqual({ clusters: [], dimensions: DIMENSIONS });
  });
});

describe("allocateAcrossClusters", () => {
  it("skips items sharing a taken dedupe key and fills the slot with the next candidate", () => {
    // Cluster A's second item is a perceptual duplicate of its first; cluster
    // B's first item duplicates A's first. Both are skipped in place, so the
    // page still fills to 4 from ranked successors.
    const allocated = allocateAcrossClusters(
      new Map([
        [0, items(1, 4)],
        [1, items(10, 4)],
      ]),
      new Map([[0, 1], [1, 1]]),
      new Map(),
      { pageSize: 4, pageCount: 1, floorShare: 0 },
      new Map([[1, "same"], [2, "same"], [10, "same"]])
    );
    expect(allocated.map(({ item }) => item.id)).toEqual([1, 11, 3, 12]);
  });

  it("uses proportional quotas that sum to the page size on every page", () => {
    const allocated = allocateAcrossClusters(
      new Map([
        [0, items(1, 20)],
        [1, items(101, 20)],
      ]),
      new Map([
        [0, 3],
        [1, 1],
      ]),
      new Map(),
      { pageSize: 8, pageCount: 2, floorShare: 0.02 },
    );

    expect(allocated).toHaveLength(16);
    for (let page = 0; page < 2; page += 1) {
      const pageItems = allocated.slice(page * 8, (page + 1) * 8);
      expect(pageItems).toHaveLength(8);
      expect(pageItems.filter((entry) => entry.cluster === 0)).toHaveLength(6);
      expect(pageItems.filter((entry) => entry.cluster === 1)).toHaveLength(2);
    }
  });

  it("gives a 0.5%-mass cluster at least one slot on a 48-item page", () => {
    const allocated = allocateAcrossClusters(
      new Map([
        [0, items(1, 60)],
        [1, items(101, 60)],
      ]),
      new Map([
        [0, 995],
        [1, 5],
      ]),
      new Map(),
      { pageSize: 48, pageCount: 1, floorShare: 0.02 },
    );

    expect(allocated).toHaveLength(48);
    expect(allocated.filter((entry) => entry.cluster === 1).length).toBeGreaterThanOrEqual(1);
  });

  it("deduplicates groups across cluster lists and transfers a dry cluster's slots", () => {
    const allocated = allocateAcrossClusters(
      new Map([
        [0, [{ id: 1 }]],
        [1, [{ id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }]],
      ]),
      new Map([
        [0, 1],
        [1, 1],
      ]),
      new Map([
        [1, [50]],
        [2, [50]],
      ]),
      { pageSize: 6, pageCount: 1, floorShare: 0 },
    );

    expect(allocated).toHaveLength(6);
    expect(allocated.filter((entry) => entry.cluster === 0)).toHaveLength(1);
    expect(allocated.filter((entry) => entry.cluster === 1)).toHaveLength(5);
    expect(allocated.map((entry) => entry.item.id)).toContain(1);
    expect(allocated.map((entry) => entry.item.id)).not.toContain(2);
  });

  it("round-robins equal-mass clusters and honors the total page cap", () => {
    const allocated = allocateAcrossClusters(
      new Map([
        [0, items(1, 20)],
        [1, items(101, 20)],
      ]),
      new Map([
        [0, 1],
        [1, 1],
      ]),
      new Map(),
      { pageSize: 6, pageCount: 2, floorShare: 0 },
    );

    expect(allocated.map((entry) => entry.cluster)).toEqual([
      0, 1, 0, 1, 0, 1,
      0, 1, 0, 1, 0, 1,
    ]);
    expect(allocated.length).toBeLessThanOrEqual(12);
  });

  it("breaks equal largest-remainder fractions by mass and then cluster index", () => {
    const allocated = allocateAcrossClusters(
      new Map([
        [0, items(1, 10)],
        [1, items(101, 10)],
        [2, items(201, 10)],
        [3, items(301, 10)],
      ]),
      new Map([
        [0, 5],
        [1, 2],
        [2, 2],
        [3, 3],
      ]),
      new Map(),
      { pageSize: 4, pageCount: 1, floorShare: 0 },
    );
    expect(
      [0, 1, 2, 3].map(
        (cluster) =>
          allocated.filter((entry) => entry.cluster === cluster).length,
      ),
    ).toEqual([2, 1, 0, 1]);
  });

  it("renormalizes floors across many tiny clusters to one page", () => {
    const clusterCount = 100;
    const ranked = new Map(
      Array.from({ length: clusterCount }, (_, cluster) => [
        cluster,
        items(cluster * 1000 + 1, 60),
      ]),
    );
    const masses = new Map(
      Array.from({ length: clusterCount }, (_, cluster) => [
        cluster,
        cluster === 0 ? 10_000 : 1,
      ]),
    );

    const allocated = allocateAcrossClusters(
      ranked,
      masses,
      new Map(),
      { pageSize: 48, pageCount: 1, floorShare: 0.02 },
    );

    expect(allocated).toHaveLength(48);
    expect(new Set(allocated.map((entry) => entry.item.id))).toHaveLength(48);
  });

  it("redistributes a cluster's exhausted quota on later pages", () => {
    const allocated = allocateAcrossClusters(
      new Map([
        [0, items(1, 2)],
        [1, items(101, 10)],
      ]),
      new Map([
        [0, 1],
        [1, 1],
      ]),
      new Map(),
      { pageSize: 4, pageCount: 2, floorShare: 0 },
    );

    expect(allocated).toHaveLength(8);
    expect(
      allocated.slice(0, 4).filter((entry) => entry.cluster === 0),
    ).toHaveLength(2);
    expect(
      allocated.slice(4, 8).filter((entry) => entry.cluster === 1),
    ).toHaveLength(4);
  });
});
