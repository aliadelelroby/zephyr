# Zephyr demo: C++

## Basic Usage

```cpp
#include "zephyr.h"
#define IMPLEMENT_ZEPHYR_H
#include "zephyr.h"

using namespace zephyr;

// Encoding
ByteBuffer buffer;
buffer.writeVarUint(123);
buffer.writeString("Hello, Zephyr!");
buffer.writeVarFloat(3.14159f);

uint8_t *data = buffer.data();
size_t size = buffer.size();

// Decoding
ByteBuffer reader(data, size);
uint32_t number;
reader.readVarUint(number);

const char *text;
size_t textLength;
reader.readString(text, textLength);

float pi;
reader.readVarFloat(pi);
```

## Delta Encoding

```cpp
#include "zephyr.h"

// Encoding with delta compression
ByteBuffer buffer;
std::vector<int32_t> numbers = {100, 101, 102, 103, 104, 105};

buffer.writeVarUint(numbers.size());
int32_t last = 0;
for (int32_t num : numbers) {
  buffer.writeVarIntDelta(num, last);
}

// Decoding
ByteBuffer reader(buffer.data(), buffer.size());
uint32_t count;
reader.readVarUint(count);

std::vector<int32_t> decoded;
int32_t lastValue = 0;
for (uint32_t i = 0; i < count; i++) {
  int32_t value;
  reader.readVarIntDelta(value, lastValue);
  decoded.push_back(value);
}
```

## Bit Packing

```cpp
#include "zephyr.h"

// Encoding
ByteBuffer buffer;
std::vector<bool> flags = {true, false, true, true, false, false, true, false};

buffer.writeVarUint(flags.size());
for (bool flag : flags) {
  buffer.writeBits(flag ? 1 : 0, 1);
}

// Decoding
ByteBuffer reader(buffer.data(), buffer.size());
uint32_t count;
reader.readVarUint(count);

std::vector<bool> decoded;
for (uint32_t i = 0; i < count; i++) {
  uint8_t bit;
  reader.readBits(bit, 1);
  decoded.push_back(bit != 0);
}
```

## Memory Pool Usage

```cpp
#include "zephyr.h"

MemoryPool pool;
ByteBuffer buffer;

// Read string into memory pool
String str;
buffer.readString(str, pool);

// Use string
const char *cstr = str.c_str();
size_t len = str.length();
```
