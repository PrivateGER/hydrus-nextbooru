window.BENCHMARK_DATA = {
  "lastUpdate": 1781240352676,
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
      }
    ]
  }
}