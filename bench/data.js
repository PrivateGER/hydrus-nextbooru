window.BENCHMARK_DATA = {
  "lastUpdate": 1784505321891,
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
          "id": "8cf74f76f567f4db59462d27da3c55d4dbdd6502",
          "message": "[release] Merge pull request #144 from PrivateGER/feat/favorites-feed\n\nfeat: favorites and taste-based recommendation feed",
          "timestamp": "2026-07-04T01:33:45+02:00",
          "tree_id": "8244acdaba7673d60e672e74e7f7076eb8a4fed8",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/8cf74f76f567f4db59462d27da3c55d4dbdd6502"
        },
        "date": 1783121776195,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 28.247433000000456,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 44.320770999998786,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 29.304887000002054,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 36.81948599999669,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 32.88881200000105,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 56.89387899999929,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 28.833864000000176,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 41.403565000000526,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 54.002683999999135,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 81.37434600000051,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 30.13145599999916,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 47.189916999999696,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 143.40770800000246,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 202.48117699999784,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 186.302843999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 256.96041700000205,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 346.2615519999963,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 400.3325939999995,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 24.123352000002342,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 47.97819399999935,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 23.688093000000663,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 79.45394800000213,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 64.10826000000816,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2072.8956330000074,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.905296000000817,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.9699749999999767,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.053485999998884,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 24.82122899999922,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.54458700000032,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 16.66096800000014,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.837712000000465,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 24.18952900000113,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.749620000000505,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 22.93609800000013,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 42.23651900000186,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 88.49112599999717,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.9680409999982658,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 11.06865099999959,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.832514999998239,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 5.882192000000941,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 6807.693735000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 7063.751643,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.150786000001972,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.505723000002035,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 49.20235700000194,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 83.51137000000017,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 43.25608600000123,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 85.57529499999873,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 29.700981999998476,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 60.41872299999886,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 27.90689999999813,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 69.88563799999974,
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
          "id": "432cb1558aebfe7617105c56ddc6b73af632c4ef",
          "message": "Merge pull request #145 from PrivateGER/feat/favorites-feed\n\nfeat(feed): widen and age-stratify older-seed sampling",
          "timestamp": "2026-07-04T03:37:00+02:00",
          "tree_id": "6cd2d560f1ada5c32acf2c522180c1a90b4b963b",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/432cb1558aebfe7617105c56ddc6b73af632c4ef"
        },
        "date": 1783129208041,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 23.973880000001373,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 31.784724999997707,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 30.72742400000061,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 44.05728300000192,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 30.855772999999317,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 59.63583199999994,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 28.88033500000165,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 47.048109999999724,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 57.93923700000232,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 67.21389499999714,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 30.015282000000298,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 49.30614500000229,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 149.95406899999944,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 244.71336099999826,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 470.64443299999766,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 670.0385089999982,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 964.4514509999935,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 1309.7365500000014,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 26.30570400000215,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 41.62936600000103,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 22.45535600000221,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 55.34515499999907,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 67.07093200000236,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1838.0871409999963,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9855649999990419,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.04473599999983,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.415422000000035,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 57.50873499999943,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 11.679059000000052,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 19.454733000000488,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.72799699999996,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 24.03798900000038,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 13.583260000001246,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 37.306453999999576,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 46.94023600000219,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 84.07431400000132,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.3713390000011714,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 8.970918000000893,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.335419999999431,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 9.199545999999827,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7143.9632679999995,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 7255.279807999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.070432000000437,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.970164999998815,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 48.41761300000144,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 74.54468199999974,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 43.045797999999195,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 62.143816000003426,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 28.909730999999738,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 55.93785999999818,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 27.53627200000119,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 42.157098000003316,
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
          "id": "432cb1558aebfe7617105c56ddc6b73af632c4ef",
          "message": "Merge pull request #145 from PrivateGER/feat/favorites-feed\n\nfeat(feed): widen and age-stratify older-seed sampling",
          "timestamp": "2026-07-04T01:37:00Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/432cb1558aebfe7617105c56ddc6b73af632c4ef"
        },
        "date": 1783146722224,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 16.41633400000137,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 29.880496000001585,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 23.158079000000726,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 32.09076900000218,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 23.4086479999969,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 31.424333999999362,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 18.279021999998804,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 27.5566370000015,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 47.16932599999927,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 57.07797700000083,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 20.97182199999952,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 26.188077999999223,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 128.5076880000015,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 187.9844439999997,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 253.52088100000037,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 358.0780330000016,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 514.9661810000034,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 713.506229000006,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 17.891311999999743,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 31.292936000001646,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 15.076457000002847,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 42.12083200000052,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 950.8841360000006,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1279.623096999996,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.7809880000004341,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.447721000000456,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 10.955683000000136,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 18.704799000001003,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 9.471075999999812,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 18.305562999999893,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 9.148862000000008,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 19.026291999998648,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 9.951723000000129,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 18.249241000001348,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 32.04742299999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 63.87597999999889,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.215159000001222,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 3.5823190000010072,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 3.662580000000162,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 4.851612000000387,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 5327.640809999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 5338.527611000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.018111000001227,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 5.803265999998985,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 35.15718199999901,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 51.83689500000037,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 31.71367100000134,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 61.54370399999971,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 21.90813899999921,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 44.27309500000047,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 21.128372999999556,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 39.42021100000056,
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
          "id": "432cb1558aebfe7617105c56ddc6b73af632c4ef",
          "message": "Merge pull request #145 from PrivateGER/feat/favorites-feed\n\nfeat(feed): widen and age-stratify older-seed sampling",
          "timestamp": "2026-07-04T01:37:00Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/432cb1558aebfe7617105c56ddc6b73af632c4ef"
        },
        "date": 1783234458846,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 27.47156100000211,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 69.273459,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 35.10679600000003,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 53.803672000001825,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 36.7458280000028,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 47.112982999999076,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 27.9371089999986,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 39.125661999998556,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 63.00127699999939,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 84.28263499999957,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 34.11564200000066,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 42.07008399999904,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 135.10139499999786,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 219.17306499999904,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 242.87278800000058,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 406.6095239999959,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 435.1909039999955,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 549.7261940000026,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 26.999370999998064,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 45.87731700000222,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 28.804222999999183,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 53.862294999998994,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 57.7103999999963,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2040.3935239999992,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.4429120000004332,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 6.012711999999738,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 16.992120999999315,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 25.49737400000049,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 9.50438799999938,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 21.08540499999981,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 13.8531380000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 23.1186519999992,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 14.097921999997197,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 35.441053000000466,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 45.42510499999844,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 95.32837899999868,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.986457999999402,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 3.722326000000976,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.577933000000485,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 12.35359100000096,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7538.7663569999995,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 7789.422909999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.36875499999951,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.140290999999706,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 49.822728999999526,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 73.77133999999933,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 40.31625200000053,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 89.03209900000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 32.913981999998214,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 73.42403299999933,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.195565000001807,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 69.30492700000104,
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
          "id": "432cb1558aebfe7617105c56ddc6b73af632c4ef",
          "message": "Merge pull request #145 from PrivateGER/feat/favorites-feed\n\nfeat(feed): widen and age-stratify older-seed sampling",
          "timestamp": "2026-07-04T01:37:00Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/432cb1558aebfe7617105c56ddc6b73af632c4ef"
        },
        "date": 1783324778123,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 28.792881000001216,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 37.30671699999948,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 33.03091100000165,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 41.324735000001965,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 35.82630600000266,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 46.72769699999844,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 32.070606000001135,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 40.15622000000076,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 65.83777299999929,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 108.80565999999817,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 27.013771000001725,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 43.50929499999984,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 182.47657099999924,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 277.56405799999993,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 415.1687340000026,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 556.024341999997,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 716.5920009999973,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 927.4243690000003,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 30.57806300000084,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 64.14846600000237,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 26.339026000001468,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 41.06434900000022,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 62.55096800001047,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2099.518732999997,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0802910000002157,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.31851800000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 19.770680999999968,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 37.67264500000056,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 8.571607999998378,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 12.039307000000917,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 13.286231000000043,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 22.797850000000835,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 13.415163000001485,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 33.80868300000293,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 46.27778699999908,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 91.88857800000187,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.2853070000001026,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 4.124797999998918,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.8918849999990925,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 7.114322999999786,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7142.808955,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 7481.5159619999995,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.514069000000745,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 9.003744000001461,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 51.19237599999906,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 85.17341500000111,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 42.7793700000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 66.80059999999867,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.822353000003204,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 52.43905999999697,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 31.575650000002497,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 49.57525899999746,
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
          "id": "08f6124c068284d4894285cf715a0369566ebee0",
          "message": "[release] Merge pull request #146 from PrivateGER/feat/ocr-text-overlay\n\nfeat(ocr): add positioned text overlay and typeset mode",
          "timestamp": "2026-07-06T10:30:43+02:00",
          "tree_id": "7edb9cc519923ef71263acbd85e25db3d9e4559e",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/08f6124c068284d4894285cf715a0369566ebee0"
        },
        "date": 1783326806000,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 24.417930999999953,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 34.08353499999794,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 32.210916,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 46.437206000002334,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 30.7104139999974,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 41.07513000000108,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 29.87395800000013,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 53.96155600000202,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 55.17130199999883,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 83.89110699999947,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 29.590667999997095,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 44.243138000001636,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 130.1285519999983,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 213.63059399999838,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 191.79604499999914,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 265.3022170000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 346.31909799999994,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 433.99352799999906,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 25.81609799999933,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 44.676634000003105,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 25.83230900000126,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 61.892643999999564,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 82.71026100000017,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2059.3018759999977,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9867149999990943,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.4171580000001995,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 14.800618999999642,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 23.201038999999582,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 9.840806000000157,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 17.910391999999774,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.82076600000073,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 24.598371000000043,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.150794000001042,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 22.641093000000183,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 42.76909800000067,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 91.44992400000046,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.9469390000012936,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 6.435680000000502,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.976932999999917,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 7.050349000001006,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 6718.132379000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 7009.540247,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.446703999998135,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.6392740000010235,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 49.70771800000148,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 78.88090700000248,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 41.30439599999954,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 93.62350300000253,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 30.556423999998515,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 70.5228790000001,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 27.83342300000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 73.67838699999993,
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
          "id": "ebb57336888f0caddf3944daa53474c850201a2f",
          "message": "[release] Merge pull request #148 from PrivateGER/fix/ocr-batch-inpaint-and-stale-lock\n\nfix(ocr): batch inpaint lifecycle + stale-lock recovery, then consolidate typeset to full-page inpaint",
          "timestamp": "2026-07-07T02:30:33+02:00",
          "tree_id": "32bd322fb0ed0269c4c69bded8d0d410aa17f856",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/ebb57336888f0caddf3944daa53474c850201a2f"
        },
        "date": 1783384415152,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 30.230359999997745,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 56.18822200000068,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 35.79431100000147,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 47.017053999999916,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 34.37100800000189,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 45.254046999998536,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 29.52936200000113,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 35.86704599999939,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 61.936008000000584,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 79.90010499999698,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 31.808011000000988,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 45.42826100000093,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 135.26704900000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 229.3130060000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 329.19926399999895,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 498.7005549999958,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 576.3583010000002,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 749.9194629999984,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 28.58324900000298,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 52.55478700000094,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 28.675880999999208,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 41.0946440000007,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 68.13836199999787,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2124.807353000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.1179540000011912,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.338659999999436,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 16.13218500000039,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 29.883402000001297,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 7.209881000000678,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 14.01234299999851,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.906801999999516,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 28.56217800000013,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.450231000000713,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 24.068811999999525,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 44.119652000001224,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 86.03114699999787,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.2362429999993765,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 4.205650000001697,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.742745999999897,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 6.821587999998883,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7329.537272,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 7778.762145000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.27721400000155,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 8.29291000000012,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 51.74640999999974,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 74.34041200000138,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 44.07139299999835,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 74.4368719999984,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 32.98797100000229,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 74.28306900000098,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.882054000001517,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 56.801776999996946,
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
          "id": "6cc45a97d9bf1c238a1c2155a44059018004ded6",
          "message": "[release] Merge pull request #149 from PrivateGER/fix/ocr-batch-inpaint-and-stale-lock\n\nfix(ocr): observe force-reset in a running batch; poll active batch on mount",
          "timestamp": "2026-07-07T02:38:15+02:00",
          "tree_id": "e5d2aec104a22c7bc7a6001ce2850382f569e6da",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/6cc45a97d9bf1c238a1c2155a44059018004ded6"
        },
        "date": 1783384841373,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 25.255975000000035,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 38.32417700000224,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 33.25411600000007,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 41.91257300000143,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 31.573331999999937,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 49.598172000001796,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 27.7738849999987,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 35.19017099999837,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 59.028033999999025,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 94.28191999999763,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 25.747385999999096,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 38.3306819999998,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 145.94184799999857,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 203.802760999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 172.8482409999997,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 239.68565500000113,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 311.18590499999846,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 360.12259800000174,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 28.643302000000403,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 48.90901099999974,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 29.29672700000083,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 70.6118009999991,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 76.05531599999813,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2059.4471520000006,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9469519999984186,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.623380000000907,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.226918000000296,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 49.82433100000162,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 8.901340000000346,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 12.475719999998546,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 10.611299999998664,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 47.46280400000069,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 10.165070000000924,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 26.56799200000023,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 36.735318000000916,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 66.63221400000111,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.114735000001019,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 7.936059999999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.46395499999926,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.313765999999305,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7016.274418,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 7066.506263999998,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.9189600000026985,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 10.48703199999727,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 49.00295499999993,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 62.972531999999774,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 41.99036999999953,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 59.054181999999855,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.500476999997773,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 55.85242600000129,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 29.273293999998714,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 53.74604199999885,
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
          "id": "6cc45a97d9bf1c238a1c2155a44059018004ded6",
          "message": "[release] Merge pull request #149 from PrivateGER/fix/ocr-batch-inpaint-and-stale-lock\n\nfix(ocr): observe force-reset in a running batch; poll active batch on mount",
          "timestamp": "2026-07-07T00:38:15Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/6cc45a97d9bf1c238a1c2155a44059018004ded6"
        },
        "date": 1783407584080,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 26.524981999999,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 46.998099000000366,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 28.230591999999888,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 42.66907600000195,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 30.307968999997684,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 40.09891900000002,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 25.866750000001048,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 47.40491100000145,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 59.061375999997836,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 100.31876600000032,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 31.655213999998523,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 50.216388999997434,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 146.77227799999855,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 249.8953849999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 199.64224000000104,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 280.735391000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 464.64874899999995,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 540.514353999999,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 20.89912700000059,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 50.62319900000148,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 25.41725099999894,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 63.300671999997576,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 67.89792000000307,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1938.0886279999977,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.290843999999197,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.8978279999992083,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 14.881813999998485,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 20.42670100000032,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 12.149986000000354,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 20.068011000001206,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.954524000000674,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 28.04755599999953,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 10.986914999999499,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 15.19149599999946,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 39.69349200000215,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 75.1428479999995,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.9261719999994966,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 4.034403999999995,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.193070999999691,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 7.144739999999729,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 6850.140760999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 7003.553918,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.6141069999976025,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 12.47644599999694,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 47.865843999999925,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 100.88184699999692,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 41.43467999999848,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 66.68048400000043,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 32.951008,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 91.37350899999728,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 32.81322900000305,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 52.5316559999992,
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
          "id": "170f2782ef0e80761f47cef8b8080a8229a9b26b",
          "message": "[release] Merge pull request #151 from PrivateGER/fix/ocr-no-text-pages-marked-failed\n\nfix(ocr): treat sidecar no-text pages as empty scans, not failures",
          "timestamp": "2026-07-07T14:54:24+02:00",
          "tree_id": "a0b209143fa350da99354d5fcd1f7e2a6136e510",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/170f2782ef0e80761f47cef8b8080a8229a9b26b"
        },
        "date": 1783429032833,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 25.37376900000163,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 48.19966299999942,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 29.404041000001598,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 46.12182199999734,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 33.465775000000576,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 47.9898609999982,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 28.141621999999188,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 49.842962999999145,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 63.49581300000136,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 90.00449300000037,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 24.825795000000653,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 51.33517500000016,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 137.13312399999995,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 183.35064499999862,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 182.2573420000008,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 304.9085989999985,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 404.82017300000007,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 511.94992600000114,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 24.580269000001863,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 45.76109799999904,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 21.22778500000277,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 39.98196900000039,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 85.04509700000926,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2045.0060680000024,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0419069999989006,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.4721890000000712,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 16.311240000000907,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 23.12820500000089,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 9.128276999999798,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 12.938492999999653,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.62383299999965,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 34.91788499999893,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.321737000000212,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 25.126263999998628,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 40.90022999999928,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 75.01412300000084,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.0660470000002533,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 6.748906999999235,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 6.286362999999255,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 11.139428000000407,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7111.839467,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 7446.01642,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.273623999997653,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.805793999999878,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 50.42456199999651,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 92.09018600000127,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 41.914528999997856,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 73.3082030000005,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 33.18239700000049,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 74.45469799999773,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.139211999998224,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 68.09927999999854,
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
          "id": "e87129e5c56e44e7308eb499a80a05533f201315",
          "message": "[release] Merge pull request #152 from PrivateGER/perf/for-you-feed-optimization\n\nperf: optimize the \"For You\" feed (per-bucket cache + tag-distinctiveness floor)",
          "timestamp": "2026-07-07T17:26:59+02:00",
          "tree_id": "dc5b3dcdd412aaf3097febd9b9916135ece18205",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/e87129e5c56e44e7308eb499a80a05533f201315"
        },
        "date": 1783438201737,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 25.15080300000045,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 32.45160499999838,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 34.725500000000466,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 41.14777899999899,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 33.92891099999906,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 46.050796999999875,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 27.921974999997474,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 32.450871000000916,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 62.644138999999996,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 93.01805900000181,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 25.10775199999989,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 40.46533100000306,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 125.6623729999992,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 190.20374100000117,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 313.2297690000014,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 527.1740549999959,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 640.8462070000023,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 743.3888480000023,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.78643799999918,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 46.60570299999745,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 27.765322999999626,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 60.020637999998144,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 69.43582900000911,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2145.102104000005,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9671950000010838,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.1722109999991517,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 17.304190999999264,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 26.525345999998535,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 5.577669000000242,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 9.11810399999922,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.902806999998575,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 23.896801999999298,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.213851000000432,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 22.78283399999782,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 47.42709100000138,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 110.29475500000262,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.1685529999995197,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 3.916129000001092,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.8409800000008545,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 10.03678199999922,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 8552.141705999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 9274.12758,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.602722999999969,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.872079000000667,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 52.06250200000068,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 75.95590599999923,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 42.563859000001685,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 96.02633200000128,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 32.35026199999993,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 74.48864700000195,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.069154000000708,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 69.2558199999985,
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
          "id": "5f2b72ca8d955360cbdc9411d1696937d8989345",
          "message": "Merge pull request #153 from PrivateGER/claude/recommendation-algorithm-analysis-z0vuec\n\nFix feed ranking: cosine-normalize tag similarity and collapse multi-page seeds",
          "timestamp": "2026-07-08T07:40:13+02:00",
          "tree_id": "1cc5b40c1cfe70c76063285d5a8d2e7963966b0c",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/5f2b72ca8d955360cbdc9411d1696937d8989345"
        },
        "date": 1783489402261,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 21.819290999999794,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 43.60625000000073,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 28.0409980000004,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 58.20331400000214,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 34.1162379999987,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 48.93410799999765,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 29.603273000000627,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 40.28972100000101,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 59.277319000000716,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 68.8141429999996,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 26.36456900000121,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 36.87635500000033,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 140.36967100000038,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 226.50337000000036,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 257.28227699999843,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 383.26210699999865,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 545.1685399999988,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 696.1154860000024,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 23.766091000001325,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 45.446915000000445,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 22.49694499999896,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 46.61002799999915,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 1193.779435999997,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1873.4720289999968,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9374530000004597,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 1.766105000000607,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 14.31462400000055,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 76.10959100000036,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 7.70692599999893,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 19.390747999999803,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.09150199999931,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 25.294154000001072,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.090861000000587,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 36.49826699999903,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 43.19879800000126,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 81.60900599999877,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.7817589999995107,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 6.890953000000081,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.798178999999436,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 5.303262999999788,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 8275.642909000002,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8607.045054,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.849045999999362,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 8.920423999999912,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 46.84346700000242,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 66.4469140000001,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 43.73097599999892,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 82.636348,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 30.13776499999949,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 64.42283799999859,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 25.994323000002623,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 53.404374999998254,
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
          "id": "5f2b72ca8d955360cbdc9411d1696937d8989345",
          "message": "Merge pull request #153 from PrivateGER/claude/recommendation-algorithm-analysis-z0vuec\n\nFix feed ranking: cosine-normalize tag similarity and collapse multi-page seeds",
          "timestamp": "2026-07-08T05:40:13Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/5f2b72ca8d955360cbdc9411d1696937d8989345"
        },
        "date": 1783491037806,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 27.988044000001537,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 35.64122900000075,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 34.00960699999996,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 44.73888699999952,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 34.95290000000023,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 51.55272999999943,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 32.09593500000119,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 40.31311799999821,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 65.1266629999991,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 106.42396100000042,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 29.564570999998978,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 42.251351999999315,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 127.79899599999953,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 213.79351000000315,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 213.05180699999983,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 305.81944099999964,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 446.786509000005,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 613.5402400000021,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 26.300656999999774,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 44.31568799999877,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 23.676791000001685,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 57.72777000000133,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 59.787197000012384,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2158.0836899999995,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0890959999996994,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.143738000000667,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 16.96844499999861,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 36.09959499999968,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 4.87352699999974,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 9.892828000000009,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.868164000001343,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 19.275359999999637,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.49289300000055,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 36.740820000000895,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 45.86158400000204,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 76.59456299999874,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.0079270000005636,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.088610000000699,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.444416000000274,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 11.510255000001052,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 8938.928262000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8969.954233,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.433422999998584,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.252866999999242,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 49.53419600000052,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 85.56306499999846,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 50.907789000000776,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 98.80598700000337,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 30.33269300000029,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 61.40114800000083,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 31.572390000001178,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 67.02228299999842,
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
          "id": "5ebda9a9125e08a0b34c6f565643661a733b1a10",
          "message": "[release] Merge pull request #154 from PrivateGER/feat/feed-recommendations-v2\n\nperf(feed): two-phase tag similarity, batched kNN, drift-gated cache + ranking fixes",
          "timestamp": "2026-07-08T14:30:39+02:00",
          "tree_id": "36a021e343e126d79ead163d22df34b27777cff7",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/5ebda9a9125e08a0b34c6f565643661a733b1a10"
        },
        "date": 1783514017013,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 24.30615399999806,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 33.95783500000107,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 33.10071699999753,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 39.40065500000128,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 31.436781000000337,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 56.14556799999991,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 25.704499999999825,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 31.786004000001412,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 63.08107199999722,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 85.00328100000115,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 29.498513000002276,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 46.71147700000074,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 144.64231599999948,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 255.67839900000035,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 382.1362169999993,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 525.5101040000009,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 637.9189479999986,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 883.8544230000043,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 25.233260000000882,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 40.67194799999925,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 25.956601000001683,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 56.449539000001096,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 53.09421100000327,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2072.4824020000015,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9771319999999832,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.4907729999995354,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 16.56880799999999,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 28.369652999999744,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 9.764736999999514,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 17.670803000000888,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.096804000000702,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 26.21648599999935,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.812458999998853,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 15.427035999999134,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 46.55714999999873,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 83.63877100000173,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.03539500000079,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 4.819600999999238,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.707848000000013,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 11.96500500000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7916.178856,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8773.190052,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.274962999999843,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.441281999999774,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 48.39822400000048,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 81.86805300000196,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 40.61287000000084,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 69.16528599999947,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.124904000000242,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 69.82096399999864,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 28.524858999997377,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 48.367755999999645,
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
          "id": "f5010aa311b208011115343e68023188e6576c52",
          "message": "Merge pull request #155 from PrivateGER/fix/video-pause-activity-navigation\n\nfix(media-viewer): pause videos synchronously when Activity hides a route",
          "timestamp": "2026-07-08T16:18:00+02:00",
          "tree_id": "a866668b969d798c77f6f99d8808886ac9907ef4",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/f5010aa311b208011115343e68023188e6576c52"
        },
        "date": 1783520446713,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 24.74305099999765,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 36.11786700000084,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 32.87415099999998,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 45.2870359999979,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 34.32714800000031,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 48.58342300000004,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 29.447265999999217,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 44.061086999998224,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 63.10025999999925,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 108.92171199999939,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 27.257040999997116,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 34.963353000002826,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 140.83656899999914,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 207.52875499999936,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 205.3479699999989,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 277.3194629999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 363.1427580000018,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 483.9928179999988,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.131532999999763,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 46.53060999999798,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 29.787663999999495,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 68.14210699999967,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 74.03467799999635,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2156.3003339999996,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9790059999995719,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.490121000000727,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 16.020770999999513,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 26.815638999998555,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 6.295894999999291,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 17.826970000000074,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.825678000001062,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 31.641069000001153,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.375688000000082,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 21.00898700000107,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 41.95302100000117,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 109.44997599999988,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.9472590000004857,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 3.911216999998942,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.186047000001054,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.881859999999506,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7429.673607000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8405.098194,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.1677679999993416,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 9.276941000000079,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 49.652705000000424,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 75.33413799999835,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 41.80155100000047,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 66.15145399999892,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.2827380000017,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 62.66539400000329,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 29.26034300000174,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 49.88225600000078,
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
          "id": "6e1c08c6fe871a1ae10eb4b32469b4b7f6f4de7d",
          "message": "[release] Merge pull request #156 from PrivateGER/claude/groups-manga-reader-ux-hjipgz\n\nfeat(groups): manga reader mode + deterministic group navigation",
          "timestamp": "2026-07-08T22:16:50+02:00",
          "tree_id": "1fa25978ecbb4a5ac958facbdd9b8dde9f5b95a8",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/6e1c08c6fe871a1ae10eb4b32469b4b7f6f4de7d"
        },
        "date": 1783541957606,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 24.007947999998578,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 73.93241699999999,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 26.10227400000076,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 45.671142999999574,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 32.717759999999544,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 42.4181150000004,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 27.675093000001652,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 45.20639099999971,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 53.19445099999939,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 77.8501499999984,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 23.210637000000133,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 34.86548799999946,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 154.5210270000025,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 236.29668500000116,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 222.36243600000307,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 296.1922190000005,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 374.1128860000026,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 453.64814099999785,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 22.95430999999735,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 55.88015500000256,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 21.296623000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 44.29460199999812,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 70.57031599999755,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1809.927034000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.067587999999887,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.7301790000001347,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 14.229541999999128,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 38.66835499999979,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 8.036677000000054,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 22.171102000000246,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 10.562512999998944,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 19.687943999999334,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 10.932376000000659,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 21.544581000000107,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 41.167583000002196,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 97.74687400000039,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.8477920000004815,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.555710000000545,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.708864999998696,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 5.374743999998827,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7049.748508999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8024.973691,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.7155170000005455,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 5.443383999998332,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 48.118185999999696,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 94.4035109999968,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 38.496735000000626,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 73.25490200000058,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 30.00232699999833,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 59.698253999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 28.432283000001917,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 47.285455999997794,
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
          "id": "aac51572e82d7ba7261c8851987d720b52bef98e",
          "message": "[release] Merge pull request #157 from PrivateGER/claude/groups-manga-reader-ux-hjipgz\n\nfeat(nav): gallery navigation context + calmer page transitions",
          "timestamp": "2026-07-08T23:20:18+02:00",
          "tree_id": "d73fc5486664ccb12bd2983b0d7a238126af613f",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/aac51572e82d7ba7261c8851987d720b52bef98e"
        },
        "date": 1783545782191,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 23.924112999997305,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 36.358454000001075,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 30.212548999999854,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 49.58844500000123,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 32.50125599999956,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 50.23744699999952,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 30.302166000001307,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 57.50047199999972,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 62.14454100000148,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 72.97903699999733,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 29.111025000001973,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 37.114598999996815,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 150.6637609999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 240.18659599999955,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 217.5438240000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 281.41748200000075,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 409.6670430000013,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 558.0677720000022,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 25.092484000000695,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 41.19980199999918,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 29.289691000001767,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 54.11254800000097,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 61.31020599999465,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2146.8717409999954,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.5820870000006835,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 6.636196999999811,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.952790999999706,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 37.61976499999946,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 5.943632999998954,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 10.383528000000297,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.859354000000167,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 32.81498400000055,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.403127000001405,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 18.63712999999916,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 44.413040999999794,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 85.59463400000095,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.8338219999986904,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 4.786751999999979,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.057897000000594,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.505935000001045,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 6953.154396,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8547.108527,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.156072000001586,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.668510999999853,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 49.507385000000795,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 85.56681200000094,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 42.79261800000313,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 93.83700300000055,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 29.467655000000377,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 58.29411600000094,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.083683000000747,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 61.94366000000082,
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
          "id": "14fa6ea7b5f7ed1a9529c3a5a79917f62a50117c",
          "message": "[release] Merge pull request #158 from PrivateGER/claude/groups-manga-reader-ux-hjipgz\n\nfix(video): keep offscreen videos silent after navigation",
          "timestamp": "2026-07-09T00:09:41+02:00",
          "tree_id": "660927834a781454318302ca846b63ba51d0e6e2",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/14fa6ea7b5f7ed1a9529c3a5a79917f62a50117c"
        },
        "date": 1783548762656,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 24.746006999997917,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 34.00648399999773,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 31.3527780000004,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 66.82234900000185,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 31.471541999999317,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 53.65645199999926,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 25.568113999997877,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 46.842187999998714,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 60.27154399999927,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 94.96855899999719,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 28.090574000001652,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 52.121038000001136,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 144.0140019999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 254.75449800000206,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 242.67992999999842,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 346.12925299999915,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 484.6698729999989,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 602.7366660000043,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 22.249712000000727,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 49.44924600000013,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 19.362639999999374,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 61.98074999999881,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 58.53202699999383,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2216.8160960000023,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0284649999994144,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.8323789999994915,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 16.414709999999104,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 36.47414699999899,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 6.184799999999086,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 12.309777000000395,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 13.027477999999974,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 46.65351499999997,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.374421000000439,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 24.738271000001987,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 45.28254100000049,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 91.97970599999826,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.139205999999831,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 6.822186000001238,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.515826000000743,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.643749999999272,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7676.670147000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8471.109715999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.273603000001458,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.937055999998847,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 46.58569499999794,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 87.1764370000019,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 42.625763000000006,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 83.06594399999813,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.933264999999665,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 63.11735899999985,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.49259399999937,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 65.8023310000026,
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
          "id": "14fa6ea7b5f7ed1a9529c3a5a79917f62a50117c",
          "message": "[release] Merge pull request #158 from PrivateGER/claude/groups-manga-reader-ux-hjipgz\n\nfix(video): keep offscreen videos silent after navigation",
          "timestamp": "2026-07-08T22:09:41Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/14fa6ea7b5f7ed1a9529c3a5a79917f62a50117c"
        },
        "date": 1783580663660,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 23.55769700000019,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 54.26989799999865,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 29.82821999999942,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 41.01993399999992,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 29.742309000001114,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 42.554041999999754,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 25.09484500000326,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 47.86165700000129,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 60.09028799999942,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 95.48084599999856,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 28.730572000000393,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 34.8162940000002,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 130.1523410000009,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 213.59815499999968,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 222.333590000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 281.59542800000054,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 427.86790199999814,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 680.5096420000045,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 24.444773999999597,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 48.342634000000544,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 21.403940000000148,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 50.887338000000454,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 62.882288000007975,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2148.580820000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.8773459999993065,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.9082039999993867,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 16.991109999999026,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 28.53149300000041,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 6.236940000000686,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 19.986896000000343,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.158477999999377,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 31.148737999999867,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.171387000000323,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 21.654529999999795,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 42.73759400000199,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 80.13138999999865,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.893978000000061,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 6.7726220000004105,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.934022999999797,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 7.9286879999999655,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7047.533312000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8336.156375999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.069328999998106,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 8.006883000001835,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 49.457290999998804,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 83.1872280000025,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 40.83012100000269,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 79.7163099999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 32.52576200000112,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 77.40600600000107,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 28.81085399999938,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 74.06612700000187,
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
          "id": "12c8a6ee86d7295721b999e7ddc79d6c0893cf0c",
          "message": "Merge pull request #159 from PrivateGER/claude/codebase-cleanup-review-6onnip\n\nExtract batch polling logic into reusable hook",
          "timestamp": "2026-07-09T11:47:13+02:00",
          "tree_id": "23fea3001ef0073f2f54cd676baa3562be940de4",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/12c8a6ee86d7295721b999e7ddc79d6c0893cf0c"
        },
        "date": 1783590599662,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 26.44534500000009,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 31.467376000000513,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 31.551009999999224,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 43.52399299999888,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 35.5621850000025,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 48.0587680000026,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 28.178549000000203,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 38.669505000001664,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 65.26259699999719,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 79.46233000000211,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 25.128969000001234,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 41.76727200000096,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 149.12966799999776,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 315.047555000001,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 256.5468120000005,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 485.35254500000156,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 497.76332600000023,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 972.8446949999998,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 27.8953900000015,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 43.63831199999913,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 20.708778000000166,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 34.097171000001254,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 65.71680499998911,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1877.5044110000017,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.5115860000005341,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 4.005757999999332,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 13.502841999999873,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 20.852138000000195,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.641387000001487,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 18.239019999999073,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.753493000000162,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 26.05112100000042,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.096992000000682,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 24.396633000000293,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 43.34288099999867,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 85.16305699999975,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.9154940000007628,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 6.825751000000309,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.949880000000121,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 11.778931000000739,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7258.846346999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 7963.631279,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.9916359999988344,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.046888000000763,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 47.686298000000534,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 74.11100100000112,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 41.93546100000094,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 74.4386740000009,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 28.871658000000025,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 56.384274000000005,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 26.804990000000544,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 65.95727099999931,
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T12:23:56+02:00",
          "tree_id": "05d82debe4ea06b1eebb6291b05a33e06bfd56ee",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1783592794059,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 26.95514700000058,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 38.09599900000103,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 29.103712000000087,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 45.87902900000336,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 34.753098999997746,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 54.064322999998694,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 28.803068000001076,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 33.35917999999947,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 51.55686699999933,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 70.47678200000155,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 27.18657499999972,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 38.41878200000065,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 146.90161299999818,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 247.9624530000001,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 221.8192850000014,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 305.579733999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 407.47595100000035,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 507.5494519999993,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 23.23953700000129,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 42.896521999999095,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 23.035508000000846,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 31.117637999999715,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 1232.5493190000125,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1811.8170320000027,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0099630000004254,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 5.928863999999521,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 14.0811020000001,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 41.19347700000071,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.268276999999216,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 15.56793000000107,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 10.529054000000542,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 20.6415020000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 10.969934999999168,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 27.086468999999852,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 41.98799599999984,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 113.0194649999994,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.8695520000001125,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 7.451966000000539,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.026991000000635,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.181794000000082,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7444.847974999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8360.156473000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.7931050000006508,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.242945000001782,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 46.30233399999997,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 66.42403600000034,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 39.22951100000137,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 49.73211900000024,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.30634700000155,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 65.655321000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 26.17986699999892,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 43.23002599999745,
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1783666749048,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 26.190859999998793,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 50.27760599999965,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 33.386631000001216,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 36.2517880000014,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 36.16911400000026,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 51.25717599999916,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 32.5126339999988,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 47.07645799999955,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 60.593587000003026,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 90.37606199999937,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 27.398800999999366,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 41.21682300000248,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 123.21698800000013,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 216.02274399999988,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 264.57779200000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 503.53604500000074,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 464.44324400000187,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 605.4935540000006,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 27.227300000002288,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 45.967132999998285,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 33.14834200000041,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 60.13088500000231,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 64.92109500001243,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2062.6463060000024,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0754979999983334,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.723541999999725,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.99276800000007,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 24.477037999999084,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 7.726796999999351,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 15.569107000001168,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 13.179321999999956,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 25.42756399999962,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.793079999999463,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 29.292397000001074,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 46.55048600000009,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 114.05906699999832,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.9897949999995035,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.011333000000377,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.8611499999988155,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 9.821047999999792,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 8506.975886,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 9334.184833000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.212289000002784,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.3367769999968,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 48.6091860000015,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 76.91646899999978,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 45.597837000001164,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 77.07841800000097,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.053819000000658,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 56.63816799999768,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 29.573161999996955,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 66.60527999999977,
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1783749402648,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 26.54647499999919,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 61.7699219999995,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 28.135794999998325,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 50.43195299999934,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 27.55229600000166,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 52.05597300000227,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 25.264988999999332,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 47.13383799999792,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 57.3810510000003,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 88.65497600000162,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 25.37240600000223,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 39.44204599999648,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 174.89125400000194,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 303.1366110000017,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 277.2910770000017,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 505.0452589999986,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 762.8285669999968,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 929.7858530000012,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 24.115626999999222,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 52.62228799999866,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 20.12804700000197,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 45.28958199999761,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 164.06864300000598,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1826.335543000001,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9913090000009106,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.6148279999997612,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 14.983589999999822,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 28.636091000000306,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 13.36821400000008,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 27.09420399999908,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.485152999999627,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 37.769350000000486,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.772676000000502,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 26.823232000000644,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 50.58159499999965,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 113.07795299999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.745310000000245,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.25779700000021,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.574013000001287,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 11.809669000000213,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7445.147592000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8126.469745,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.8114199999981793,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.834252000000561,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 45.278496999999334,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 86.93645599999945,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 40.99297900000238,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 81.06249799999932,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 33.68614299999899,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 82.6916859999983,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 29.05260300000009,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 64.03275100000246,
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1783836997922,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 30.53163200000199,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 35.49076699999932,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 36.85017599999992,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 49.914474000001064,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 37.28108599999905,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 48.52282600000035,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 28.941931000001205,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 38.146544999999605,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 56.81063699999868,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 85.66283099999782,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 26.859102000002167,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 39.94889500000136,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 136.86710900000253,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 218.66129200000069,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 207.4495739999984,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 299.1649899999975,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 346.0246780000016,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 560.9772620000003,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.954255000000558,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 47.07937999999922,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 30.37927000000127,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 51.02235500000097,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 59.53756900000735,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2130.7280170000013,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0928039999998873,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.71358599999985,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.484749999999622,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 32.96584299999995,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 7.094876999999542,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 11.742029000000912,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 11.754766000000018,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 27.811910000000353,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 12.178719000001365,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 28.79551999999967,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 44.19635500000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 96.19295000000056,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.8885520000003453,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 4.465001000000484,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.975986000001285,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 6.6401069999992615,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7512.217277,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 9013.295173999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.4915990000008605,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.188563000003342,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 51.141185000000405,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 70.44495299999835,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 41.80473499999789,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 65.71138200000132,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 34.164888999999675,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 79.41041799999948,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 29.19565899999725,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 55.18568400000004,
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1783924448068,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 25.38148100000035,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 31.49010300000009,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 27.405848999998852,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 37.583481000001484,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 28.972358000002714,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 34.93351499999699,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 20.286127999999735,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 28.023449000000255,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 45.135637999999744,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 73.36530400000265,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 21.480063999999402,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 26.732390999997733,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 119.50235599999905,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 190.92146999999932,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 188.94224800000302,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 238.51416600000084,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 272.40676200000235,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 309.3054589999956,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 21.366489,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 34.40291799999977,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 16.928352999999333,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 29.48898299999928,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 1245.1277820000105,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1613.9111049999992,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.090743000000657,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.3810430000012275,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 13.442237000001114,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 27.49871499999972,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 8.407642999998643,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 25.847319000000425,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 9.495492000000013,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 24.77625199999966,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 8.733314000000973,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 16.62086399999862,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 31.004492000000027,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 59.162013999999544,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.0324339999988297,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 3.691186000000016,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.546338000000105,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 5.907843000000867,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 6680.894236,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8434.067796,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.9681430000018736,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 5.243676000001869,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 39.12092399999892,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 64.00998299999992,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 32.67992200000299,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 49.15472800000134,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 20.76361099999849,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 28.809649999999237,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 22.41269900000043,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 53.76614799999879,
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1784007801344,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 11.322549000000436,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 21.899649999999383,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 13.043429999997898,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 30.084123000000545,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 15.525251999999455,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 25.710563000000548,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 14.280158999998093,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 20.136279999998806,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 33.82613299999866,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 44.78877199999988,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 13.440695999997843,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 27.99400300000343,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 94.18529900000067,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 147.64546699999846,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 210.62181799999962,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 296.8908019999981,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 299.7549399999989,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 382.87415300000066,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 13.57372899999973,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 24.826112999999168,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 12.209714000000531,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 28.998929000001226,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 755.6849860000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1010.3010309999954,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.725191999999879,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 1.5451190000003407,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 9.428444000000127,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 17.329077000000325,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 5.325206000000435,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 7.781073999999535,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 7.652809000000161,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 13.358940000000075,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 7.376111999999921,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 10.827610000000277,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 24.76340899999923,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 50.94988799999919,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.0701129999997647,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 3.3359510000000228,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 2.571447999999691,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 3.696817999999439,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 4603.476374999998,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 6002.393457000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 2.7340369999983523,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 4.498798000000534,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 23.28370200000063,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 48.25986600000033,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 20.485852999998315,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 34.97594899999967,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 14.10809700000027,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 32.689626000003045,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 14.365031000001181,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 22.79423400000087,
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1784094310506,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 25.159459000002244,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 34.2178079999976,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 31.69430899999861,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 41.79845299999943,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 30.340079000001424,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 45.01306100000147,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 29.7657369999979,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 41.32988100000148,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 63.628999000000476,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 102.74481799999921,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 31.176595000000816,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 55.86544400000275,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 125.59803899999861,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 189.88821000000098,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 297.5745279999974,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 420.29806499999904,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 518.8486029999985,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 702.8746840000022,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 26.715915999997378,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 47.516703999997844,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 23.569734000000608,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 49.15507200000138,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 63.173030999998446,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2136.084877999994,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 2.0092679999997927,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 4.473345000000336,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 16.081469000000652,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 49.0671229999989,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 8.146129999999175,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 12.239331999999195,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.081682,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 29.136344000000463,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.742549000000508,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 19.661395999999513,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 48.795264000000316,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 100.11272499999905,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.103019000000131,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.142304999999396,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.585101000000577,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 9.434118000001035,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7574.346698000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8937.784993999998,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.1228399999999965,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.4746219999979076,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 49.860828000000765,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 61.25097399999868,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 41.60395900000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 65.70111299999917,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 33.372199000001274,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 74.10884100000112,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 29.899820999999065,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 59.006720999997924,
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1784181545785,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 25.55256400000144,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 33.16979100000026,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 32.228579999999056,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 48.11012000000119,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 37.243256999998266,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 88.87544899999921,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 25.342923000000155,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 55.69052699999884,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 53.43679200000042,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 97.04037000000244,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 24.311796999998478,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 47.842663999999786,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 140.1050780000005,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 282.40310600000157,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 313.7214030000032,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 433.6903249999996,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 734.1298769999994,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 968.7776260000028,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 24.837602999999945,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 47.63508500000171,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 22.096518999998807,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 44.094043000000966,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 122.83729999999923,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1785.3080350000018,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.1148149999989982,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.1341680000005,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 15.168550999998843,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 21.420352000001003,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 10.70448899999974,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 35.203121000000465,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 13.240249000000404,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 29.7109760000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 13.191602000000785,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 40.175616000000446,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 53.92606800000067,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 84.24183300000004,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.938830000000962,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.535378999999011,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.4955800000007,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 9.390512999998464,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7677.974258999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8703.591502,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 3.8649659999973665,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.864594999999099,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 44.499597999998514,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 99.32535599999756,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 39.80628599999909,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 89.15375200000199,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 29.075441999997565,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 68.01563700000042,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 27.882532999999967,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 66.02252399999998,
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1784267976488,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 28.850925999999163,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 35.20186900000044,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 32.98925800000143,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 50.90791000000172,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 31.2834299999995,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 51.035758000001806,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 25.1980799999983,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 43.11449300000095,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 50.96702799999912,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 96.32161899999846,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 26.801587000001746,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 43.44619299999977,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 144.23721500000102,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 233.0039510000006,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 206.50338199999896,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 322.4407899999969,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 432.72647299999517,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 575.4793900000004,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 25.312291999998706,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 58.3916109999991,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 23.23386699999901,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 60.79246599999897,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 57.51397200000065,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2059.0548229999986,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9983849999989616,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 1.7804869999999937,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 14.990614999998797,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 21.173751000000266,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 5.695665999999619,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 12.697588000000906,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 13.206825999999637,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 21.828032999999778,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.75695099999939,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 33.99918699999944,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 44.70162799999889,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 88.03041099999973,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.1900729999997566,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 11.839069999999992,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 4.676889999998821,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.250773000001573,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 7472.662197999998,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8308.238963,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.099586000000272,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.140451999999641,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 49.299237999999605,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 91.45582000000286,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 47.05702000000019,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 113.2261449999969,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 28.599811999996746,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 53.30412299999807,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 30.21217600000091,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 57.81764000000112,
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1784353198242,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 27.917845999996644,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 36.28154100000029,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 35.81509300000107,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 44.83373799999754,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 37.00353399999949,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 50.39068899999984,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 30.43630299999859,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 47.23316900000282,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 61.59259899999961,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 89.39904799999931,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 25.483745000001363,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 32.17818900000202,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 115.4941689999996,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 199.033093,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 183.65422699999908,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 256.6711869999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 346.2463659999994,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 455.3155289999995,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 29.222374000000855,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 45.80336499999976,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 24.050766000000294,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 64.11837300000116,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 61.929097999993246,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2049.8261189999976,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 1.0987530000002153,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 3.3579349999999977,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 19.91960100000142,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 33.572511999998824,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 6.831540999999561,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 14.180803000001106,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 10.820606999999654,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 17.648284999999305,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.61909899999955,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 37.57230100000015,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 43.430560000000696,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 92.61443900000086,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 3.106413999999859,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 13.437025999999605,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.085191000000123,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 13.86430399999881,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 8554.201186999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8800.756742,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.299104000001535,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.777304999999615,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 50.57249200000297,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 85.01959200000056,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 43.01129099999889,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 71.96286599999803,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 31.467552000001888,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 65.30153399999836,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 29.963654999999562,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 76.4443910000009,
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1784441625292,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 20.319931999998516,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 35.56695300000138,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 33.1725529999967,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 48.79679599999872,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 29.578746999999566,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 45.89279600000009,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 27.024130000001605,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 53.83861900000193,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 62.939925000002404,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 121.1033779999998,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 30.10432700000092,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 53.39165099999809,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 134.64321100000234,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 249.27364300000045,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 250.79485600000044,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 353.39066900000034,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 484.25274699999864,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 638.6572870000018,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 26.344810999999027,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 48.815520000000106,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 25.762911000001623,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 55.15523300000132,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 73.75547299999744,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 2039.6526599999997,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.9330119999995077,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 2.3797319999994215,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 20.31141000000025,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 42.821765000000596,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 11.595273000000816,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 25.07592199999999,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 12.0112990000016,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 30.427512999998726,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 11.89038299999811,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 19.730696999999054,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 44.42385699999795,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 94.90172299999904,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.9092799999998533,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 5.757335999998759,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 5.13170799999898,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 8.545850999998947,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 8245.384145,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 8856.985547,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 4.012380000000121,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 11.902207999999519,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 50.477210999997624,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 86.69446500000049,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 40.848187999999936,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 62.10376400000314,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 33.389334999999846,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 88.37600299999758,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 29.078308000000106,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 64.15232699999979,
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
          "id": "618c64c930273549aeb4e6961dfd71473f1bbaf9",
          "message": "[release] Merge pull request #164 from PrivateGER/fix/ocr-busy-review-findings\n\nfix(ocr): harden busy/429 handling — 9 review findings + test-script fix",
          "timestamp": "2026-07-20T01:51:10+02:00",
          "tree_id": "62109c9d4cc32134c56d9ca597df19aebeef6704",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/618c64c930273549aeb4e6961dfd71473f1bbaf9"
        },
        "date": 1784505190374,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 15.245781999998144,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 21.097286000000167,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 18.02882099999988,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 24.465778999998292,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 18.548086999999214,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 25.66847499999858,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 16.289229999998497,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 30.973340000000462,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 37.50448400000096,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 49.632252999999764,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 17.671650000000227,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 25.210934000002453,
            "unit": "ms",
            "extra": "20 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 91.67395100000067,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 158.79095899999993,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 218.0656459999991,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 306.6523809999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 273.59689699999944,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 374.2375350000002,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 14.174549000003026,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 24.618701999999757,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 18.799565000001166,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 35.0183999999972,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 874.5080850000013,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 1096.143727999999,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.7732369999994262,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 1.479301999999734,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 10.03626499999973,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 20.158156999999846,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 6.5760169999994105,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 12.187933000000157,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 7.57719200000065,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 20.3840420000015,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 7.167247999999745,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 13.052150999999867,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 27.420947999999044,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 42.47715599999901,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 2.1948679999995875,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 3.2441039999994246,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 3.7537840000004508,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 5.939645000000382,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 5145.682377000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 6290.375991999999,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 2.7890469999983907,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.168120999998791,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 28.183494000000792,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 39.38556199999948,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 23.62950500000079,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 35.6322739999996,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 14.9219370000028,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 26.055442000000767,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 15.763717999998335,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 34.2678969999979,
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
          "id": "8cff638930ac2c4d6baa825ddba7533b05e5277a",
          "message": "Merge pull request #161 from PrivateGER/claude/npm-dep-update-3woq0q\n\nUpgrade dependencies and fix React hooks linting warnings",
          "timestamp": "2026-07-20T01:51:33+02:00",
          "tree_id": "c479f610d50bd53fde135af3e02dbbd8ac6c9965",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/8cff638930ac2c4d6baa825ddba7533b05e5277a"
        },
        "date": 1784505320467,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 8.831922000000304,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 12.353567000000112,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 11.449397999999746,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 14.457963999999265,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 10.798637000000781,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 14.47559100000035,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 8.45834399999967,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 11.788108000000648,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 19.85495600000104,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 27.470117999999275,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 8.397738000001482,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 12.052998000001026,
            "unit": "ms",
            "extra": "100 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 69.71684300000015,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 126.57299700000021,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 201.42979599999853,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 526.5399230000003,
            "unit": "ms",
            "extra": "50 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 355.8407709999992,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 472.7804929999984,
            "unit": "ms",
            "extra": "30 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p50)",
            "value": 8.303349000000708,
            "unit": "ms",
            "extra": "200 iterations; dataset=medium"
          },
          {
            "name": "Single tag search (p95)",
            "value": 12.537254000000758,
            "unit": "ms",
            "extra": "200 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 7.0288650000002235,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 10.801762000000053,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 438.5775160000012,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 465.73314799999935,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.5097089999999298,
            "unit": "ms",
            "extra": "300 iterations; dataset=medium"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 0.959447000000182,
            "unit": "ms",
            "extra": "300 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 6.138133999999809,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 7.136269999999968,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 4.160952999999608,
            "unit": "ms",
            "extra": "200 iterations; dataset=medium"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 6.336242000000311,
            "unit": "ms",
            "extra": "200 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 4.896477000000232,
            "unit": "ms",
            "extra": "200 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 6.83422900000005,
            "unit": "ms",
            "extra": "200 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 4.821398999999474,
            "unit": "ms",
            "extra": "200 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 6.419793999999456,
            "unit": "ms",
            "extra": "200 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 20.278965999999855,
            "unit": "ms",
            "extra": "200 iterations; dataset=medium"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 24.257114,
            "unit": "ms",
            "extra": "200 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 1.4994409999999334,
            "unit": "ms",
            "extra": "300 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 1.9391789999999673,
            "unit": "ms",
            "extra": "300 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 2.1980439999997543,
            "unit": "ms",
            "extra": "300 iterations; dataset=medium"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 2.9056409999993775,
            "unit": "ms",
            "extra": "300 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 2565.9134489999997,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 3168.9160300000003,
            "unit": "ms",
            "extra": "3 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 1.8194230000008247,
            "unit": "ms",
            "extra": "300 iterations; dataset=medium"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 2.6833060000008118,
            "unit": "ms",
            "extra": "300 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 21.6042039999993,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 25.360828999997466,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 18.098455999999715,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 22.928468000001885,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 12.434296999999788,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 14.327581000001373,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 12.078549999998359,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 13.4627470000014,
            "unit": "ms",
            "extra": "150 iterations; dataset=medium"
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
          "id": "432cb1558aebfe7617105c56ddc6b73af632c4ef",
          "message": "Merge pull request #145 from PrivateGER/feat/favorites-feed\n\nfeat(feed): widen and age-stratify older-seed sampling",
          "timestamp": "2026-07-04T01:37:00Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/432cb1558aebfe7617105c56ddc6b73af632c4ef"
        },
        "date": 1783231000790,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 109.64720599999782,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 120.29357499999969,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 150.75834600000235,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 168.79677900000388,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 106.62586800000281,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 137.6052750000017,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 114.82129300000088,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 135.89501699999528,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 219.97479300000123,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 238.58193100000062,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 111.84944299999916,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 129.17122499999823,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 144.64936099999977,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 205.0014469999951,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 258.8369889999958,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 331.5499160000036,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 408.51370500000485,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 472.5086649999939,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Single tag search (p50)",
            "value": 108.15017799999987,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Single tag search (p95)",
            "value": 132.3673459999991,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 139.17982499999925,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 163.87243199999648,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 468.2083380000113,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 507.7692790000001,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.6810369999984687,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 0.8499400000000605,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 92.66466800000126,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 103.19504000000234,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 76.6266629999991,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 103.98880500000087,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 51.75128099999711,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 57.450856000003114,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 54.313139999998384,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 60.11173599999893,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 791.5574409999972,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 833.4298359999957,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 7.202999000001,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 10.690593999999692,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 17.5818709999985,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 21.95603299999857,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 3170.944948000001,
            "unit": "ms",
            "extra": "3 iterations; dataset=large"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 3727.5605749999995,
            "unit": "ms",
            "extra": "3 iterations; dataset=large"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 7.029217000002973,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 11.70940200000041,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 997.5292429999972,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 1038.5394369999995,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 342.0542759999953,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 355.3033679999935,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 144.53247099999862,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 161.55720600001223,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 116.94224499999837,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 133.38001199999417,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1783840367360,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 80.86461799999961,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 85.23607999999876,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 112.95397500000036,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 124.88026799999716,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 86.29747700000007,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 105.16124199999831,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 85.0014590000028,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 101.57111700000314,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 172.1828710000009,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 183.8883969999988,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 84.7677760000006,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 96.90465199999744,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 111.76994000000195,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 162.14297400000214,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 188.45813900000212,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 238.93160199999693,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 302.31792800000403,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 334.1545019999976,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Single tag search (p50)",
            "value": 84.54623400000128,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Single tag search (p95)",
            "value": 101.93757199999891,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 108.16240900000412,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 116.81627799999842,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 328.30471599999873,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 338.29481099999975,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.6064279999991413,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 0.7595870000004652,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 73.66673000000083,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 79.82524099999864,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 33.58546799999749,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 56.14019299999927,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 40.42896999999357,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 44.053155000001425,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 40.1083260000014,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 42.77859700000408,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 623.5545950000014,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 656.5261520000058,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 5.916205000001355,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 6.766014000000723,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 12.398119000001316,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 15.387868999998318,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 2901.3366450000003,
            "unit": "ms",
            "extra": "3 iterations; dataset=large"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 3455.7574079999995,
            "unit": "ms",
            "extra": "3 iterations; dataset=large"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 5.960402999997314,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 7.953828000001522,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 698.2344840000005,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 711.8426069999987,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 221.72649400000228,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 233.41271899999992,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 98.69473500001186,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 112.12106200000562,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 79.42767299999832,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 90.65783900000679,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
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
          "id": "1897e723d5ee5188118eeb3d78b447e4b6da6d7a",
          "message": "[release] Merge pull request #160 from PrivateGER/claude/ocr-batch-429-queue-yelep2\n\nfix(ocr): stop batch runs from hammering a busy/wedged sidecar with 429s",
          "timestamp": "2026-07-09T10:23:56Z",
          "url": "https://github.com/PrivateGER/hydrus-nextbooru/commit/1897e723d5ee5188118eeb3d78b447e4b6da6d7a"
        },
        "date": 1784444202583,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Groups: unfiltered random page (p50)",
            "value": 86.77327100000184,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: unfiltered random page (p95)",
            "value": 104.48837600000115,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: unfiltered newest page (p50)",
            "value": 117.49602899999809,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: unfiltered newest page (p95)",
            "value": 129.14262400000007,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, random order (p50)",
            "value": 90.65983399999823,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, random order (p95)",
            "value": 99.47263400000156,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, newest order (p50)",
            "value": 93.60273700000107,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: title query, newest order (p95)",
            "value": 102.82232700000168,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: creator filter, random order (p50)",
            "value": 172.07148299999972,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: creator filter, random order (p95)",
            "value": 182.96590600000127,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p50)",
            "value": 90.11945999999443,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Groups: type filter PIXIV, newest order (p95)",
            "value": 107.38880000000063,
            "unit": "ms",
            "extra": "20 iterations; dataset=large"
          },
          {
            "name": "Notes search (common word) (p50)",
            "value": 113.76403800000116,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (common word) (p95)",
            "value": 155.9051040000013,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (two words) (p50)",
            "value": 196.15237200000047,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (two words) (p95)",
            "value": 271.64786900000036,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Notes search (page 5) (p50)",
            "value": 361.9499629999991,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Notes search (page 5) (p95)",
            "value": 442.53456000000006,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Single tag search (p50)",
            "value": 82.79390100000091,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Single tag search (p95)",
            "value": 104.38098099999843,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "2-tag AND search (p50)",
            "value": 106.92158899999777,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "2-tag AND search (p95)",
            "value": 121.91921000000002,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "3-tag AND search (p50)",
            "value": 308.53267600000254,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "3-tag AND search (p95)",
            "value": 321.7493089999989,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (page 1) (p50)",
            "value": 0.4741990000002261,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (page 1) (p95)",
            "value": 0.5958879999998317,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Random order (wrap-around page) (p50)",
            "value": 72.1195710000029,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Random order (wrap-around page) (p95)",
            "value": 84.99815899999885,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Recommendations (uncached compute) (p50)",
            "value": 35.18424800000503,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Recommendations (uncached compute) (p95)",
            "value": 56.58303899999737,
            "unit": "ms",
            "extra": "30 iterations; dataset=large"
          },
          {
            "name": "Semantic search (capped KNN) (p50)",
            "value": 43.21251199999824,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (capped KNN) (p95)",
            "value": 45.06790900000124,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (page 5 of cap) (p50)",
            "value": 43.06235600000218,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (page 5 of cap) (p95)",
            "value": 46.246691999993345,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (min-score filtered) (p50)",
            "value": 593.4860659999977,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Semantic search (min-score filtered) (p95)",
            "value": 615.6994410000043,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 10) (p50)",
            "value": 5.3539550000023155,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 10) (p95)",
            "value": 7.212616000000708,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 24) (p50)",
            "value": 12.769807000000583,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Phash similar search (threshold 24) (p95)",
            "value": 18.058650999999372,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Sync ingest (2000 files) (p50)",
            "value": 2516.6477250000007,
            "unit": "ms",
            "extra": "3 iterations; dataset=large"
          },
          {
            "name": "Sync ingest (2000 files) (p95)",
            "value": 3135.909442,
            "unit": "ms",
            "extra": "3 iterations; dataset=large"
          },
          {
            "name": "Simple tag search (q=general) (p50)",
            "value": 5.204392000003281,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Simple tag search (q=general) (p95)",
            "value": 6.316431999999622,
            "unit": "ms",
            "extra": "100 iterations; dataset=large"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p50)",
            "value": 849.5558119999987,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Grouped creator autocomplete (q=artist) (p95)",
            "value": 869.3413370000053,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (1 selected) (p50)",
            "value": 284.0151279999991,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (1 selected) (p95)",
            "value": 292.7680099999998,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (2 selected) (p50)",
            "value": 119.96051300001272,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (2 selected) (p95)",
            "value": 130.6760179999983,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (3 selected) (p50)",
            "value": 94.78897599999618,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          },
          {
            "name": "Co-occurrence search (3 selected) (p95)",
            "value": 104.85830100000021,
            "unit": "ms",
            "extra": "50 iterations; dataset=large"
          }
        ]
      }
    ]
  }
}