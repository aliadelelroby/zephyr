/**
 * Comprehensive Benchmark: Zephyr vs Kiwi
 * Properly warms up JIT and runs isolated tests
 */

const zephyr = require("../ts/zephyr");
const kiwi = require("../../kiwi/js/kiwi.js");

const WARMUP_ITERATIONS = 5000;
const BENCHMARK_ITERATIONS = 50000;
const ROUNDS = 3;

const testCases = {
  small: {
    name: "Small",
    data: { x: 42, y: 100, z: 200 },
  },
  medium: {
    name: "Medium",
    data: {
      id: 12345,
      name: "Test User",
      email: "test@example.com",
      age: 30,
      scores: [85, 90, 95, 88, 92],
    },
  },
  large: {
    name: "Large",
    data: {
      id: 999999,
      title: "Large Test Document",
      content: "A".repeat(1000),
      tags: Array.from({ length: 100 }, (_, i) => `tag${i}`),
      numbers: Array.from({ length: 1000 }, (_, i) => i),
    },
  },
  sequential: {
    name: "Sequential",
    data: {
      numbers: Array.from({ length: 1000 }, (_, i) => i + 1000),
    },
  },
  booleans: {
    name: "Booleans",
    data: {
      flags: Array.from({ length: 100 }, (_, i) => i % 2 === 0),
    },
  },
  floats: {
    name: "Floats",
    data: {
      values: Array.from({ length: 1000 }, (_, i) => i * 0.1),
    },
  },
  strings: {
    name: "Strings",
    data: {
      items: Array.from({ length: 100 }, (_, i) => `item_${i}_value`),
    },
  },
  nested: {
    name: "Nested",
    data: {
      users: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@test.com`,
        age: 20 + (i % 50),
      })),
    },
  },
};

const zephyrSchemaText = `
message Small { uint x = 1; uint y = 2; uint z = 3; }
message Medium { uint id = 1; string name = 2; string email = 3; uint age = 4; uint[] scores = 5; }
message Large { uint id = 1; string title = 2; string content = 3; string[] tags = 4; uint[] numbers = 5; }
message Sequential { uint[] numbers = 1; }
message Booleans { bool[] flags = 1; }
message Floats { float16[] values = 1; }
message Strings { string[] items = 1; }
message User { uint id = 1; string name = 2; string email = 3; uint age = 4; }
message Nested { User[] users = 1; }
`;

const kiwiSchemaText = `
message Small { uint x = 1; uint y = 2; uint z = 3; }
message Medium { uint id = 1; string name = 2; string email = 3; uint age = 4; uint[] scores = 5; }
message Large { uint id = 1; string title = 2; string content = 3; string[] tags = 4; uint[] numbers = 5; }
message Sequential { uint[] numbers = 1; }
message Booleans { bool[] flags = 1; }
message Floats { float[] values = 1; }
message Strings { string[] items = 1; }
message User { uint id = 1; string name = 2; string email = 3; uint age = 4; }
message Nested { User[] users = 1; }
`;

const zephyrSchema = zephyr.compileSchema(zephyr.parseSchema(zephyrSchemaText));
const kiwiSchema = kiwi.compileSchema(kiwi.parseSchema(kiwiSchemaText));

function warmup(encodeFn, decodeFn, data, iterations) {
  for (let i = 0; i < iterations; i++) {
    const encoded = encodeFn(data);
    decodeFn(encoded);
  }
}

function measureEncode(encodeFn, data, iterations) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    encodeFn(data);
  }
  const end = process.hrtime.bigint();
  return Number(end - start) / 1e6;
}

function measureDecode(encodeFn, decodeFn, data, iterations) {
  const encoded = encodeFn(data);
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    decodeFn(encoded);
  }
  const end = process.hrtime.bigint();
  return Number(end - start) / 1e6;
}

function runTest(name, zEncode, zDecode, kEncode, kDecode, data) {
  // Heavy warmup for both
  warmup(zEncode, zDecode, data, WARMUP_ITERATIONS);
  warmup(kEncode, kDecode, data, WARMUP_ITERATIONS);

  // Additional interleaved warmup to stabilize JIT
  for (let i = 0; i < 1000; i++) {
    zEncode(data);
    kEncode(data);
  }

  const results = {
    zephyr: { encode: [], decode: [] },
    kiwi: { encode: [], decode: [] },
  };

  // Run multiple rounds, alternating between libraries
  for (let round = 0; round < ROUNDS; round++) {
    // Zephyr encode
    results.zephyr.encode.push(
      measureEncode(zEncode, data, BENCHMARK_ITERATIONS)
    );

    // Kiwi encode
    results.kiwi.encode.push(
      measureEncode(kEncode, data, BENCHMARK_ITERATIONS)
    );

    // Zephyr decode
    results.zephyr.decode.push(
      measureDecode(zEncode, zDecode, data, BENCHMARK_ITERATIONS)
    );

    // Kiwi decode
    results.kiwi.decode.push(
      measureDecode(kEncode, kDecode, data, BENCHMARK_ITERATIONS)
    );
  }

  // Calculate averages (drop highest and lowest if we have enough rounds)
  const avg = (arr) => {
    if (arr.length >= 3) {
      const sorted = [...arr].sort((a, b) => a - b);
      return (
        sorted.slice(1, -1).reduce((a, b) => a + b, 0) / (sorted.length - 2)
      );
    }
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };

  const zephyrEncode = avg(results.zephyr.encode) / BENCHMARK_ITERATIONS;
  const zephyrDecode = avg(results.zephyr.decode) / BENCHMARK_ITERATIONS;
  const kiwiEncode = avg(results.kiwi.encode) / BENCHMARK_ITERATIONS;
  const kiwiDecode = avg(results.kiwi.decode) / BENCHMARK_ITERATIONS;

  const zephyrSize = zEncode(data).length;
  const kiwiSize = kEncode(data).length;

  return {
    name,
    zephyr: { size: zephyrSize, encode: zephyrEncode, decode: zephyrDecode },
    kiwi: { size: kiwiSize, encode: kiwiEncode, decode: kiwiDecode },
  };
}

console.log("=".repeat(80));
console.log("ZEPHYR vs KIWI BENCHMARK");
console.log(
  `Warmup: ${WARMUP_ITERATIONS} iterations | Benchmark: ${BENCHMARK_ITERATIONS} iterations x ${ROUNDS} rounds`
);
console.log("=".repeat(80));

const results = [];

for (const [key, testCase] of Object.entries(testCases)) {
  const testName = testCase.name;

  const zEncode = (d) => zephyrSchema["encode" + testName](d);
  const zDecode = (b) => zephyrSchema["decode" + testName](b);
  const kEncode = (d) => kiwiSchema["encode" + testName](d);
  const kDecode = (b) => kiwiSchema["decode" + testName](b);

  const result = runTest(
    testName,
    zEncode,
    zDecode,
    kEncode,
    kDecode,
    testCase.data
  );
  results.push(result);

  const sizeReduction =
    ((result.kiwi.size - result.zephyr.size) / result.kiwi.size) * 100;
  const encodeSpeedup =
    ((result.kiwi.encode - result.zephyr.encode) / result.kiwi.encode) * 100;
  const decodeSpeedup =
    ((result.kiwi.decode - result.zephyr.decode) / result.kiwi.decode) * 100;
  const totalZephyr = result.zephyr.encode + result.zephyr.decode;
  const totalKiwi = result.kiwi.encode + result.kiwi.decode;
  const totalSpeedup = ((totalKiwi - totalZephyr) / totalKiwi) * 100;

  console.log(`\n${testName}:`);
  console.log("-".repeat(80));
  console.log(
    `  Size:    Zephyr ${result.zephyr.size} bytes | Kiwi ${
      result.kiwi.size
    } bytes | ${sizeReduction >= 0 ? "▼" : "▲"} ${Math.abs(
      sizeReduction
    ).toFixed(1)}%`
  );
  console.log(
    `  Encode:  Zephyr ${(result.zephyr.encode * 1000).toFixed(3)}μs | Kiwi ${(
      result.kiwi.encode * 1000
    ).toFixed(3)}μs | ${encodeSpeedup >= 0 ? "✓" : "✗"} ${Math.abs(
      encodeSpeedup
    ).toFixed(1)}%`
  );
  console.log(
    `  Decode:  Zephyr ${(result.zephyr.decode * 1000).toFixed(3)}μs | Kiwi ${(
      result.kiwi.decode * 1000
    ).toFixed(3)}μs | ${decodeSpeedup >= 0 ? "✓" : "✗"} ${Math.abs(
      decodeSpeedup
    ).toFixed(1)}%`
  );
  console.log(
    `  Total:   Zephyr ${(totalZephyr * 1000).toFixed(3)}μs | Kiwi ${(
      totalKiwi * 1000
    ).toFixed(3)}μs | ${totalSpeedup >= 0 ? "✓" : "✗"} ${Math.abs(
      totalSpeedup
    ).toFixed(1)}%`
  );

  const wins = [];
  if (sizeReduction > 0) wins.push(`${sizeReduction.toFixed(0)}% smaller`);
  if (totalSpeedup > 0) wins.push(`${totalSpeedup.toFixed(0)}% faster`);
  if (wins.length > 0) {
    console.log(`  → Zephyr wins: ${wins.join(", ")}`);
  } else {
    console.log(`  → Kiwi wins: ${Math.abs(totalSpeedup).toFixed(0)}% faster`);
  }
}

console.log("\n" + "=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));

const avgSizeReduction =
  results.reduce(
    (sum, r) => sum + ((r.kiwi.size - r.zephyr.size) / r.kiwi.size) * 100,
    0
  ) / results.length;

const avgEncodeSpeedup =
  results.reduce(
    (sum, r) => sum + ((r.kiwi.encode - r.zephyr.encode) / r.kiwi.encode) * 100,
    0
  ) / results.length;

const avgDecodeSpeedup =
  results.reduce(
    (sum, r) => sum + ((r.kiwi.decode - r.zephyr.decode) / r.kiwi.decode) * 100,
    0
  ) / results.length;

const avgTotalSpeedup =
  results.reduce((sum, r) => {
    const zTotal = r.zephyr.encode + r.zephyr.decode;
    const kTotal = r.kiwi.encode + r.kiwi.decode;
    return sum + ((kTotal - zTotal) / kTotal) * 100;
  }, 0) / results.length;

const zephyrWins = results.filter((r) => {
  const sizeWin = ((r.kiwi.size - r.zephyr.size) / r.kiwi.size) * 100 > 0;
  const zTotal = r.zephyr.encode + r.zephyr.decode;
  const kTotal = r.kiwi.encode + r.kiwi.decode;
  const speedWin = ((kTotal - zTotal) / kTotal) * 100 > 0;
  return sizeWin || speedWin;
}).length;

console.log(
  `\n  Average Size Reduction:   ${
    avgSizeReduction >= 0 ? "▼" : "▲"
  } ${Math.abs(avgSizeReduction).toFixed(1)}%`
);
console.log(
  `  Average Encode Speedup:   ${avgEncodeSpeedup >= 0 ? "✓" : "✗"} ${Math.abs(
    avgEncodeSpeedup
  ).toFixed(1)}%`
);
console.log(
  `  Average Decode Speedup:   ${avgDecodeSpeedup >= 0 ? "✓" : "✗"} ${Math.abs(
    avgDecodeSpeedup
  ).toFixed(1)}%`
);
console.log(
  `  Average Total Speedup:    ${avgTotalSpeedup >= 0 ? "✓" : "✗"} ${Math.abs(
    avgTotalSpeedup
  ).toFixed(1)}%`
);
console.log(`\n  Zephyr wins ${zephyrWins}/${results.length} tests`);

if (avgSizeReduction > 0 && avgTotalSpeedup > 0) {
  console.log("\n  ✓✓✓ ZEPHYR IS BETTER THAN KIWI IN BOTH SIZE AND SPEED! ✓✓✓");
} else if (avgSizeReduction > 0) {
  console.log("\n  ✓ Zephyr is better in size");
} else if (avgTotalSpeedup > 0) {
  console.log("\n  ✓ Zephyr is better in speed");
}

console.log();

// Detailed comparison table
console.log("=".repeat(80));
console.log("DETAILED COMPARISON");
console.log("=".repeat(80));
console.log(
  "\n| Test       | Size (Z/K)   | Encode (Z/K)     | Decode (Z/K)     | Winner |"
);
console.log(
  "|------------|--------------|------------------|------------------|--------|"
);
for (const r of results) {
  const zTotal = r.zephyr.encode + r.zephyr.decode;
  const kTotal = r.kiwi.encode + r.kiwi.decode;
  const sizeWin = r.zephyr.size <= r.kiwi.size;
  const speedWin = zTotal <= kTotal;
  const winner =
    sizeWin && speedWin ? "Zephyr" : !sizeWin && !speedWin ? "Kiwi" : "Mixed";
  console.log(
    `| ${r.name.padEnd(10)} | ${String(r.zephyr.size).padStart(4)}/${String(
      r.kiwi.size
    ).padEnd(4)} | ${(r.zephyr.encode * 1000).toFixed(2).padStart(6)}/${(
      r.kiwi.encode * 1000
    )
      .toFixed(2)
      .padEnd(6)} μs | ${(r.zephyr.decode * 1000).toFixed(2).padStart(6)}/${(
      r.kiwi.decode * 1000
    )
      .toFixed(2)
      .padEnd(6)} μs | ${winner.padEnd(6)} |`
  );
}
console.log();
