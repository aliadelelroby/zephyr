# Zephyr demo: TypeScript/JavaScript

## Basic Usage

```typescript
import { ByteBuffer } from "zephyr-schema";

// Encoding
const buffer = new ByteBuffer();
buffer.writeVarUint(123);
buffer.writeString("Hello, Zephyr!");
buffer.writeVarFloat(3.14159);

const data = buffer.toUint8Array();

// Decoding
const reader = new ByteBuffer(data);
const number = reader.readVarUint();
const text = reader.readString();
const pi = reader.readVarFloat();

console.log(number, text, pi); // 123 "Hello, Zephyr!" 3.14159
```

## Delta Encoding for Arrays

Delta encoding is useful for arrays of sequential or sorted numbers:

```typescript
import { ByteBuffer } from "zephyr-schema";

// Encoding with delta compression
const buffer = new ByteBuffer();
const numbers = [100, 101, 102, 103, 104, 105];

buffer.writeVarUint(numbers.length);
let last = 0;
for (const num of numbers) {
  last = buffer.writeVarIntDelta(num, last);
}

// Decoding
const reader = new ByteBuffer(buffer.toUint8Array());
const count = reader.readVarUint();
const decoded: number[] = [];
let lastValue = 0;
for (let i = 0; i < count; i++) {
  lastValue = reader.readVarIntDelta(lastValue);
  decoded.push(lastValue);
}

console.log(decoded); // [100, 101, 102, 103, 104, 105]
```

## Bit Packing for Booleans

Pack multiple boolean values efficiently:

```typescript
import { ByteBuffer } from "zephyr-schema";

// Encoding
const buffer = new ByteBuffer();
const flags = [true, false, true, true, false, false, true, false];

buffer.writeVarUint(flags.length);
for (const flag of flags) {
  buffer.writeBits(flag ? 1 : 0, 1);
}
buffer.flushBits(); // Important: flush remaining bits

// Decoding
const reader = new ByteBuffer(buffer.toUint8Array());
const count = reader.readVarUint();
const decoded: boolean[] = [];
for (let i = 0; i < count; i++) {
  decoded.push(reader.readBits(1) !== 0);
}

console.log(decoded); // [true, false, true, true, false, false, true, false]
```

## Half-Precision Floats

Use 16-bit floats for better space efficiency when precision allows:

```typescript
import { ByteBuffer } from "zephyr-schema";

// Encoding
const buffer = new ByteBuffer();
buffer.writeVarFloat16(3.14); // Uses 2 bytes instead of 4

// Decoding
const reader = new ByteBuffer(buffer.toUint8Array());
const value = reader.readVarFloat16();

console.log(value); // 3.14 (approximate)
```

## Performance Comparison

Zephyr's improvements over Kiwi:

1. **Length-prefixed strings**: ~15% faster for string operations
2. **Delta encoding**: Up to 90% size reduction for sequential arrays
3. **Bit packing**: 8x space savings for boolean arrays
4. **Half-precision floats**: 50% size reduction when precision allows
5. **Better memory management**: Reduced allocations and better cache locality

## TypeScript Support

Full TypeScript support with type definitions:

```typescript
import { ByteBuffer, Schema, Definition } from "zephyr-schema";

// All types are fully typed
const buffer: ByteBuffer = new ByteBuffer();
const schema: Schema = {
  package: "example",
  definitions: [],
};
```
