window.BENCHMARK_DATA = {
  "lastUpdate": 1781108058147,
  "repoUrl": "https://github.com/PrivateGER/hydrus-nextbooru",
  "entries": {
    "API benchmarks": [
      {
        "commit": {
          "author": {
            "email": "privateger@privateger.me",
            "name": "Latte macchiato",
            "username": "PrivateGER"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "34892fb814381fcd85ebafe4c5197d5874fb3bb9",
          "message": "Merge pull request #135 from PrivateGER/fix/perf-rate-limit-bypass\n\nFix CI benchmark failures: rate limiting was short-circuiting perf suites",
          "timestamp": "2026-06-10T16:52:03+02:00",
          "tree_id": "6e94040de178e651026d9272edd30df0961e960c",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/34892fb814381fcd85ebafe4c5197d5874fb3bb9"
        },
        "date": 1781108057424,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 130.027610000001,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 194.521745,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 277.2141620000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 424.8500039999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 500.58795700000337,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 660.5377469999949,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 33.804378000000725,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 64.19429500000115,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 31.798885000000155,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 48.246572000000015,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 51.48158700000204,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2016.603280999996,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9573370000016439,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 1.7221539999991364,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 17.221016999999847,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 25.246973999999682,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 6.503312000000733,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 9.836503000000448,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.878480000001218,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 27.162156999998842,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.078373000000283,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 29.13848599999983,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 44.98515199999747,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 63.05149299999903,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.845712000000276,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 6.0144060000002355,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.15494100000069,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 15.553068999999596,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 12510.906146000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 13327.503925,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.84453399999984,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 10.811314000002312,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 55.13260799999989,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 76.7137380000022,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 53.89577800000188,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 76.69079500000225,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 35.95849100000123,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 73.62359899999865,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 32.26414400000067,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 59.75244300000122,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      }
    ]
  }
}