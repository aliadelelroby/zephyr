#ifndef ZEPHYR_H
#define ZEPHYR_H

#include <assert.h>
#include <initializer_list>
#include <memory.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

namespace zephyr {
  class String;
  class MemoryPool;

  /**
   * High-performance byte buffer with optimized memory management
   */
  class ByteBuffer {
  public:
    ByteBuffer();
    ByteBuffer(uint8_t *data, size_t size);
    ByteBuffer(const uint8_t *data, size_t size);
    ~ByteBuffer();
    ByteBuffer(const ByteBuffer &) = delete;
    ByteBuffer &operator = (const ByteBuffer &) = delete;

    uint8_t *data() const { return _data; }
    size_t size() const { return _size; }
    size_t index() const { return _index; }

    // Reading primitives
    bool readByte(bool &result);
    bool readByte(uint8_t &result);
    bool readVarFloat(float &result);
    bool readVarFloat16(float &result);
    bool readDouble(double &result);
    bool readVarUint(uint32_t &result);
    bool readVarInt(int32_t &result);
    bool readString(const char *&result, size_t &length);
    bool readString(String &result, MemoryPool &pool);
    bool readBytes(uint8_t *&result, size_t &length);
    bool readVarUint64(uint64_t &result);
    bool readVarInt64(int64_t &result);

    // Writing primitives
    void writeByte(uint8_t value);
    void writeVarFloat(float value);
    void writeVarFloat16(float value);
    void writeDouble(double value);
    void writeVarUint(uint32_t value);
    void writeVarInt(int32_t value);
    void writeString(const char *value, size_t length);
    void writeString(const char *value);
    void writeBytes(const uint8_t *value, size_t length);
    void writeVarUint64(uint64_t value);
    void writeVarInt64(int64_t value);

    // Delta encoding helpers
    void writeVarIntDelta(int32_t value, int32_t &last);
    bool readVarIntDelta(int32_t &result, int32_t &last);

    // Bit packing helpers
    void writeBits(uint8_t value, uint8_t bitCount);
    bool readBits(uint8_t &result, uint8_t bitCount);

  private:
    void _growBy(size_t amount);
    void _ensureCapacity(size_t capacity);

    enum { INITIAL_CAPACITY = 256, GROWTH_FACTOR = 2 };
    uint8_t *_data = nullptr;
    size_t _size = 0;
    size_t _capacity = 0;
    size_t _index = 0;
    bool _ownsData = false;
    bool _isConst = false;
    
    // Bit packing state
    uint8_t _bitBuffer = 0;
    uint8_t _bitOffset = 0;
  };

  ////////////////////////////////////////////////////////////////////////////////

  class String {
  public:
    String() {}
    explicit String(const char *c_str, size_t length) : _c_str(c_str), _length(length) {}
    explicit String(const char *c_str) : _c_str(c_str), _length(strlen(c_str)) {}

    const char *c_str() const { return _c_str; }
    size_t length() const { return _length; }

  private:
    const char *_c_str = nullptr;
    size_t _length = 0;
  };

  inline bool operator == (const String &a, const String &b) {
    return a.length() == b.length() && !memcmp(a.c_str(), b.c_str(), a.length());
  }
  inline bool operator != (const String &a, const String &b) { return !(a == b); }

  ////////////////////////////////////////////////////////////////////////////////

  template <typename T>
  class Array {
  public:
    Array() {}
    Array(T *data, uint32_t size) : _data(data), _size(size) {}

    T *data() { return _data; }
    T *begin() { return _data; }
    T *end() { return _data + _size; }
    uint32_t size() const { return _size; }
    T &operator [] (uint32_t index) { assert(index < _size); return _data[index]; }
    void set(const T *data, size_t size) { assert(size == _size); memcpy(_data, data, (size < _size ? size : _size) * sizeof(T)); }
    void set(const std::initializer_list<T> &data) { set(data.begin(), data.size()); }

    const T *data() const { return _data; }
    const T *begin() const { return _data; }
    const T *end() const { return _data + _size; }
    const T &operator [] (uint32_t index) const { assert(index < _size); return _data[index]; }

  private:
    T *_data = nullptr;
    uint32_t _size = 0;
  };

  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Efficient memory pool with chunk-based allocation
   */
  class MemoryPool {
  public:
    MemoryPool() {}
    ~MemoryPool() { clear(); }
    MemoryPool(const MemoryPool &) = delete;
    MemoryPool &operator = (const MemoryPool &) = delete;

    void clear();

    template <typename T>
    T *allocate(uint32_t count = 1);

    template <typename T>
    Array<T> array(uint32_t size) { return Array<T>(allocate<T>(size), size); }

    String string(const char *data, uint32_t count);
    String string(const char *c_str) { return string(c_str, strlen(c_str)); }

  private:
    enum { INITIAL_CAPACITY = 1 << 14 }; // Larger initial chunk for better performance

    struct Chunk {
      uint8_t *data = nullptr;
      uint32_t capacity = 0;
      uint32_t used = 0;
      Chunk *next = nullptr;
    };

    Chunk *_first = nullptr;
    Chunk *_last = nullptr;
  };

  ////////////////////////////////////////////////////////////////////////////////

  class BinarySchema {
  public:
    bool parse(ByteBuffer &bb);
    bool findDefinition(const char *definition, uint32_t &index) const;
    bool skipField(ByteBuffer &bb, uint32_t definition, uint32_t field) const;

  private:
    enum {
      TYPE_BOOL = -1,
      TYPE_BYTE = -2,
      TYPE_INT = -3,
      TYPE_UINT = -4,
      TYPE_FLOAT = -5,
      TYPE_FLOAT16 = -6,
      TYPE_DOUBLE = -7,
      TYPE_STRING = -8,
      TYPE_BYTES = -9,
      TYPE_INT64 = -10,
      TYPE_UINT64 = -11,
    };

    struct Field {
      String name;
      int32_t type = 0;
      bool isArray = false;
      bool isFixedArray = false;
      bool isMap = false;
      uint32_t arraySize = 0; // For fixed arrays
      int32_t keyType = 0; // For maps
      uint32_t value = 0;
    };

    enum {
      KIND_ENUM = 0,
      KIND_STRUCT = 1,
      KIND_MESSAGE = 2,
    };

    struct Definition {
      String name;
      uint8_t kind = 0;
      Array<Field> fields;
    };

    bool _skipField(ByteBuffer &bb, const Field &field) const;

    MemoryPool _pool;
    Array<Definition> _definitions;
  };
}

#endif

#ifdef IMPLEMENT_ZEPHYR_H
#ifndef IMPLEMENT_ZEPHYR_H_
#define IMPLEMENT_ZEPHYR_H_

  zephyr::ByteBuffer::ByteBuffer() : _data(new uint8_t[INITIAL_CAPACITY]), _capacity(INITIAL_CAPACITY), _ownsData(true) {
  }

  zephyr::ByteBuffer::ByteBuffer(uint8_t *data, size_t size) : _data(data), _size(size), _capacity(size) {
  }

  zephyr::ByteBuffer::ByteBuffer(const uint8_t *data, size_t size) : _data(const_cast<uint8_t *>(data)), _size(size), _capacity(size), _isConst(true) {
    (void)_isConst;
  }

  zephyr::ByteBuffer::~ByteBuffer() {
    if (_ownsData) {
      delete [] _data;
    }
  }

  void zephyr::ByteBuffer::_ensureCapacity(size_t capacity) {
    if (capacity > _capacity) {
      size_t newCapacity = capacity * GROWTH_FACTOR;
      uint8_t *data = new uint8_t[newCapacity];
      memcpy(data, _data, _size);

      if (_ownsData) {
        delete [] _data;
      }

      _data = data;
      _capacity = newCapacity;
      _ownsData = true;
    }
  }

  void zephyr::ByteBuffer::_growBy(size_t amount) {
    assert(!_isConst);
    _ensureCapacity(_size + amount);
    _size += amount;
  }

  bool zephyr::ByteBuffer::readByte(bool &result) {
    uint8_t value;
    if (!readByte(value)) {
      result = false;
      return false;
    }
    result = value != 0;
    return true;
  }

  bool zephyr::ByteBuffer::readByte(uint8_t &result) {
    if (_index >= _size) {
      result = 0;
      return false;
    }
    result = _data[_index];
    _index++;
    return true;
  }

  bool zephyr::ByteBuffer::readVarFloat(float &result) {
    uint8_t first;
    if (!readByte(first)) {
      return false;
    }

    if (first == 0) {
      result = 0;
      return true;
    }

    if (_index + 3 > _size) {
      result = 0;
      return false;
    }
    uint32_t bits = first | (_data[_index] << 8) | (_data[_index + 1] << 16) | (_data[_index + 2] << 24);
    _index += 3;

    bits = (bits << 23) | (bits >> 9);
    memcpy(&result, &bits, 4);
    return true;
  }

  bool zephyr::ByteBuffer::readVarFloat16(float &result) {
    if (_index + 2 > _size) {
      result = 0;
      return false;
    }

    uint16_t half = _data[_index] | (_data[_index + 1] << 8);
    _index += 2;

    // Convert half-precision to single-precision
    uint32_t sign = (half >> 15) & 0x1;
    uint32_t exp = (half >> 10) & 0x1F;
    uint32_t mantissa = half & 0x3FF;

    if (exp == 0) {
      if (mantissa == 0) {
        result = sign ? -0.0f : 0.0f;
      } else {
        // Denormalized
        uint32_t bits = (sign << 31) | ((exp + 112) << 23) | (mantissa << 13);
        memcpy(&result, &bits, 4);
      }
    } else if (exp == 31) {
      // Infinity or NaN
      uint32_t bits = (sign << 31) | 0x7F800000 | (mantissa << 13);
      memcpy(&result, &bits, 4);
    } else {
      uint32_t bits = (sign << 31) | ((exp + 112) << 23) | (mantissa << 13);
      memcpy(&result, &bits, 4);
    }
    return true;
  }

  bool zephyr::ByteBuffer::readDouble(double &result) {
    if (_index + 8 > _size) {
      result = 0;
      return false;
    }
    memcpy(&result, _data + _index, 8);
    _index += 8;
    return true;
  }

  bool zephyr::ByteBuffer::readVarUint(uint32_t &result) {
    uint8_t shift = 0;
    uint8_t byte;
    result = 0;

    do {
      if (!readByte(byte)) {
        return false;
      }
      result |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128 && shift < 35);

    return true;
  }

  bool zephyr::ByteBuffer::readVarInt(int32_t &result) {
    uint32_t value;
    if (!readVarUint(value)) {
      result = 0;
      return false;
    }
    result = value & 1 ? ~(value >> 1) : value >> 1;
    return true;
  }

  bool zephyr::ByteBuffer::readString(const char *&result, size_t &length) {
    uint32_t len;
    if (!readVarUint(len)) {
      return false;
    }
    if (_index + len > _size) {
      return false;
    }
    result = reinterpret_cast<const char *>(_data + _index);
    length = len;
    _index += len;
    return true;
  }

  bool zephyr::ByteBuffer::readString(String &result, MemoryPool &pool) {
    uint32_t length;
    if (!readVarUint(length)) {
      return false;
    }
    if (_index + length > _size) {
      return false;
    }
    result = pool.string(reinterpret_cast<const char *>(_data + _index), length);
    _index += length;
    return true;
  }

  bool zephyr::ByteBuffer::readBytes(uint8_t *&result, size_t &length) {
    uint32_t len;
    if (!readVarUint(len)) {
      return false;
    }
    if (_index + len > _size) {
      return false;
    }
    result = _data + _index;
    length = len;
    _index += len;
    return true;
  }

  bool zephyr::ByteBuffer::readVarUint64(uint64_t &result) {
    uint8_t shift = 0;
    uint8_t byte;
    result = 0;

    while (true) {
      if (!readByte(byte)) {
        return false;
      }
      if (!(byte & 128) || shift >= 56) {
        break;
      }
      result |= (uint64_t)(byte & 127) << shift;
      shift += 7;
    }

    result |= (uint64_t)(byte) << shift;
    return true;
  }

  bool zephyr::ByteBuffer::readVarInt64(int64_t &result) {
    uint64_t value;
    if (!readVarUint64(value)) {
      result = 0;
      return false;
    }
    result = value & 1 ? ~(value >> 1) : value >> 1;
    return true;
  }

  bool zephyr::ByteBuffer::readVarIntDelta(int32_t &result, int32_t &last) {
    int32_t delta;
    if (!readVarInt(delta)) {
      return false;
    }
    last += delta;
    result = last;
    return true;
  }

  bool zephyr::ByteBuffer::readBits(uint8_t &result, uint8_t bitCount) {
    assert(bitCount <= 8);
    if (_bitOffset == 0) {
      if (!readByte(_bitBuffer)) {
        return false;
      }
    }

    uint8_t mask = (1 << bitCount) - 1;
    result = (_bitBuffer >> _bitOffset) & mask;
    _bitOffset += bitCount;

    if (_bitOffset >= 8) {
      _bitOffset = 0;
    }
    return true;
  }

  void zephyr::ByteBuffer::writeByte(uint8_t value) {
    assert(!_isConst);
    size_t index = _size;
    _growBy(1);
    _data[index] = value;
  }

  void zephyr::ByteBuffer::writeVarFloat(float value) {
    assert(!_isConst);

    uint32_t bits;
    memcpy(&bits, &value, 4);

    bits = (bits >> 23) | (bits << 9);

    if ((bits & 255) == 0) {
      writeByte(0);
      return;
    }

    size_t index = _size;
    _growBy(4);
    _data[index] = bits;
    _data[index + 1] = bits >> 8;
    _data[index + 2] = bits >> 16;
    _data[index + 3] = bits >> 24;
  }

  void zephyr::ByteBuffer::writeVarFloat16(float value) {
    assert(!_isConst);

    uint32_t bits;
    memcpy(&bits, &value, 4);

    uint32_t sign = (bits >> 31) & 0x1;
    uint32_t exp = (bits >> 23) & 0xFF;
    uint32_t mantissa = (bits >> 13) & 0x3FF;

    if (exp == 0) {
      // Zero or denormalized
      uint16_t half = sign << 15;
      size_t index = _size;
      _growBy(2);
      _data[index] = half;
      _data[index + 1] = half >> 8;
      return;
    }

    if (exp == 255) {
      // Infinity or NaN
      uint16_t half = (sign << 15) | 0x7C00 | mantissa;
      size_t index = _size;
      _growBy(2);
      _data[index] = half;
      _data[index + 1] = half >> 8;
      return;
    }

    int32_t expHalf = (int32_t)exp - 112;
    if (expHalf < 0) {
      expHalf = 0;
    } else if (expHalf > 31) {
      expHalf = 31;
    }

    uint16_t half = (sign << 15) | (expHalf << 10) | mantissa;
    size_t index = _size;
    _growBy(2);
    _data[index] = half;
    _data[index + 1] = half >> 8;
  }

  void zephyr::ByteBuffer::writeDouble(double value) {
    assert(!_isConst);
    size_t index = _size;
    _growBy(8);
    memcpy(_data + index, &value, 8);
  }

  void zephyr::ByteBuffer::writeVarUint(uint32_t value) {
    assert(!_isConst);
    do {
      uint8_t byte = value & 127;
      value >>= 7;
      writeByte(value ? byte | 128 : byte);
    } while (value);
  }

  void zephyr::ByteBuffer::writeVarInt(int32_t value) {
    assert(!_isConst);
    writeVarUint((value << 1) ^ (value >> 31));
  }

  void zephyr::ByteBuffer::writeVarUint64(uint64_t value) {
    assert(!_isConst);
    for (int i = 0; value > 127 && i < 8; i++) {
      writeByte((value & 127) | 128);
      value >>= 7;
    }
    writeByte(value);
  }

  void zephyr::ByteBuffer::writeVarInt64(int64_t value) {
    assert(!_isConst);
    writeVarUint64((value << 1) ^ (value >> 63));
  }

  void zephyr::ByteBuffer::writeString(const char *value, size_t length) {
    assert(!_isConst);
    writeVarUint(length);
    size_t index = _size;
    _growBy(length);
    memcpy(_data + index, value, length);
  }

  void zephyr::ByteBuffer::writeString(const char *value) {
    writeString(value, strlen(value));
  }

  void zephyr::ByteBuffer::writeBytes(const uint8_t *value, size_t length) {
    assert(!_isConst);
    writeVarUint(length);
    size_t index = _size;
    _growBy(length);
    memcpy(_data + index, value, length);
  }

  void zephyr::ByteBuffer::writeVarIntDelta(int32_t value, int32_t &last) {
    int32_t delta = value - last;
    writeVarInt(delta);
    last = value;
  }

  void zephyr::ByteBuffer::writeBits(uint8_t value, uint8_t bitCount) {
    assert(!_isConst);
    assert(bitCount <= 8);
    assert(value < (1 << bitCount));

    uint8_t mask = (1 << bitCount) - 1;
    _bitBuffer |= (value & mask) << _bitOffset;
    _bitOffset += bitCount;

    if (_bitOffset >= 8) {
      writeByte(_bitBuffer);
      _bitBuffer = 0;
      _bitOffset = 0;
    }
  }

  ////////////////////////////////////////////////////////////////////////////////

  void zephyr::MemoryPool::clear() {
    for (Chunk *chunk = _first, *next; chunk; chunk = next) {
      next = chunk->next;
      delete [] chunk->data;
      delete chunk;
    }
    _first = _last = nullptr;
  }

  template <typename T>
  T *zephyr::MemoryPool::allocate(uint32_t count) {
    Chunk *chunk = _last;
    uint32_t size = count * sizeof(T);
    uint32_t index = (chunk ? chunk->used : 0) + alignof(T) - 1;
    index -= index % alignof(T);

    if (chunk && index + size >= index && index + size <= chunk->capacity) {
      chunk->used = index + size;
      return reinterpret_cast<T *>(chunk->data + index);
    }

    chunk = new Chunk;
    chunk->capacity = size > INITIAL_CAPACITY ? size : INITIAL_CAPACITY;
    chunk->data = new uint8_t[chunk->capacity]();
    chunk->used = size;

    if (_last) _last->next = chunk;
    else _first = chunk;
    _last = chunk;

    return reinterpret_cast<T *>(chunk->data);
  }

  zephyr::String zephyr::MemoryPool::string(const char *text, uint32_t count) {
    char *c_str = allocate<char>(count + 1);
    memcpy(c_str, text, count);
    c_str[count] = '\0';
    return String(c_str, count);
  }

  ////////////////////////////////////////////////////////////////////////////////

  bool zephyr::BinarySchema::parse(ByteBuffer &bb) {
    uint32_t definitionCount = 0;

    _definitions = {};
    _pool.clear();

    if (!bb.readVarUint(definitionCount)) {
      return false;
    }

    _definitions = _pool.array<Definition>(definitionCount);

    for (auto &definition : _definitions) {
      uint32_t fieldCount = 0;

      size_t nameLength;
      const char *namePtr;
      if (!bb.readString(namePtr, nameLength) ||
          !bb.readByte(definition.kind) ||
          !bb.readVarUint(fieldCount) ||
          (definition.kind != KIND_ENUM && definition.kind != KIND_STRUCT && definition.kind != KIND_MESSAGE)) {
        return false;
      }

      definition.name = _pool.string(namePtr, nameLength);
      definition.fields = _pool.array<Field>(fieldCount);

      for (auto &field : definition.fields) {
        size_t fieldNameLength;
        const char *fieldNamePtr;
        if (!bb.readString(fieldNamePtr, fieldNameLength) ||
            !bb.readVarInt(field.type) ||
            !bb.readByte(field.isArray) ||
            !bb.readByte(field.isFixedArray) ||
            !bb.readByte(field.isMap) ||
            !bb.readVarUint(field.value) ||
            field.type < TYPE_UINT64 ||
            field.type >= (int32_t)definitionCount) {
          return false;
        }

        field.name = _pool.string(fieldNamePtr, fieldNameLength);

        if (field.isFixedArray) {
          if (!bb.readVarUint(field.arraySize)) {
            return false;
          }
        }

        if (field.isMap) {
          if (!bb.readVarInt(field.keyType)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  bool zephyr::BinarySchema::findDefinition(const char *definition, uint32_t &index) const {
    for (uint32_t i = 0; i < _definitions.size(); i++) {
      auto &item = _definitions[i];
      if (item.name == String(definition)) {
        index = i;
        return true;
      }
    }
    index = -1;
    return false;
  }

  bool zephyr::BinarySchema::skipField(ByteBuffer &bb, uint32_t definition, uint32_t field) const {
    if (definition < _definitions.size()) {
      for (auto &item : _definitions[definition].fields) {
        if (item.value == field) {
          return _skipField(bb, item);
        }
      }
    }
    return false;
  }

  bool zephyr::BinarySchema::_skipField(ByteBuffer &bb, const Field &field) const {
    uint32_t count = 1;

    if (field.isArray && !field.isFixedArray) {
      if (!bb.readVarUint(count)) {
        return false;
      }
    } else if (field.isFixedArray) {
      count = field.arraySize;
    }

    if (field.isMap) {
      count = 0;
      uint32_t mapSize;
      if (!bb.readVarUint(mapSize)) {
        return false;
      }
      for (uint32_t i = 0; i < mapSize; i++) {
        // Skip key
        Field keyField;
        keyField.type = field.keyType;
        if (!_skipField(bb, keyField)) {
          return false;
        }
        // Skip value
        Field valueField;
        valueField.type = field.type;
        if (!_skipField(bb, valueField)) {
          return false;
        }
      }
      return true;
    }

    while (count-- > 0) {
      switch (field.type) {
        case TYPE_BOOL:
        case TYPE_BYTE: {
          uint8_t dummy = 0;
          if (!bb.readByte(dummy)) return false;
          break;
        }

        case TYPE_INT:
        case TYPE_UINT: {
          uint32_t dummy = 0;
          if (!bb.readVarUint(dummy)) return false;
          break;
        }

        case TYPE_FLOAT: {
          float dummy = 0;
          if (!bb.readVarFloat(dummy)) return false;
          break;
        }

        case TYPE_FLOAT16: {
          float dummy = 0;
          if (!bb.readVarFloat16(dummy)) return false;
          break;
        }

        case TYPE_DOUBLE: {
          double dummy = 0;
          if (!bb.readDouble(dummy)) return false;
          break;
        }

        case TYPE_STRING: {
          size_t length;
          const char *dummy;
          if (!bb.readString(dummy, length)) return false;
          break;
        }

        case TYPE_BYTES: {
          size_t length;
          uint8_t *dummy;
          if (!bb.readBytes(dummy, length)) return false;
          break;
        }

        case TYPE_INT64:
        case TYPE_UINT64: {
          uint64_t dummy = 0;
          if (!bb.readVarUint64(dummy)) return false;
          break;
        }

        default: {
          assert(field.type >= 0 && (uint32_t)field.type < _definitions.size());
          auto &definition = _definitions[field.type];

          switch (definition.kind) {
            case KIND_ENUM: {
              uint32_t dummy;
              if (!bb.readVarUint(dummy)) return false;
              break;
            }

            case KIND_STRUCT: {
              for (auto &item : definition.fields) {
                if (!_skipField(bb, item)) return false;
              }
              break;
            }

            case KIND_MESSAGE: {
              uint32_t id = 0;
              while (true) {
                if (!bb.readVarUint(id)) return false;
                if (!id) break;
                if (!skipField(bb, field.type, id)) return false;
              }
              break;
            }

            default: {
              assert(false);
              break;
            }
          }
        }
      }
    }

    return true;
  }

#endif
#endif

