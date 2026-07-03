window.BENCHMARK_DATA = {
  "lastUpdate": 1783061178505,
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
      },
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
          "id": "45c4321b0ec3afc69bdcfc2b81670abdc6ead50c",
          "message": "[release] Merge pull request #136 from PrivateGER/refactor/remove-base-url-ssrf-filtering\n\nfix(settings): remove SSRF filtering from admin LLM base URLs",
          "timestamp": "2026-06-12T01:45:23+02:00",
          "tree_id": "75e72b0b44cf9ab1e0d513e1766188309c2b176d",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/45c4321b0ec3afc69bdcfc2b81670abdc6ead50c"
        },
        "date": 1781221692228,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 139.0172789999997,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 280.34289700000227,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 347.09115700000257,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 426.91037300000244,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 771.6264529999971,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 1174.318717000002,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 30.560271999998804,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 74.32549100000324,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 29.12655900000027,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 42.9762550000014,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 76.50980100000743,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1844.6751529999965,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0680210000009538,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.038763000000472,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 16.671337999998286,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 25.794465000000855,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 12.28581099999974,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 22.86856699999953,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 13.100679999999556,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 26.37159099999917,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 13.14312500000051,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 37.77775400000064,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 42.738829000001715,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 79.10414600000149,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.763973999999507,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.692519000000175,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.8717129999986355,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.58227799999986,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 12340.235959999998,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12732.908390999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.36126399999921,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 9.089286999998876,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 70.65978800000084,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 108.30245899999863,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 47.89867500000037,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 77.69626500000231,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.675148999998783,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 62.55510999999751,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 35.506844000003184,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 56.612059999999474,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "45c4321b0ec3afc69bdcfc2b81670abdc6ead50c",
          "message": "[release] Merge pull request #136 from PrivateGER/refactor/remove-base-url-ssrf-filtering\n\nfix(settings): remove SSRF filtering from admin LLM base URLs",
          "timestamp": "2026-06-11T23:45:23Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/45c4321b0ec3afc69bdcfc2b81670abdc6ead50c"
        },
        "date": 1781240352115,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 152.46328299999732,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 230.61248400000113,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 259.99919200000295,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 444.9711860000025,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 595.7385480000012,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 756.8241770000022,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 26.252040999999736,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 58.754908999999316,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 31.339303999997355,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 51.37830699999904,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 1221.7842569999993,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1794.6816269999981,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9194420000003447,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.8510539999988396,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 14.97617100000025,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 20.842823000000863,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.408175000000483,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 18.30102999999872,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.940042999998695,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 28.77147800000057,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.548651000000973,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 45.12229400000069,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 41.60322199999973,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 79.88707799999975,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.7848249999988184,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 7.492438999999649,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.915745000000243,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 19.478472999999212,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11906.389463,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12927.546128999998,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.255498999998963,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 9.190052999998443,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 53.30462599999737,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 76.29543199999898,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 43.16846599999917,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 107.58502900000167,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.22644600000058,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 67.13940500000172,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 32.560787000002165,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 65.32587999999669,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "45c4321b0ec3afc69bdcfc2b81670abdc6ead50c",
          "message": "[release] Merge pull request #136 from PrivateGER/refactor/remove-base-url-ssrf-filtering\n\nfix(settings): remove SSRF filtering from admin LLM base URLs",
          "timestamp": "2026-06-11T23:45:23Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/45c4321b0ec3afc69bdcfc2b81670abdc6ead50c"
        },
        "date": 1781326437381,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 166.21868600000016,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 221.7475599999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 228.7083930000008,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 307.32685299999866,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 396.315165,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 475.974973999997,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 28.267180000002554,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 40.499495000000024,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 22.955080000003363,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 46.67111400000067,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 1201.2451409999994,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1782.3929920000082,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0273879999986093,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 4.019768999998632,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 13.132542999999714,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 20.26103400000102,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.192847000000256,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 21.70259199999964,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 10.335479999999734,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 21.752738999999565,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 9.837267000000793,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 27.823574999998527,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 38.51278099999945,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 81.42547199999899,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.938120999999228,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 9.590389000000869,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.581788999999844,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 5.3386869999994815,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11419.591053999997,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12409.691506000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.852932999998302,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 5.637490999997681,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 51.74724499999866,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 70.42078799999945,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 42.30010499999844,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 77.02047900000252,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 27.184900000000198,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 43.276668000002246,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 26.002913000000262,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 43.595908999999665,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "45c4321b0ec3afc69bdcfc2b81670abdc6ead50c",
          "message": "[release] Merge pull request #136 from PrivateGER/refactor/remove-base-url-ssrf-filtering\n\nfix(settings): remove SSRF filtering from admin LLM base URLs",
          "timestamp": "2026-06-11T23:45:23Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/45c4321b0ec3afc69bdcfc2b81670abdc6ead50c"
        },
        "date": 1781413198239,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 123.63223799999832,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 212.08784000000014,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 202.87854499999958,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 269.57079800000065,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 352.6224460000012,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 416.532518,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.835519000000204,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 46.36066600000049,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 29.936146000000008,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 50.67435900000055,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 70.30179500000668,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1929.747531999994,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9253709999993589,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.499968000000081,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 14.869604000001345,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 43.71631200000047,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 11.266575999999986,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 22.098438999999416,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.66155500000059,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 21.349457999998776,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 10.409050999998726,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 24.160117999999784,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 43.18407300000035,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 97.63673700000072,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.044176999999763,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 20.006874999999127,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.353759999999966,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 7.905985999999757,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11468.642638999998,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12500.007586,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.614827000001242,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 8.48170399999799,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 57.8408019999988,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 78.87720299999637,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 46.33993600000031,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 85.99663499999951,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.798962000000756,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 60.92414099999951,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 34.27642900000137,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 58.782342999998946,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "45c4321b0ec3afc69bdcfc2b81670abdc6ead50c",
          "message": "[release] Merge pull request #136 from PrivateGER/refactor/remove-base-url-ssrf-filtering\n\nfix(settings): remove SSRF filtering from admin LLM base URLs",
          "timestamp": "2026-06-11T23:45:23Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/45c4321b0ec3afc69bdcfc2b81670abdc6ead50c"
        },
        "date": 1781499638139,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 142.86234499999773,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 236.476498,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 230.17333099999814,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 380.69144400000005,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 427.1966889999967,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 528.8009020000027,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.861798999998427,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 52.641843000001245,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 31.115042000001267,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 67.39766800000143,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 80.90771799998765,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1964.640250000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9084029999994527,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.476248000000851,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 14.799707999998645,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 22.52777900000001,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 9.982511000000159,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 15.445020000001023,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.185928000000786,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 22.668993999999657,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.509106999999858,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 43.60153100000025,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 44.68114200000127,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 85.41485900000043,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.8944940000001225,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.2044779999996535,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.085025000000314,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.93647299999975,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11717.799929,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12668.799103000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.4532970000000205,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.495805000002292,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 56.25800700000036,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 102.36826000000292,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 45.45285599999988,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 98.38406799999939,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 33.52300699999978,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 58.27444900000046,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.54279299999689,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 52.97820900000079,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "45c4321b0ec3afc69bdcfc2b81670abdc6ead50c",
          "message": "[release] Merge pull request #136 from PrivateGER/refactor/remove-base-url-ssrf-filtering\n\nfix(settings): remove SSRF filtering from admin LLM base URLs",
          "timestamp": "2026-06-11T23:45:23Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/45c4321b0ec3afc69bdcfc2b81670abdc6ead50c"
        },
        "date": 1781586122024,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 140.02821699999913,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 276.7257290000016,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 315.7751669999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 593.6511710000013,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 695.1062730000049,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 828.5678319999934,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 23.059250000002066,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 54.84502299999804,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 22.34055300000182,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 45.294637999999395,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 53.1111760000058,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1915.9240239999926,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0230139999985113,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.99453099999846,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.671263000000181,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 48.54578500000025,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 11.06802400000015,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 34.183594000000085,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.192085000000588,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 21.10823999999957,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.55058100000133,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 30.811659000000873,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 43.67042500000025,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 90.82673299999988,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.89222399999926,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 3.591346999999587,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.514197000000422,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 10.526891999999862,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11112.549938999997,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 11951.787112999998,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.464141000000382,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 11.00407500000074,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 46.98491500000091,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 88.91213699999935,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 41.04318599999897,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 100.46126300000105,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 30.76740399999835,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 57.79681999999957,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 34.11751699999877,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 63.4501139999993,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "45c4321b0ec3afc69bdcfc2b81670abdc6ead50c",
          "message": "[release] Merge pull request #136 from PrivateGER/refactor/remove-base-url-ssrf-filtering\n\nfix(settings): remove SSRF filtering from admin LLM base URLs",
          "timestamp": "2026-06-11T23:45:23Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/45c4321b0ec3afc69bdcfc2b81670abdc6ead50c"
        },
        "date": 1781672426611,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 138.6769320000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 239.7174869999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 219.0966980000012,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 313.23891300000105,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 404.5540019999971,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 577.0881599999993,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.798655999999028,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 44.57173300000068,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 29.502258000000438,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 67.38844700000118,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 1159.4093030000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1648.5077290000045,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9708250000003318,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.9288269999997283,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 13.286258999998608,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 41.420795,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.464437000000544,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 18.47640499999943,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.5666999999994,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 22.051971000000776,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.674759000001359,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 30.133049999998548,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 38.15222899999935,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 81.44777599999725,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.77357899999879,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 7.04613099999915,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.5747989999999845,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.264780999999857,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11492.488506000002,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12313.516268,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.1892230000012205,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.713692999997875,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 49.053971000001184,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 87.97884499999782,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 42.215211999999156,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 64.67333800000051,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 30.529575000000477,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 60.46179800000027,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 33.07072699999844,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 55.62464799999725,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "45c4321b0ec3afc69bdcfc2b81670abdc6ead50c",
          "message": "[release] Merge pull request #136 from PrivateGER/refactor/remove-base-url-ssrf-filtering\n\nfix(settings): remove SSRF filtering from admin LLM base URLs",
          "timestamp": "2026-06-11T23:45:23Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/45c4321b0ec3afc69bdcfc2b81670abdc6ead50c"
        },
        "date": 1781758740701,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 196.85129199999938,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 349.9713269999993,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 474.0734339999981,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 680.558818999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 819.1969749999989,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 1032.9438510000036,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 26.309730000000854,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 42.87886399999843,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 30.790675000000192,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 38.67142199999944,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 51.32392500000424,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2042.4311860000016,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.8994840000013937,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.6587429999999586,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 16.438780000000406,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 27.488750999998956,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.680436000000554,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 16.059878000000026,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.57835999999952,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 27.549435000000813,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.716024999999718,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 17.24231999999938,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 46.46098400000119,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 72.25052499999947,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.3937109999988024,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 4.425578999998834,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.998472000001129,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 9.632962000001498,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11127.005706000004,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12298.329671,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.60338000000047,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 9.272860999999466,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 51.81686300000001,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 95.3517789999969,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 43.11581500000102,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 69.4151039999997,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 34.320936000000074,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 46.76253200000065,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.20914300000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 68.31448799999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "45c4321b0ec3afc69bdcfc2b81670abdc6ead50c",
          "message": "[release] Merge pull request #136 from PrivateGER/refactor/remove-base-url-ssrf-filtering\n\nfix(settings): remove SSRF filtering from admin LLM base URLs",
          "timestamp": "2026-06-11T23:45:23Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/45c4321b0ec3afc69bdcfc2b81670abdc6ead50c"
        },
        "date": 1781930947092,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 167.0160880000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 366.0429980000008,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 342.63501599999654,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 547.2898950000017,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 666.4246319999947,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 878.7899160000015,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 28.083511999997427,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 52.01630500000101,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 27.49104399999851,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 59.46151299999838,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 153.13478599999507,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1727.2858049999995,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9526430000005348,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.013182999999117,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.933787000001757,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 27.569138999999268,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 13.128859000000375,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 34.32475300000078,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.597929999999906,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 33.67939099999967,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.028132000001278,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 25.826928999998927,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 41.0523890000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 74.09772399999929,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.096357000000353,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 8.939696999999796,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.1030659999996715,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 7.254413000000568,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 12410.328066000002,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 13289.246985,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.149992999999085,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 9.257676999997784,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 50.736424000002444,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 91.13809400000173,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 45.62216099999932,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 77.50759200000175,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 30.559654999997292,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 71.21565800000099,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 32.310310999997455,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 73.60657899999933,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "45c4321b0ec3afc69bdcfc2b81670abdc6ead50c",
          "message": "[release] Merge pull request #136 from PrivateGER/refactor/remove-base-url-ssrf-filtering\n\nfix(settings): remove SSRF filtering from admin LLM base URLs",
          "timestamp": "2026-06-11T23:45:23Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/45c4321b0ec3afc69bdcfc2b81670abdc6ead50c"
        },
        "date": 1782018017156,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 128.23579600000085,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 176.35947999999917,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 204.27760000000126,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 284.1634759999979,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 347.9502859999993,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 416.466542999995,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.145218000001478,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 60.11402100000123,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 28.684087999998155,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 78.66479600000093,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 57.72157199999492,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1952.0900949999996,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0797910000001139,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.0020580000000336,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.140214999999444,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 48.36305299999913,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 12.24741399999948,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 29.302206000000297,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.797427999999854,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 23.534907999999632,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 10.989013000000341,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 28.66959599999973,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 40.04218299999957,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 73.52222699999948,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.9454139999998006,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 6.0758330000007845,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.847066000000268,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.19276600000012,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11459.873144999998,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12149.995608000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.1029989999988175,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 8.979005999997753,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 56.59802599999966,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 107.12542100000064,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 48.656371999997646,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 96.22466300000087,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.62322099999801,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 55.33333599999969,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 32.471560999998474,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 68.5772590000015,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
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
          "id": "21f3cad7a757a2f4757402ce8093af84911d4de2",
          "message": "Merge pull request #137 from PrivateGER/feat/search-related-tags\n\nfeat(search): related-tags drill-down sidebar + duplicate filmstrip fix",
          "timestamp": "2026-06-22T14:50:08+02:00",
          "tree_id": "7a3bb02aba2951cc325658516b41116a14bbb585",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/21f3cad7a757a2f4757402ce8093af84911d4de2"
        },
        "date": 1782132744316,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 123.81638700000076,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 167.95502500000111,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 207.21654499999931,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 335.2646370000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 307.81045599999925,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 398.4952290000001,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 20.89178600000014,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 41.17340400000103,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 18.609318999999232,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 27.019225000000006,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 965.2761890000038,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1194.4969370000035,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9172120000002906,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.4471359999988636,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 10.235469999999623,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 11.839055000000371,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 8.137632000000849,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 15.647106999999778,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 8.799947999999858,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 11.625976000001174,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 9.73091999999997,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 27.366770999999062,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 29.6782230000008,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 60.65966900000058,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.131882000000587,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 3.9903320000003077,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 3.5292970000000423,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 5.6613040000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 8541.406436000005,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 9192.944255000002,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.415404999999737,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.012543999997433,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 39.494604999999865,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 66.47484099999929,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 34.037475999997696,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 51.7018100000023,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 24.682705999999598,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 42.568083999998635,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 24.71889999999985,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 55.570417000002635,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
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
          "id": "792f464de2f8fd3f484b1769f4b20680f32103a3",
          "message": "[release] Merge pull request #139 from PrivateGER/claude/group-display-perf-b1nqpl\n\nFix query plans for group creator filter and notes search",
          "timestamp": "2026-06-22T15:20:23+02:00",
          "tree_id": "6253c956629dc2f239e4022b496f06bcaa0ceb62",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/792f464de2f8fd3f484b1769f4b20680f32103a3"
        },
        "date": 1782134585510,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 135.7151819999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 211.7547169999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 202.81560700000045,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 292.85372899999857,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 471.4436310000019,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 643.4365200000029,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.19477200000256,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 55.96088800000143,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 27.22997799999939,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 61.71839699999691,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 63.12406699999701,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1938.5260190000045,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9242700000013429,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 1.7182759999996051,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.083051999999952,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 23.965798999999606,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 11.666393000001335,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 22.672033999999258,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.101529000001392,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 25.610576999999466,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 10.957499999998618,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 22.135833000000275,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 42.31681699999899,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 81.9737839999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.8467079999991256,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 3.685789000001023,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.159528000000137,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 11.901166999999987,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 10907.109478999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12158.561667000002,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.4038369999980205,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 8.110758999999234,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 53.034303000000364,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 97.70064600000114,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 44.27393200000006,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 82.66871299999912,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.167396000000736,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 51.31710000000021,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 33.34519499999806,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 62.0073160000029,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "792f464de2f8fd3f484b1769f4b20680f32103a3",
          "message": "[release] Merge pull request #139 from PrivateGER/claude/group-display-perf-b1nqpl\n\nFix query plans for group creator filter and notes search",
          "timestamp": "2026-06-22T13:20:23Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/792f464de2f8fd3f484b1769f4b20680f32103a3"
        },
        "date": 1782189910514,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 138.66693599999962,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 238.03181700000096,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 186.49241699999766,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 268.97824000000037,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 356.84079900000506,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 420.3163809999969,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 31.41545099999712,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 50.002777999998216,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 24.949499999998807,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 73.2970069999974,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 55.86430400000245,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2045.4873880000014,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.8624270000000251,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.312144999999873,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 20.23602700000083,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 31.00898799999959,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.645591999998942,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 17.41513599999962,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 10.55794799999967,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 29.4574190000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.15434600000117,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 30.38922300000013,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 39.27858799999922,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 74.22599300000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.014182000000801,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 6.387628000000404,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.900508999999147,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 12.431040999999823,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11582.346398999995,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12438.648938999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.657633999999234,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 9.424192999998922,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 56.87170699999842,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 94.48740499999985,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 42.43384999999762,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 96.9380999999994,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 30.17078400000173,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 49.82039000000077,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.402328000000125,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 58.638795999999274,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
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
          "id": "d573051b1ef681d66f69d1fe7f322bdecad17228",
          "message": "[release] Merge pull request #140 from PrivateGER/claude/group-page-author-filter-bbe4j1\n\nFix groups page random-order navigation with seed handling",
          "timestamp": "2026-06-24T01:54:46+02:00",
          "tree_id": "fab699341c5d1c361b4d1d170f1e4c1733f9b008",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/d573051b1ef681d66f69d1fe7f322bdecad17228"
        },
        "date": 1782259068286,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 171.60520200000065,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 371.67581699999937,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 421.71385700000246,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 650.1536909999995,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 851.6449890000004,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 1132.5303759999952,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 30.284192999999505,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 60.68996899999911,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 24.665611999997054,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 55.17277000000104,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 77.13412200000312,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1826.9608599999992,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9216570000007778,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.1485539999994216,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.694158000000243,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 36.04149200000029,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.905666999999085,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 23.814540000001216,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 13.010388000000603,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 28.9151839999995,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.779280000000654,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 23.303674999999203,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 42.222625000002154,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 68.68184800000017,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.8610680000001594,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 3.781543999999485,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.407191000000239,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 11.621687000000748,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11898.925448000002,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12870.767412000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.274655000001076,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.501613000000361,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 48.217947000001004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 116.3344999999972,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 49.892588999999134,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 75.15098399999988,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.85444799999823,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 51.9527820000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.64737900000182,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 57.952015999999276,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "d573051b1ef681d66f69d1fe7f322bdecad17228",
          "message": "[release] Merge pull request #140 from PrivateGER/claude/group-page-author-filter-bbe4j1\n\nFix groups page random-order navigation with seed handling",
          "timestamp": "2026-06-23T23:54:46Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/d573051b1ef681d66f69d1fe7f322bdecad17228"
        },
        "date": 1782362802466,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 158.71968500000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 251.80063800000062,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 227.67405000000144,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 311.57907200000045,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 437.1477279999963,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 568.7000889999981,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.366711000002397,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 49.38114400000268,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 22.18727399999989,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 54.52989299999899,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 1177.5210179999995,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1751.239542999996,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.5566450000005716,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 5.055803999999625,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 13.647962999999436,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 26.034826999999495,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.971928000000844,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 18.33727799999906,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 10.998255999998946,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 33.3682000000008,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 10.304754000000685,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 22.30799300000035,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 42.346568999997544,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 85.22134499999993,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.111618000000817,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.704761999999391,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.5790909999996074,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.35295700000097,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11263.796796000002,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12770.287960000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.823589000003267,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.319405000002007,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 52.50137800000084,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 78.20507600000201,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 43.99133100000108,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 79.21943200000169,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 30.930318000002444,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 61.54775300000256,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 29.813460999997915,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 49.329413999999815,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "d573051b1ef681d66f69d1fe7f322bdecad17228",
          "message": "[release] Merge pull request #140 from PrivateGER/claude/group-page-author-filter-bbe4j1\n\nFix groups page random-order navigation with seed handling",
          "timestamp": "2026-06-23T23:54:46Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/d573051b1ef681d66f69d1fe7f322bdecad17228"
        },
        "date": 1782449326887,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 130.6115379999992,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 175.47482900000068,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 215.29557099999874,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 289.65274999999747,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 392.8167519999988,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 486.0151489999989,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.58191000000079,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 46.72660899999755,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 26.883427000000665,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 59.38652100000036,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 1229.6489460000012,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1733.1934949999995,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.940694999999323,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.4292789999999513,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 13.55175699999927,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 53.71194300000025,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.414708000000246,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 22.359537000000273,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 10.681448000001183,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 17.04108499999893,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.95126799999889,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 28.64004399999976,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 39.77250599999934,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 68.34157499999856,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.6213620000016817,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 4.172865999998976,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.682482000000164,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 9.739928000000873,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11407.586816000003,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12291.021260000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.8047409999999218,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 9.814287000001059,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 50.90240300000005,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 88.44951500000025,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 46.09158299999763,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 74.28663299999971,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 32.18632699999944,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 68.18775499999902,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 29.75237399999969,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 84.9374719999978,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "d573051b1ef681d66f69d1fe7f322bdecad17228",
          "message": "[release] Merge pull request #140 from PrivateGER/claude/group-page-author-filter-bbe4j1\n\nFix groups page random-order navigation with seed handling",
          "timestamp": "2026-06-23T23:54:46Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/d573051b1ef681d66f69d1fe7f322bdecad17228"
        },
        "date": 1782622427533,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 132.7937320000001,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 213.74399999999878,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 277.4671390000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 646.2066959999975,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 781.3472839999959,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 913.9413599999971,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.5997040000002,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 50.09057899999971,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 22.564227000002575,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 57.89047399999981,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 64.22648700000718,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1687.724012999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0086599999995087,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.6441909999994095,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 13.777706000000762,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 28.61411600000065,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 11.305035999999745,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 23.581977999998344,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.669497000000774,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 28.664966999998796,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.632462999999916,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 30.850244000001112,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 42.26282600000195,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 86.96651600000041,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.053658999999243,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 8.607209000001603,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.595846000000165,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 11.115723000000798,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 11921.757322999998,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 12706.310657,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.431699999997363,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.826006999999663,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 50.82970000000205,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 86.39903300000151,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 42.7274639999996,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 76.76688600000125,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.15870200000063,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 61.60972799999945,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 29.983875999998418,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 58.62475899999845,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
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
          "id": "78bd6e5f7f2c2883989046c4f70c2b99342501bc",
          "message": "Merge pull request #141 from PrivateGER/fix/tag-sidebar-page-flow\n\nfix(post): let tag sidebar flow with the page",
          "timestamp": "2026-07-01T12:54:04+02:00",
          "tree_id": "4e60e04a3b7487049a81edf07c7beab5edb388c5",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/78bd6e5f7f2c2883989046c4f70c2b99342501bc"
        },
        "date": 1782903430708,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 158.30164700000023,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 272.38202900000033,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 378.2375810000012,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 608.7558610000051,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 755.6643560000011,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 874.1153740000009,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 31.373262000000977,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 65.3587609999995,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 28.1725800000022,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 52.25030500000139,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 49.37802199998987,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2012.7311760000011,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.8837340000009135,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.8839850000003935,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 17.387214000000313,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 31.387932999999975,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.844912000000477,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 14.737959999998566,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 14.312668999999005,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 29.843587999999727,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 13.678122000001167,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 31.238407999999254,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 47.91255000000092,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 98.2966919999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.3757059999988996,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.298444000000018,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 6.576284999999189,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 11.511719999998604,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 13495.539179,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 14201.252654,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 5.452924000001076,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 9.2631650000003,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 58.22246499999892,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 102.85335400000258,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 48.891178999998374,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 86.96732999999949,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 34.106933999999455,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 64.89707099999941,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 36.298634999999194,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 56.15921000000162,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
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
          "id": "1007532c8c46e58c0a7739553afbe2ad43359a07",
          "message": "[release] Merge pull request #142 from PrivateGER/claude/semantic-search-existing-images-1oyfh6\n\nAdd post-based semantic search using existing embeddings",
          "timestamp": "2026-07-01T12:54:45+02:00",
          "tree_id": "79c06de8391578fd3d1b1176bac32e3a0d27e7a4",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1007532c8c46e58c0a7739553afbe2ad43359a07"
        },
        "date": 1782903465177,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 146.5188739999994,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 270.01024999999936,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 297.71074000000226,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 450.28380099999777,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 598.6448610000007,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 789.5887470000016,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 31.896992999998474,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 61.86542299999928,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 27.856696999999258,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 60.445152999996935,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 74.68575400000555,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1967.9937019999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.047853000000032,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 4.393763000000035,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.61266599999908,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 31.02157100000113,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 12.773917000000438,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 40.02685600000041,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.855600000000777,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 41.39934899999935,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.914980999999898,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 29.08893999999964,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 41.45260899999994,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 77.78429099999994,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.948324999999386,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 4.777712999999494,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.973494000001665,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 17.03443100000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 12234.075479,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 13362.466820999998,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.8412459999999555,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.94603300000017,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 56.50066499999957,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 99.1593670000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 47.18239900000117,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 86.27296299999944,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 34.85797299999831,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 61.342602000000625,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.72372600000017,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 54.0511529999967,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "1007532c8c46e58c0a7739553afbe2ad43359a07",
          "message": "[release] Merge pull request #142 from PrivateGER/claude/semantic-search-existing-images-1oyfh6\n\nAdd post-based semantic search using existing embeddings",
          "timestamp": "2026-07-01T10:54:45Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1007532c8c46e58c0a7739553afbe2ad43359a07"
        },
        "date": 1782967513683,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 113.27200999999877,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 170.39245200000005,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 228.0932840000023,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 344.9180840000008,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 616.4865189999982,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 695.699222999996,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 31.909810000001016,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 64.20217699999921,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 31.202298000000155,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 65.38123600000108,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 56.202707999997074,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2081.9664179999963,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9232439999996132,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 1.9471670000002632,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.4212639999987,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 41.53638400000091,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 6.82003099999929,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 11.95802299999923,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.884146000000328,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 20.96366300000045,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.076764999999796,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 29.310104000000138,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 41.373192999999446,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 95.48142899999948,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.9764520000007906,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 4.520472000000154,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.842837999998665,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 10.76691700000083,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 12456.813218000003,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 13573.353108000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 5.064995000000636,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 10.892171999999846,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 56.43269499999951,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 119.56158099999811,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 46.73937599999772,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 80.85700999999972,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 36.91500299999825,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 71.23520199999984,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 37.351322999998956,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 89.15566000000035,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "8256e2a0afd2851277366b8f0486bc488edc8f4a",
          "message": "[release] Merge pull request #143 from PrivateGER/perf/sync-memory\n\nperf: reduce sync memory usage and speed up groups filtering",
          "timestamp": "2026-07-02T16:06:41Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/8256e2a0afd2851277366b8f0486bc488edc8f4a"
        },
        "date": 1783061177855,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 21.497670999997354,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 39.706075000001874,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 29.13575999999739,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 89.3425410000018,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 30.256657999998424,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 56.04534599999897,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 29.178492999999435,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 37.11595500000112,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 60.14545999999973,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 86.47441799999797,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 25.441115000001446,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 33.29225900000165,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 158.3780139999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 232.74296099999992,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 263.8188960000007,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 382.59473499999876,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 534.5050279999996,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 661.2502789999999,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 23.6742099999974,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 41.789316999998846,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 20.70107300000018,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 31.86854200000016,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 1217.9011539999992,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1812.8472249999977,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9416129999990517,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.5205580000001646,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 12.856303999999,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 27.003226000000723,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.111998000000312,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 35.83932400000049,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.279313000000911,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 25.196617999999944,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.142179999998916,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 26.242205000000467,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 43.019970000001194,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 84.77726200000325,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.7295070000000123,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.3771729999989475,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.975368999999773,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 11.683940999999322,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 6469.648607000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 6639.185344,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.812009000001126,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.774911000000429,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 46.766239000000496,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 95.54808000000048,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 39.31889299999966,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 61.95981500000198,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 28.40358600000036,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 56.52879100000064,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 26.54670299999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 56.601073999998334,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          }
        ]
      }
    ],
    "API benchmarks (large)": [
      {
        "commit": {
          "author": {
            "name": "Latte macchiato",
            "username": "PrivateGER",
            "email": "privateger@privateger.me"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "d573051b1ef681d66f69d1fe7f322bdecad17228",
          "message": "[release] Merge pull request #140 from PrivateGER/claude/group-page-author-filter-bbe4j1\n\nFix groups page random-order navigation with seed handling",
          "timestamp": "2026-06-23T23:54:46Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/d573051b1ef681d66f69d1fe7f322bdecad17228"
        },
        "date": 1782626539542,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Notes search (common word) (p50)",
            "value": 154.946391999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 224.8262010000035,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 269.4558969999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 351.3150009999954,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 485.55316499999753,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 589.585576999998,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Single tag search (p50)",
            "value": 108.39352299999882,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Single tag search (p95)",
            "value": 143.10867100000178,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 146.77313100000174,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 166.38659799999732,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 477.3686799999996,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 525.4686799999981,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.6206579999998212,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 0.7659199999980046,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 94.19748700000127,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 121.24617800000124,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 84.15870200000063,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 119.03812199999811,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 55.257386999997834,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 59.928115000002435,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 55.355579999995825,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 61.45646700000361,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 801.9626509999944,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 850.9449800000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 7.444179999998596,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 9.484637000001385,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 17.67335599999933,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 20.93069100000139,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 5680.785212999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=large"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 6584.827868,
            "unit": "ms",
            "extra": "3 iterations; dataset=large"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 7.076616999998805,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 9.025852999999188,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 1009.7359010000073,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 1101.6878290000022,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 355.64569800000754,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 374.68361500000174,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 147.29515900000115,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 164.71663599999738,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 120.8435610000015,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 131.79731500000344,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          }
        ]
      }
    ]
  }
}