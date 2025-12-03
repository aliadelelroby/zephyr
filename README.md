<p align="center">
  <h1 align="center">⚡ Zephyr</h1>
  <p align="center">
    <strong>High-performance binary serialization for the modern web</strong>
  </p>
  <p align="center">
    <a href="https://aliadelelroby.github.io/zephyr/">Live Demo</a> •
    <a href="https://www.npmjs.com/package/zephyr-schema">npm</a> •
    <a href="./ts/README.md">Documentation</a>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/size-26%25%20smaller-brightgreen" alt="26% smaller">
  <img src="https://img.shields.io/badge/speed-12%25%20faster-brightgreen" alt="12% faster">
  <img src="https://img.shields.io/badge/typescript-full%20support-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-lightgrey" alt="MIT License">
</p>

---

<p align="center">
  <a href="https://aliadelelroby.github.io/zephyr/">
    <strong>🚀 Try the Interactive Demo →</strong>
  </a>
</p>

---

## Highlights

- **26% smaller** payloads through delta encoding & bit packing
- **12% faster** encode/decode with optimized algorithms
- **Full TypeScript support** with runtime enum values & type guards
- **Native map support** — `map<string, int>` as a first-class type
- **Zero dependencies** — works in browsers & Node.js

## Comparison with Kiwi

| Feature        | Kiwi        | Zephyr                            |
| -------------- | ----------- | --------------------------------- |
| Payload Size   | Baseline    | **26% smaller**                   |
| Encode/Decode  | Baseline    | **12% faster**                    |
| TypeScript     | Basic types | Full type safety + runtime values |
| Maps           | ❌          | ✅ Native `map<K, V>`             |
| Delta Encoding | ❌          | ✅ Automatic compression          |
| Bit Packing    | ❌          | ✅ 84% smaller booleans           |
| Half-precision | ❌          | ✅ `float16` type                 |

## Installation

```bash
npm install zephyr-schema
```

## Quick Start

```javascript
const zephyr = require("zephyr-schema");

const schema = zephyr.compileSchema(
  zephyr.parseSchema(`
    message User {
      uint id = 1;
      string name = 2;
      string email = 3;
    }
  `)
);

// Encode
const buffer = schema.encodeUser({
  id: 1,
  name: "Alice",
  email: "alice@example.com",
});
console.log(buffer); // Uint8Array

// Decode
const user = schema.decodeUser(buffer);
console.log(user); // { id: 1, name: "Alice", email: "alice@example.com" }
```

## TypeScript Support

Generate fully-typed definitions from your schema:

```bash
npx zephyrc --schema user.zephyr --ts user.ts
```

**Output:**

```typescript
export const Status = {
  PENDING: "PENDING" as const,
  ACTIVE: "ACTIVE" as const,
} as const;

export type Status = (typeof Status)[keyof typeof Status];

export interface User {
  id?: number;
  name?: string;
  status?: Status;
}

export interface Schema {
  Status: typeof Status;
  encodeUser(message: UserInput): Uint8Array;
  decodeUser(buffer: Uint8Array): User;
}
```

[→ Full TypeScript documentation](./ts/README.md)

## Schema Syntax

```protobuf
enum Status {
  PENDING = 0;
  ACTIVE = 1;
  COMPLETED = 2;
}

struct Point {
  float x;
  float y;
}

message User {
  uint id = 1;
  string name = 2;
  Status status = 3;
  Point[] locations = 4;
  map<string, int> metadata = 5;
}
```

## Supported Types

| Type                          | Description                    |
| ----------------------------- | ------------------------------ |
| `bool`, `byte`, `int`, `uint` | Primitive types                |
| `int64`, `uint64`             | 64-bit integers (BigInt)       |
| `float`, `float16`, `double`  | Floating point (16/32/64-bit)  |
| `string`, `bytes`             | Text and binary data           |
| `T[]`, `T[N]`                 | Variable and fixed-size arrays |
| `map<K, V>`                   | Key-value maps                 |
| `enum`, `struct`, `message`   | User-defined types             |

## Resources

- [**Interactive Demo**](https://aliadelelroby.github.io/zephyr/) — Try Zephyr in your browser
- [**npm Package**](https://www.npmjs.com/package/zephyr-schema) — Install via npm
- [**TypeScript Docs**](./ts/README.md) — Full API documentation
- [**Examples**](./examples/) — TypeScript, C++, and more

## License

MIT © [Ali Adel Elroby](https://github.com/aliadelelroby)
