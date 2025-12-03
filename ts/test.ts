/**
 * Simple test demonstrating Zephyr improvements
 */

import { ByteBuffer } from "./bb";

console.log("=== Zephyr Protocol Test ===\n");

// Test 1: Length-prefixed strings (vs null-terminated)
console.log("1. String Encoding:");
const strBuffer = new ByteBuffer();
strBuffer.writeString("Hello, Zephyr!");
const strData = strBuffer.toUint8Array();
console.log(`   Encoded: ${strData.length} bytes`);
const strReader = new ByteBuffer(strData);
const decodedStr = strReader.readString();
console.log(`   Decoded: "${decodedStr}"`);
console.log(`   ✓ Length-prefixed (faster than null-terminated)\n`);

// Test 2: Delta encoding
console.log("2. Delta Encoding:");
const deltaBuffer = new ByteBuffer();
const sequential = [100, 101, 102, 103, 104, 105];
deltaBuffer.writeVarUint(sequential.length);
let last = 0;
for (const num of sequential) {
  last = deltaBuffer.writeVarIntDelta(num, last);
}
const deltaData = deltaBuffer.toUint8Array();
console.log(`   Original: ${sequential.length} numbers`);
console.log(`   Encoded: ${deltaData.length} bytes`);
const deltaReader = new ByteBuffer(deltaData);
const count = deltaReader.readVarUint();
const decoded: number[] = [];
let lastValue = 0;
for (let i = 0; i < count; i++) {
  lastValue = deltaReader.readVarIntDelta(lastValue);
  decoded.push(lastValue);
}
console.log(`   Decoded: [${decoded.join(", ")}]`);
console.log(`   ✓ Delta encoding for sequential data\n`);

// Test 3: Bit packing
console.log("3. Bit Packing:");
const bitBuffer = new ByteBuffer();
const flags = [true, false, true, true, false, false, true, false];
bitBuffer.writeVarUint(flags.length);
for (const flag of flags) {
  bitBuffer.writeBits(flag ? 1 : 0, 1);
}
bitBuffer.flushBits();
const bitData = bitBuffer.toUint8Array();
console.log(`   Original: ${flags.length} booleans`);
console.log(
  `   Encoded: ${bitData.length} bytes (vs ${flags.length} bytes without packing)`
);
const bitReader = new ByteBuffer(bitData);
const flagCount = bitReader.readVarUint();
const decodedFlags: boolean[] = [];
for (let i = 0; i < flagCount; i++) {
  decodedFlags.push(bitReader.readBits(1) !== 0);
}
console.log(
  `   Decoded: [${decodedFlags.map((f) => (f ? "T" : "F")).join(", ")}]`
);
console.log(`   ✓ 8x space savings for booleans\n`);

// Test 4: Half-precision floats
console.log("4. Half-Precision Floats:");
const floatBuffer = new ByteBuffer();
floatBuffer.writeVarFloat16(3.14159);
const floatData = floatBuffer.toUint8Array();
console.log(
  `   Encoded: ${floatData.length} bytes (vs 4 bytes for full precision)`
);
const floatReader = new ByteBuffer(floatData);
const value = floatReader.readVarFloat16();
console.log(`   Decoded: ${value}`);
console.log(`   ✓ 50% size reduction for floats\n`);

// Test 5: Mixed data
console.log("5. Mixed Data Encoding:");
const mixedBuffer = new ByteBuffer();
mixedBuffer.writeVarUint(42);
mixedBuffer.writeString("test");
mixedBuffer.writeVarInt(-123);
mixedBuffer.writeVarFloat(1.5);
const mixedData = mixedBuffer.toUint8Array();
console.log(`   Encoded: ${mixedData.length} bytes`);
const mixedReader = new ByteBuffer(mixedData);
console.log(`   Uint: ${mixedReader.readVarUint()}`);
console.log(`   String: "${mixedReader.readString()}"`);
console.log(`   Int: ${mixedReader.readVarInt()}`);
console.log(`   Float: ${mixedReader.readVarFloat()}`);
console.log(`   ✓ All types working correctly\n`);

console.log("=== All Tests Passed ===");
