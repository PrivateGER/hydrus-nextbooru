/**
 * Read-only diagnostic for the "For You" taste model (src/lib/feed.ts,
 * src/lib/taste.ts). Replays the feed's signal selection and clustering on
 * the connected database and reports where favorites end up:
 *
 *   1. how k-means fragments the signals and what the min-size merge absorbs,
 *   2. how well each final cluster's centroid covers its own favorites,
 *   3. the retrieval funnel per cluster (ANN neighbors -> exclusions -> gates),
 *   4. how much the clustering moves between hourly seeds,
 *   5. the same summary for other cluster counts.
 *
 * Usage (from the repo root, with a source checkout and node_modules):
 *   DATABASE_URL=postgresql://... npx tsx scripts/taste-diagnostic.ts
 *     [--seeds 6]            hourly seeds compared in the stability section
 *     [--k 8,16,24,32,48]    cluster counts compared in the sweep
 *     [--no-funnel]          skip the ANN retrieval funnel (in-memory only)
 *     [--neighbors 10]       also look up each favorite's own nearest posts
 *                            (one ANN lookup per favorite, in small batches)
 *                            and check how many reach the candidate pool
 *
 * Every session is opened with default_transaction_read_only=on and the
 * script aborts unless Postgres confirms it, so it cannot write. It also
 * never touches the running app's in-process feed cache.
 */
import type { FeedConfig } from "@/lib/feed";
import type { TasteMember, TasteModel } from "@/lib/taste";

process.env.PGOPTIONS = [process.env.PGOPTIONS, "-c default_transaction_read_only=on"]
  .filter(Boolean)
  .join(" ");

interface Args {
  seeds: number;
  ks: number[];
  funnel: boolean;
  neighbors: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { seeds: 6, ks: [8, 16, 24, 32, 48], funnel: true, neighbors: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--no-funnel") {
      args.funnel = false;
    } else if (flag === "--neighbors") {
      args.neighbors = Math.min(20, Math.max(1, Number.parseInt(argv[++index] ?? "", 10) || 10));
    } else if (flag === "--seeds") {
      args.seeds = Math.max(2, Number.parseInt(argv[++index] ?? "", 10) || args.seeds);
    } else if (flag === "--k") {
      const ks = (argv[++index] ?? "")
        .split(",")
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0);
      if (ks.length > 0) args.ks = ks;
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }
  if (args.neighbors > 0 && !args.funnel) {
    throw new Error("--neighbors needs the retrieval funnel; drop --no-funnel");
  }
  return args;
}

function quantile(sortedAscending: number[], q: number): number {
  if (sortedAscending.length === 0) return Number.NaN;
  const position = (sortedAscending.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return (
    sortedAscending[lower] +
    (sortedAscending[upper] - sortedAscending[lower]) * (position - lower)
  );
}

function printTable(headers: string[], rows: (string | number)[][]): void {
  const cells = [headers, ...rows.map((row) => row.map(String))];
  const widths = headers.map((_, column) =>
    Math.max(...cells.map((row) => row[column].length))
  );
  for (const [index, row] of cells.entries()) {
    console.log(row.map((cell, column) => cell.padStart(widths[column])).join("  "));
    if (index === 0) console.log(widths.map((width) => "-".repeat(width)).join("  "));
  }
}

function section(title: string): void {
  console.log(`\n== ${title} ==`);
}

const progress = (message: string) => process.stderr.write(`[taste-diagnostic] ${message}\n`);

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  const { prisma } = await import("@/lib/db");
  const { FEED_CONFIG, collapseSignalsByGroup, seedWeight, selectViewSeeds } =
    await import("@/lib/feed");
  const { fitTasteModel, normalizeRows } = await import("@/lib/taste");
  const {
    findNearestByVector,
    findRelatedPostsByEmbeddingForPosts,
    getEmbeddingVectorsForPosts,
    getMaxSimilarityToReferences,
  } = await import("@/lib/embeddings/store");
  const { calibrateEmbeddingScore, estimateEmbeddingBaseline } = await import(
    "@/lib/embeddings/calibration"
  );
  const { getEmbeddingOpenRouterSettings, isEmbeddingProviderConfigured, toEmbeddingConfig } =
    await import("@/lib/embeddings/settings");
  const { SETTINGS_KEYS } = await import("@/lib/openrouter/types");

  const config: FeedConfig = FEED_CONFIG;

  try {
    const [{ read_only: readOnly }] = await prisma.$queryRaw<{ read_only: string }[]>`
      SELECT current_setting('transaction_read_only') AS read_only
    `;
    if (readOnly !== "on") {
      throw new Error(
        "Session is not read-only (does DATABASE_URL carry its own options= parameter?). Aborting."
      );
    }

    const settings = await getEmbeddingOpenRouterSettings();
    if (!isEmbeddingProviderConfigured(settings)) {
      console.log("Embeddings are not configured: the feed uses the tag fallback and has no taste model.");
      return;
    }
    const embeddingConfig = toEmbeddingConfig(settings);
    const dimensions = embeddingConfig.dimensions;

    // Baseline: the stored calibration when it matches the active config,
    // otherwise a fresh estimate (never persisted here).
    let baseline = 0;
    let baselineSource = "none (identity rescale)";
    const calibrationRow = await prisma.settings.findUnique({
      where: { key: SETTINGS_KEYS.EMBEDDING_CALIBRATION },
      select: { value: true },
    });
    if (calibrationRow) {
      try {
        const stored = JSON.parse(calibrationRow.value) as {
          baseline?: number;
          model?: string;
          dimensions?: number;
          computedAt?: string;
        };
        if (
          typeof stored.baseline === "number" &&
          stored.model === embeddingConfig.model &&
          stored.dimensions === dimensions
        ) {
          baseline = stored.baseline;
          baselineSource = `stored ${stored.computedAt ?? ""}`.trim();
        }
      } catch {
        // Corrupt row: fall through to estimation.
      }
    }
    if (baseline === 0) {
      const estimate = await estimateEmbeddingBaseline(embeddingConfig);
      if (estimate) {
        baseline = estimate.baseline;
        baselineSource = `estimated now from ${estimate.sampleSize} embeddings`;
      }
    }
    const calibrated = (raw: number) => calibrateEmbeddingScore(raw, baseline);
    const rawFor = (gate: number) => baseline + gate * (1 - baseline);

    section("Configuration");
    console.log(`model ${embeddingConfig.model} @ ${dimensions}d, baseline ${baseline.toFixed(4)} (${baselineSource})`);
    console.log(
      `gates as raw cosine: centroid floor ${rawFor(config.minEmbeddingScore).toFixed(3)}, ` +
        `member gate ${rawFor(config.memberGate).toFixed(3)}, ` +
        `dismissal radius ${rawFor(config.dismissalRadius).toFixed(3)}`
    );
    console.log(
      `clusterCount ${config.clusterCount}, minClusterSize ${config.minClusterSize}, ` +
        `neighborsPerCluster ${config.neighborsPerCluster}, page ${config.pageSize} x ${config.pageCount}`
    );

    // ---- Signal selection: mirrors buildFeedUnsafe in src/lib/feed.ts ----
    const now = new Date();
    const [favorites, dismissedRows, views] = await Promise.all([
      prisma.favorite.findMany({
        orderBy: { favoritedAt: "desc" },
        select: { postId: true, favoritedAt: true, post: { select: { hash: true } } },
      }),
      prisma.feedDismissal.findMany({ select: { postId: true } }),
      prisma.postView.findMany({
        where: { post: { favorite: { is: null }, feedDismissal: { is: null } } },
        orderBy: { lastViewedAt: "desc" },
        take: config.viewSeedCount * 4,
        select: {
          postId: true,
          viewCount: true,
          lastViewedAt: true,
          post: { select: { hash: true } },
        },
      }),
    ]);
    if (favorites.length === 0) {
      console.log("\nNo favorites: the feed is empty by design.");
      return;
    }
    const dismissedIds = dismissedRows.map((row) => row.postId);
    const favoriteInputs = favorites.map((favorite) => ({
      postId: favorite.postId,
      hash: favorite.post.hash,
      favoritedAt: favorite.favoritedAt,
    }));
    const viewInputs = views.map((view) => ({
      postId: view.postId,
      hash: view.post.hash,
      viewCount: view.viewCount,
      lastViewedAt: view.lastViewedAt,
    }));
    const signalGroupRows = await prisma.postGroup.findMany({
      where: { postId: { in: [...favoriteInputs, ...viewInputs].map((signal) => signal.postId) } },
      select: { postId: true, groupId: true },
    });
    const signalGroupsByPostId = new Map<number, number[]>();
    for (const { postId, groupId } of signalGroupRows) {
      const existing = signalGroupsByPostId.get(postId);
      if (existing) existing.push(groupId);
      else signalGroupsByPostId.set(postId, [groupId]);
    }
    const seenGroups = new Set<number>();
    const collapsedFavorites = collapseSignalsByGroup(favoriteInputs, signalGroupsByPostId, seenGroups);
    const collapsedViews = collapseSignalsByGroup(viewInputs, signalGroupsByPostId, seenGroups);
    const favoriteMembers: TasteMember[] = collapsedFavorites
      .slice(0, config.maxTasteMembers)
      .map((favorite) => ({
        postId: favorite.postId,
        weight: seedWeight(favorite.favoritedAt, now, config.recencyHalfLifeDays),
        kind: "favorite",
      }));
    const viewMembers: TasteMember[] = selectViewSeeds(collapsedViews, now, config)
      .slice(0, Math.max(0, config.maxTasteMembers - favoriteMembers.length))
      .map((view) => ({ postId: view.postId, weight: view.weight, kind: "view" }));
    const members = [...favoriteMembers, ...viewMembers];

    progress(`loading ${members.length} member vectors`);
    const vectorRows = await getEmbeddingVectorsForPosts({
      postIds: members.map((member) => member.postId),
      config: embeddingConfig,
    });
    const vectorByPostId = new Map(vectorRows.map((row) => [row.postId, row.vector]));
    const embedded = members.filter((member) => vectorByPostId.has(member.postId));
    const rowByPostId = new Map(embedded.map((member, row) => [member.postId, row]));
    const vectors = new Float32Array(embedded.length * dimensions);
    embedded.forEach((member, row) => {
      vectors.set(vectorByPostId.get(member.postId)!, row * dimensions);
    });
    normalizeRows(vectors, dimensions);

    const embeddedFavorites = embedded.filter((member) => member.kind === "favorite").length;
    section("Signals");
    console.log(
      `favorites ${favorites.length} -> ${collapsedFavorites.length} after group collapse -> ` +
        `${favoriteMembers.length} modelled (cap ${config.maxTasteMembers}), ${embeddedFavorites} with an embedding`
    );
    console.log(
      `views ${viewMembers.length} modelled, ${embedded.length - embeddedFavorites} with an embedding; ` +
        `dismissals ${dismissedIds.length}`
    );
    const missing = favoriteMembers.length - embeddedFavorites;
    if (missing > 0) {
      console.log(`${missing} modelled favorites have no embedding and contribute nothing to the feed.`);
    }
    if (embedded.length === 0) {
      console.log("No embedded signals: the feed uses the tag fallback.");
      return;
    }
    const totalWeight = embedded.reduce((sum, member) => sum + member.weight, 0);
    const sortedWeights = embedded.map((member) => member.weight).sort((a, b) => a - b);
    console.log(
      `member weight: total ${totalWeight.toFixed(1)}, median ${quantile(sortedWeights, 0.5).toFixed(3)} ` +
        `(1 = favorited today; halves every ${config.recencyHalfLifeDays} days)`
    );

    // ---- Model helpers ----
    const fit = (
      clusterCount: number,
      minClusterSize: number,
      seed: number,
      warmStart: Float32Array | null
    ): TasteModel =>
      fitTasteModel(
        embedded,
        vectors,
        dimensions,
        { clusterCount, minClusterSize, maxIterations: config.clusterIterations },
        seed,
        warmStart
      );
    const similarity = (row: number, centroid: Float32Array): number => {
      const offset = row * dimensions;
      let dot = 0;
      for (let dimension = 0; dimension < dimensions; dimension += 1) {
        dot += vectors[offset + dimension] * centroid[dimension];
      }
      return dot;
    };
    const flattenCentroids = (model: TasteModel): Float32Array => {
      const flat = new Float32Array(model.clusters.length * dimensions);
      model.clusters.forEach((cluster, index) => flat.set(cluster.centroid, index * dimensions));
      return flat;
    };
    const assignmentsOf = (model: TasteModel): Int32Array => {
      const assignments = new Int32Array(embedded.length).fill(-1);
      for (const cluster of model.clusters) {
        for (const postId of cluster.memberPostIds) {
          assignments[rowByPostId.get(postId)!] = cluster.index;
        }
      }
      return assignments;
    };
    /** Members' raw similarity to their own centroid, in member-row order. */
    const ownSimilarities = (model: TasteModel): Float32Array => {
      const sims = new Float32Array(embedded.length);
      for (const cluster of model.clusters) {
        for (const postId of cluster.memberPostIds) {
          const row = rowByPostId.get(postId)!;
          sims[row] = similarity(row, cluster.centroid);
        }
      }
      return sims;
    };
    /** Favorites whose own cluster centroid would reject them at the floor. */
    const rejectedFavorites = (sims: Float32Array): number =>
      embedded.filter(
        (member, row) =>
          member.kind === "favorite" && calibrated(sims[row]) < config.minEmbeddingScore
      ).length;
    /**
     * Jaccard overlap of "same cluster" member pairs between two clusterings:
     * 1 = identical partitions, 0 = no pair of members stays together.
     */
    const coMembership = (a: Int32Array, b: Int32Array): number => {
      let both = 0;
      let either = 0;
      for (let i = 0; i < a.length; i += 1) {
        for (let j = i + 1; j < a.length; j += 1) {
          const inA = a[i] === a[j];
          const inB = b[i] === b[j];
          if (inA || inB) either += 1;
          if (inA && inB) both += 1;
        }
      }
      return either === 0 ? 1 : both / either;
    };
    const summarize = (clusterCount: number, seed: number) => {
      const raw = fit(clusterCount, 1, seed, null);
      const merged = fit(clusterCount, config.minClusterSize, seed, null);
      const fragments = raw.clusters.filter(
        (cluster) => cluster.memberPostIds.length < config.minClusterSize
      );
      const absorbed = new Set(fragments.flatMap((cluster) => cluster.memberPostIds));
      const sims = ownSimilarities(merged);
      return { raw, merged, fragments, absorbed, sims };
    };

    // ---- 1 + 2. Current model ----
    const bucket = Math.floor(Date.now() / 3_600_000);
    progress(`fitting k=${config.clusterCount} for the current hour`);
    const current = summarize(config.clusterCount, bucket);
    const { merged: model, sims } = current;

    section(`Clustering at k=${config.clusterCount} (cold start, current hourly seed)`);
    const rawSizes = current.raw.clusters
      .map((cluster) => cluster.memberPostIds.length)
      .sort((a, b) => b - a);
    console.log(`k-means cluster sizes before the merge: ${rawSizes.join(" ")}`);
    console.log(
      `${current.fragments.length} clusters are below minClusterSize ${config.minClusterSize}; ` +
        `their ${current.absorbed.size} members were merged into the nearest surviving cluster, ` +
        `leaving ${model.clusters.length} clusters.`
    );
    if (current.absorbed.size > 0) {
      const absorbedSims = [...current.absorbed]
        .map((postId) => sims[rowByPostId.get(postId)!])
        .sort((a, b) => a - b);
      const absorbedRejected = absorbedSims.filter(
        (value) => calibrated(value) < config.minEmbeddingScore
      ).length;
      console.log(
        `merged-in members vs their adoptive centroid: raw cosine min ${absorbedSims[0].toFixed(3)}, ` +
          `median ${quantile(absorbedSims, 0.5).toFixed(3)}; ${absorbedRejected} sit below the centroid floor.`
      );
    }

    const massTotal = model.clusters.reduce((sum, cluster) => sum + cluster.mass, 0);
    const shares = model.clusters.map((cluster) =>
      Math.max(massTotal > 0 ? cluster.mass / massTotal : 0, config.floorShare)
    );
    const shareTotal = shares.reduce((sum, share) => sum + share, 0);

    // ---- 3. Retrieval funnel ----
    interface Funnel {
      retrieved: number;
      radius: number;
      excluded: number;
      belowFloor: number;
      failedGate: number;
      dismissedNear: number;
      survivors: number[];
    }
    const funnels = new Map<number, Funnel>();
    const excluded = new Set<number>();
    if (args.funnel) {
      progress("running the retrieval funnel (one ANN query per cluster)");
      const siblingRows = await prisma.postGroup.findMany({
        where: {
          group: {
            posts: {
              some: {
                OR: [
                  { postId: { in: dismissedIds } },
                  { post: { favorite: { isNot: null } } },
                ],
              },
            },
          },
        },
        select: { postId: true },
      });
      for (const postId of [
        ...favorites.map((favorite) => favorite.postId),
        ...dismissedIds,
        ...siblingRows.map((row) => row.postId),
      ]) {
        excluded.add(postId);
      }
      for (const cluster of model.clusters) {
        const neighbors = await findNearestByVector({
          vector: cluster.centroid,
          config: embeddingConfig,
          limit: config.neighborsPerCluster,
        });
        const notExcluded = neighbors.filter((neighbor) => !excluded.has(neighbor.postId));
        const aboveFloor = notExcluded.filter(
          (neighbor) => calibrated(neighbor.score) >= config.minEmbeddingScore
        );
        let gated = aboveFloor;
        if (cluster.favoritePostIds.length > 0 && aboveFloor.length > 0) {
          const toFavorites = await getMaxSimilarityToReferences({
            candidateIds: aboveFloor.map((neighbor) => neighbor.postId),
            referenceIds: cluster.favoritePostIds,
            config: embeddingConfig,
          });
          gated = aboveFloor.filter((neighbor) => {
            const raw = toFavorites.get(neighbor.postId);
            return raw !== undefined && calibrated(raw) >= config.memberGate;
          });
        }
        let survivors = gated;
        if (dismissedIds.length > 0 && gated.length > 0) {
          const toDismissed = await getMaxSimilarityToReferences({
            candidateIds: gated.map((neighbor) => neighbor.postId),
            referenceIds: dismissedIds,
            config: embeddingConfig,
          });
          survivors = gated.filter((neighbor) => {
            const raw = toDismissed.get(neighbor.postId);
            return raw === undefined || calibrated(raw) < config.dismissalRadius;
          });
        }
        funnels.set(cluster.index, {
          retrieved: neighbors.length,
          // A short result means the whole store was returned: no reach limit.
          radius:
            neighbors.length >= config.neighborsPerCluster
              ? neighbors[neighbors.length - 1].score
              : -1,
          excluded: neighbors.length - notExcluded.length,
          belowFloor: notExcluded.length - aboveFloor.length,
          failedGate: aboveFloor.length - gated.length,
          dismissedNear: gated.length - survivors.length,
          survivors: survivors.map((neighbor) => neighbor.postId),
        });
      }
    }

    section("Final clusters");
    console.log(
      "floor-rej = favorites the cluster's own centroid would reject as candidates; " +
        "out-of-reach = favorites further from the centroid than its last retrieved neighbor."
    );
    const order = [...model.clusters].sort((a, b) => b.mass - a.mass);
    let totalOutOfReach = 0;
    const outOfReachFavorites = new Set<number>();
    printTable(
      [
        "cluster",
        "members",
        "favs",
        "views",
        "merged-in",
        "slots/page",
        "cos p10",
        "cos med",
        "floor-rej",
        ...(args.funnel
          ? ["reach", "out-of-reach", "retrieved", "excluded", "<floor", "gate", "dismiss", "survive"]
          : []),
      ],
      order.map((cluster) => {
        const rows = cluster.memberPostIds.map((postId) => rowByPostId.get(postId)!);
        const clusterSims = rows.map((row) => sims[row]).sort((a, b) => a - b);
        const favoriteRows = rows.filter((row) => embedded[row].kind === "favorite");
        const floorRejected = favoriteRows.filter(
          (row) => calibrated(sims[row]) < config.minEmbeddingScore
        ).length;
        const funnel = funnels.get(cluster.index);
        const outOfReachRows = funnel
          ? favoriteRows.filter((row) => sims[row] < funnel.radius)
          : [];
        for (const row of outOfReachRows) outOfReachFavorites.add(embedded[row].postId);
        const outOfReach = outOfReachRows.length;
        totalOutOfReach += outOfReach;
        return [
          cluster.index,
          cluster.memberPostIds.length,
          cluster.favoritePostIds.length,
          cluster.memberPostIds.length - cluster.favoritePostIds.length,
          cluster.memberPostIds.filter((postId) => current.absorbed.has(postId)).length,
          ((shares[cluster.index] / shareTotal) * config.pageSize).toFixed(1),
          quantile(clusterSims, 0.1).toFixed(3),
          quantile(clusterSims, 0.5).toFixed(3),
          floorRejected,
          ...(funnel
            ? [
                funnel.radius < 0 ? "all" : funnel.radius.toFixed(3),
                outOfReach,
                funnel.retrieved,
                funnel.excluded,
                funnel.belowFloor,
                funnel.failedGate,
                funnel.dismissedNear,
                funnel.survivors.length,
              ]
            : []),
        ];
      })
    );

    section("Coverage of favorites");
    const bestSims = embedded.map((_, row) =>
      Math.max(...model.clusters.map((cluster) => similarity(row, cluster.centroid)))
    );
    const rejectedByOwn = rejectedFavorites(sims);
    const rejectedByAll = embedded.filter(
      (member, row) =>
        member.kind === "favorite" && calibrated(bestSims[row]) < config.minEmbeddingScore
    ).length;
    console.log(
      `${rejectedByOwn} of ${embeddedFavorites} favorites sit below the centroid floor of their own cluster; ` +
        `${rejectedByAll} sit below the floor of every cluster. Posts resembling those favorites ` +
        `cannot enter the feed through the centroid floor.`
    );
    if (args.funnel) {
      const uniqueSurvivors = new Set(
        [...funnels.values()].flatMap((funnel) => funnel.survivors)
      );
      console.log(
        `${totalOutOfReach} of ${embeddedFavorites} favorites lie outside their cluster's ` +
          `${config.neighborsPerCluster}-neighbor reach (a proxy: --neighbors measures their neighborhoods directly).`
      );
      console.log(
        `${uniqueSurvivors.size} unique candidates survive every gate ` +
          `(feed cap ${config.maxFeedSize}; group and duplicate collapse can only lower this).`
      );
    }

    // ---- 3b. Direct check: each favorite's own nearest posts vs the pool ----
    if (args.neighbors > 0) {
      const pool = new Set([...funnels.values()].flatMap((funnel) => funnel.survivors));
      const favoriteIds = embedded
        .filter((member) => member.kind === "favorite")
        .map((member) => member.postId);
      // Small sequential batches: the store runs every 16-seed chunk of a call
      // in parallel, so one call per 32 favorites keeps this at two concurrent
      // queries against a database that is also serving the app.
      const BATCH = 32;
      const lookupStarted = Date.now();
      const eligibleByFavorite = new Map<number, { id: number; score: number }[]>();
      for (let offset = 0; offset < favoriteIds.length; offset += BATCH) {
        if (offset % (BATCH * 8) === 0) {
          progress(`neighbors: ${offset}/${favoriteIds.length} favorites`);
        }
        const batch = favoriteIds.slice(offset, offset + BATCH);
        const related = await findRelatedPostsByEmbeddingForPosts({
          postIds: batch,
          config: embeddingConfig,
          limit: args.neighbors,
        });
        for (const postId of batch) {
          eligibleByFavorite.set(
            postId,
            (related.get(postId) ?? [])
              .filter((post) => !excluded.has(post.id))
              .map((post) => ({ id: post.id, score: post.score }))
          );
        }
      }
      const lookupSeconds = (Date.now() - lookupStarted) / 1000;

      const tally = { in: { total: 0, represented: 0 }, out: { total: 0, represented: 0 } };
      const uniqueNeighbors = new Set<number>();
      const neighborScores: number[] = [];
      let pairs = 0;
      let pairsInPool = 0;
      let withoutEligible = 0;
      for (const postId of favoriteIds) {
        const eligible = eligibleByFavorite.get(postId) ?? [];
        if (eligible.length === 0) withoutEligible += 1;
        const bucketTally = outOfReachFavorites.has(postId) ? tally.out : tally.in;
        bucketTally.total += 1;
        if (eligible.some((neighbor) => pool.has(neighbor.id))) bucketTally.represented += 1;
        for (const neighbor of eligible) {
          uniqueNeighbors.add(neighbor.id);
          neighborScores.push(neighbor.score);
          pairs += 1;
          if (pool.has(neighbor.id)) pairsInPool += 1;
        }
      }
      neighborScores.sort((a, b) => a - b);
      const uniqueInPool = [...uniqueNeighbors].filter((id) => pool.has(id)).length;
      const share = (part: number, whole: number) =>
        whole === 0 ? "n/a" : `${((part / whole) * 100).toFixed(0)} %`;

      section(`Each favorite's own top-${args.neighbors} neighbors vs the candidate pool`);
      console.log(
        `${favoriteIds.length} ANN lookups in ${lookupSeconds.toFixed(1)} s ` +
          `(${((lookupSeconds * 1000) / favoriteIds.length).toFixed(0)} ms per favorite, two queries at a time).`
      );
      console.log(
        `eligible neighbors (not a favorite, sibling or dismissal): ${(pairs / favoriteIds.length).toFixed(1)} per favorite, ` +
          `raw cosine p10 ${quantile(neighborScores, 0.1).toFixed(3)}, median ${quantile(neighborScores, 0.5).toFixed(3)}; ` +
          `${withoutEligible} favorites have none.`
      );
      const represented = tally.in.represented + tally.out.represented;
      console.log(
        `favorites with at least one of those neighbors in the pool: ${represented} of ${favoriteIds.length} ` +
          `(${share(represented, favoriteIds.length)}); within reach ${tally.in.represented}/${tally.in.total} ` +
          `(${share(tally.in.represented, tally.in.total)}), out of reach ${tally.out.represented}/${tally.out.total} ` +
          `(${share(tally.out.represented, tally.out.total)}).`
      );
      console.log(
        `favorite-neighbor pairs in the pool: ${pairsInPool} of ${pairs} (${share(pairsInPool, pairs)}). ` +
          `Unique neighbors: ${uniqueNeighbors.size}, of which ${uniqueInPool} are in the pool and ` +
          `${uniqueNeighbors.size - uniqueInPool} are never retrieved by a centroid.`
      );
      console.log(
        `The pool holds ${pool.size} candidates and the feed serves at most ${config.maxFeedSize} of them, ` +
          `so these are upper bounds on what the feed shows.`
      );
    }

    // ---- 4. Stability across hourly seeds ----
    section(`Stability across ${args.seeds} hourly seeds at k=${config.clusterCount}`);
    console.log(
      "co-membership = share of same-cluster member pairs kept from the previous hour (1 = identical). " +
        "The app warm-starts from the previous centroids until it restarts; cold = after a restart."
    );
    const stabilityRows: (string | number)[][] = [];
    let previousCold: Int32Array | null = null;
    let previousWarm: Int32Array | null = null;
    let warmCentroids: Float32Array | null = null;
    for (let step = 0; step < args.seeds; step += 1) {
      progress(`stability: seed ${step + 1}/${args.seeds}`);
      const cold: TasteModel =
        step === 0 ? model : fit(config.clusterCount, config.minClusterSize, bucket + step, null);
      const warm: TasteModel =
        step === 0
          ? model
          : fit(config.clusterCount, config.minClusterSize, bucket + step, warmCentroids);
      warmCentroids = flattenCentroids(warm);
      const coldAssignments = assignmentsOf(cold);
      const warmAssignments = assignmentsOf(warm);
      stabilityRows.push([
        `+${step}h`,
        cold.clusters.length,
        rejectedFavorites(ownSimilarities(cold)),
        previousCold ? coMembership(previousCold, coldAssignments).toFixed(2) : "-",
        warm.clusters.length,
        rejectedFavorites(ownSimilarities(warm)),
        previousWarm ? coMembership(previousWarm, warmAssignments).toFixed(2) : "-",
      ]);
      previousCold = coldAssignments;
      previousWarm = warmAssignments;
    }
    printTable(
      ["seed", "cold clusters", "cold floor-rej", "cold co-memb", "warm clusters", "warm floor-rej", "warm co-memb"],
      stabilityRows
    );

    // ---- 5. Cluster-count sweep ----
    section("Cluster-count sweep (cold start, current hourly seed)");
    const sweepRows: (string | number)[][] = [];
    for (const clusterCount of args.ks) {
      progress(`sweep: k=${clusterCount}`);
      const result =
        clusterCount === config.clusterCount ? current : summarize(clusterCount, bucket);
      const sorted = [...result.sims].sort((a, b) => a - b);
      const sizes = result.merged.clusters.map((cluster) => cluster.memberPostIds.length);
      sweepRows.push([
        clusterCount,
        result.merged.clusters.length,
        result.fragments.length,
        result.absorbed.size,
        Math.max(...sizes),
        quantile(sorted, 0.1).toFixed(3),
        quantile(sorted, 0.5).toFixed(3),
        rejectedFavorites(result.sims),
      ]);
    }
    printTable(
      ["k", "clusters", "fragments", "merged-in", "largest", "cos p10", "cos med", "floor-rej"],
      sweepRows
    );

    progress(`done in ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
