/**
 * High-performance byte buffer with optimized memory management and encoding features
 */

const int32 = new Int32Array(1);
const float32 = new Float32Array(int32.buffer);
const textDecoder =
  typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
const textEncoder =
  typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
const encoderBuffer = new Uint8Array(4096);

/**
 * ByteBuffer provides efficient reading and writing of binary data
 * with support for variable-length encoding, delta encoding, and bit packing
 */
export class ByteBuffer {
  _data: Uint8Array;
  _index: number;
  length: number;
  _bitBuffer: number = 0;
  _bitOffset: number = 0;

  constructor(data?: Uint8Array) {
    if (data && !(data instanceof Uint8Array)) {
      throw new Error("Must initialize a ByteBuffer with a Uint8Array");
    }
    this._data = data || new Uint8Array(512);
    this._index = 0;
    this.length = data ? data.length : 0;
  }

  reset(): void {
    this._index = 0;
    this.length = 0;
    this._bitBuffer = 0;
    this._bitOffset = 0;
  }

  toUint8Array(): Uint8Array {
    return this._data.subarray(0, this.length);
  }

  readByte(): number {
    return this._data[this._index++];
  }

  readByteArray(): Uint8Array {
    const length = this.readVarUint();
    const start = this._index;
    this._index += length;
    const result = new Uint8Array(length);
    result.set(this._data.subarray(start, start + length));
    return result;
  }

  readVarFloat(): number {
    const data = this._data;
    let index = this._index;

    const first = data[index];
    if (first === 0) {
      this._index = index + 1;
      return 0;
    }

    let bits =
      first |
      (data[index + 1] << 8) |
      (data[index + 2] << 16) |
      (data[index + 3] << 24);
    this._index = index + 4;

    bits = (bits << 23) | (bits >>> 9);
    int32[0] = bits;
    return float32[0];
  }

  readVarFloat16(): number {
    const data = this._data;
    const index = this._index;
    const half = data[index] | (data[index + 1] << 8);
    this._index = index + 2;

    const sign = (half >> 15) & 0x1;
    const exp = (half >> 10) & 0x1f;
    const mantissa = half & 0x3ff;

    if (exp === 0) {
      if (mantissa === 0) return sign ? -0.0 : 0.0;
      int32[0] = (sign << 31) | ((exp + 112) << 23) | (mantissa << 13);
      return float32[0];
    } else if (exp === 31) {
      int32[0] = (sign << 31) | 0x7f800000 | (mantissa << 13);
      return float32[0];
    }
    int32[0] = (sign << 31) | ((exp + 112) << 23) | (mantissa << 13);
    return float32[0];
  }

  readVarUint(): number {
    const data = this._data;
    let index = this._index;
    let byte = data[index++];
    let value = byte & 127;

    if (byte < 128) {
      this._index = index;
      return value;
    }

    byte = data[index++];
    value |= (byte & 127) << 7;
    if (byte < 128) {
      this._index = index;
      return value;
    }

    byte = data[index++];
    value |= (byte & 127) << 14;
    if (byte < 128) {
      this._index = index;
      return value;
    }

    byte = data[index++];
    value |= (byte & 127) << 21;
    if (byte < 128) {
      this._index = index;
      return value;
    }

    byte = data[index++];
    value |= (byte & 15) << 28;
    this._index = index;
    return value >>> 0;
  }

  readVarInt(): number {
    const value = this.readVarUint() | 0;
    return value & 1 ? ~(value >>> 1) : value >>> 1;
  }

  readVarUint64(): bigint {
    let value = BigInt(0);
    let shift = BigInt(0);
    const seven = BigInt(7);
    let byte: number;
    while ((byte = this._data[this._index++]) & 128 && shift < 56) {
      value |= BigInt(byte & 127) << shift;
      shift += seven;
    }
    value |= BigInt(byte) << shift;
    return value;
  }

  readVarInt64(): bigint {
    const value = this.readVarUint64();
    const one = BigInt(1);
    return value & one ? ~(value >> one) : value >> one;
  }

  readString(): string {
    const length = this.readVarUint();
    if (length === 0) return "";

    const start = this._index;
    this._index += length;

    if (textDecoder) {
      return textDecoder.decode(this._data.subarray(start, start + length));
    }

    let result = "";
    const data = this._data;
    let i = start;
    const end = start + length;

    while (i < end) {
      const a = data[i++];
      let codePoint: number;

      if (a < 0xc0) {
        codePoint = a;
      } else if (a < 0xe0) {
        codePoint = ((a & 0x1f) << 6) | (data[i++] & 0x3f);
      } else if (a < 0xf0) {
        codePoint =
          ((a & 0x0f) << 12) | ((data[i++] & 0x3f) << 6) | (data[i++] & 0x3f);
      } else {
        codePoint =
          ((a & 0x07) << 18) |
          ((data[i++] & 0x3f) << 12) |
          ((data[i++] & 0x3f) << 6) |
          (data[i++] & 0x3f);
      }

      if (codePoint < 0x10000) {
        result += String.fromCharCode(codePoint);
      } else {
        codePoint -= 0x10000;
        result += String.fromCharCode(
          (codePoint >> 10) + 0xd800,
          (codePoint & 0x3ff) + 0xdc00
        );
      }
    }

    return result;
  }

  readVarIntDelta(last: number): number {
    return last + this.readVarInt();
  }

  readBits(bitCount: number): number {
    if (this._bitOffset === 0) {
      this._bitBuffer = this._data[this._index++];
    }
    const mask = (1 << bitCount) - 1;
    const result = (this._bitBuffer >> this._bitOffset) & mask;
    this._bitOffset += bitCount;
    if (this._bitOffset >= 8) {
      this._bitOffset = 0;
    }
    return result;
  }

  private _grow(minCapacity: number): void {
    let capacity = this._data.length;
    while (capacity < minCapacity) {
      capacity *= 2;
    }
    const newData = new Uint8Array(capacity);
    newData.set(this._data);
    this._data = newData;
  }

  writeByte(value: number): void {
    if (this.length >= this._data.length) {
      this._grow(this.length + 1);
    }
    this._data[this.length++] = value;
  }

  writeBytes(values: Uint8Array, count: number): void {
    const newLength = this.length + count;
    if (newLength > this._data.length) {
      this._grow(newLength);
    }
    this._data.set(values.subarray(0, count), this.length);
    this.length = newLength;
  }

  writeByteArray(value: Uint8Array): void {
    this.writeVarUint(value.length);
    const newLength = this.length + value.length;
    if (newLength > this._data.length) {
      this._grow(newLength);
    }
    this._data.set(value, this.length);
    this.length = newLength;
  }

  writeVarFloat(value: number): void {
    float32[0] = value;
    let bits = int32[0];
    bits = (bits >>> 23) | (bits << 9);

    if ((bits & 255) === 0) {
      this.writeByte(0);
      return;
    }

    const index = this.length;
    const newLength = index + 4;
    if (newLength > this._data.length) {
      this._grow(newLength);
    }
    const data = this._data;
    data[index] = bits;
    data[index + 1] = bits >> 8;
    data[index + 2] = bits >> 16;
    data[index + 3] = bits >> 24;
    this.length = newLength;
  }

  readDouble(): number {
    const view = new DataView(
      this._data.buffer,
      this._data.byteOffset + this._index
    );
    const value = view.getFloat64(0, true);
    this._index += 8;
    return value;
  }

  writeVarFloat16(value: number): void {
    float32[0] = value;
    const bits = int32[0];

    const sign = (bits >> 31) & 0x1;
    const exp = (bits >> 23) & 0xff;
    const mantissa = (bits >> 13) & 0x3ff;

    let half: number;
    if (exp === 0) {
      half = sign << 15;
    } else if (exp === 255) {
      half = (sign << 15) | 0x7c00 | mantissa;
    } else {
      let expHalf = exp - 112;
      if (expHalf < 0) expHalf = 0;
      else if (expHalf > 31) expHalf = 31;
      half = (sign << 15) | (expHalf << 10) | mantissa;
    }

    const index = this.length;
    const newLength = index + 2;
    if (newLength > this._data.length) {
      this._grow(newLength);
    }
    this._data[index] = half & 0xff;
    this._data[index + 1] = (half >> 8) & 0xff;
    this.length = newLength;
  }

  writeVarUint(value: number): void {
    if (value < 128) {
      this.writeByte(value);
      return;
    }

    const data = this._data;
    let index = this.length;

    if (index + 5 > data.length) {
      this._grow(index + 5);
    }

    const d = this._data;
    while (value >= 128) {
      d[index++] = (value & 127) | 128;
      value >>>= 7;
    }
    d[index++] = value;
    this.length = index;
  }

  writeVarInt(value: number): void {
    this.writeVarUint(((value << 1) ^ (value >> 31)) >>> 0);
  }

  writeVarUint64(value: bigint | string): void {
    if (typeof value === "string") value = BigInt(value);
    const mask = BigInt(127);
    const seven = BigInt(7);
    for (let i = 0; value > mask && i < 8; i++) {
      this.writeByte(Number(value & mask) | 128);
      value >>= seven;
    }
    this.writeByte(Number(value));
  }

  writeVarInt64(value: bigint | string): void {
    if (typeof value === "string") value = BigInt(value);
    const one = BigInt(1);
    this.writeVarUint64(value < 0 ? ~(value << one) : value << one);
  }

  writeString(value: string): void {
    const len = value.length;
    if (len === 0) {
      this.writeByte(0);
      return;
    }

    // Fast path: check if string is ASCII (most common case)
    let isAscii = true;
    for (let i = 0; i < len; i++) {
      if (value.charCodeAt(i) >= 128) {
        isAscii = false;
        break;
      }
    }

    if (isAscii) {
      // ASCII: byteLength === string length, single pass write
      this.writeVarUint(len);
      const newLength = this.length + len;
      if (newLength > this._data.length) {
        this._grow(newLength);
      }
      const data = this._data;
      let pos = this.length;
      for (let i = 0; i < len; i++) {
        data[pos++] = value.charCodeAt(i);
      }
      this.length = newLength;
      return;
    }

    // Non-ASCII: use TextEncoder for efficiency
    if (textEncoder) {
      const result = textEncoder.encodeInto(value, encoderBuffer);
      const byteLength = result.written!;
      this.writeVarUint(byteLength);
      const newLength = this.length + byteLength;
      if (newLength > this._data.length) {
        this._grow(newLength);
      }
      this._data.set(encoderBuffer.subarray(0, byteLength), this.length);
      this.length = newLength;
      return;
    }

    // Fallback: manual UTF-8 encoding
    let byteLength = 0;
    for (let i = 0; i < len; i++) {
      const c = value.charCodeAt(i);
      if (c < 0x80) byteLength += 1;
      else if (c < 0x800) byteLength += 2;
      else if (c < 0xd800 || c >= 0xe000) byteLength += 3;
      else {
        byteLength += 4;
        i++;
      }
    }

    this.writeVarUint(byteLength);

    const newLength = this.length + byteLength;
    if (newLength > this._data.length) {
      this._grow(newLength);
    }

    const data = this._data;
    let pos = this.length;
    for (let i = 0; i < len; i++) {
      let c = value.charCodeAt(i);
      if (c < 0x80) {
        data[pos++] = c;
      } else if (c < 0x800) {
        data[pos++] = ((c >> 6) & 0x1f) | 0xc0;
        data[pos++] = (c & 0x3f) | 0x80;
      } else if (c < 0xd800 || c >= 0xe000) {
        data[pos++] = ((c >> 12) & 0x0f) | 0xe0;
        data[pos++] = ((c >> 6) & 0x3f) | 0x80;
        data[pos++] = (c & 0x3f) | 0x80;
      } else {
        const c2 = value.charCodeAt(++i);
        const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        data[pos++] = ((cp >> 18) & 0x07) | 0xf0;
        data[pos++] = ((cp >> 12) & 0x3f) | 0x80;
        data[pos++] = ((cp >> 6) & 0x3f) | 0x80;
        data[pos++] = (cp & 0x3f) | 0x80;
      }
    }
    this.length = newLength;
  }

  writeDouble(value: number): void {
    const newLength = this.length + 8;
    if (newLength > this._data.length) {
      this._grow(newLength);
    }
    const view = new DataView(
      this._data.buffer,
      this._data.byteOffset + this.length
    );
    view.setFloat64(0, value, true);
    this.length = newLength;
  }

  writeVarIntDelta(value: number, last: number): number {
    this.writeVarInt(value - last);
    return value;
  }

  writeBits(value: number, bitCount: number): void {
    const mask = (1 << bitCount) - 1;
    this._bitBuffer |= (value & mask) << this._bitOffset;
    this._bitOffset += bitCount;

    if (this._bitOffset >= 8) {
      this.writeByte(this._bitBuffer);
      this._bitBuffer = 0;
      this._bitOffset = 0;
    }
  }

  flushBits(): void {
    if (this._bitOffset > 0) {
      this.writeByte(this._bitBuffer);
      this._bitBuffer = 0;
      this._bitOffset = 0;
    }
  }
}
