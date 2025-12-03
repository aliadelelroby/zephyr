"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// zephyr.ts
var zephyr_exports = {};
__export(zephyr_exports, {
  ByteBuffer: () => ByteBuffer,
  compileSchema: () => compileSchema,
  compileSchemaCPP: () => compileSchemaCPP,
  compileSchemaJS: () => compileSchemaJS,
  compileSchemaTypeScript: () => compileSchemaTypeScript,
  compileSchemaTypeScriptDeclaration: () => compileSchemaTypeScriptDeclaration,
  decodeBinarySchema: () => decodeBinarySchema,
  encodeBinarySchema: () => encodeBinarySchema,
  parseSchema: () => parseSchema,
  prettyPrintSchema: () => prettyPrintSchema
});
module.exports = __toCommonJS(zephyr_exports);

// bb.ts
var int32 = new Int32Array(1);
var float32 = new Float32Array(int32.buffer);
var textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
var textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
var encoderBuffer = new Uint8Array(4096);
var ByteBuffer = class {
  constructor(data) {
    this._bitBuffer = 0;
    this._bitOffset = 0;
    if (data && !(data instanceof Uint8Array)) {
      throw new Error("Must initialize a ByteBuffer with a Uint8Array");
    }
    this._data = data || new Uint8Array(512);
    this._index = 0;
    this.length = data ? data.length : 0;
  }
  reset() {
    this._index = 0;
    this.length = 0;
    this._bitBuffer = 0;
    this._bitOffset = 0;
  }
  toUint8Array() {
    return this._data.subarray(0, this.length);
  }
  readByte() {
    return this._data[this._index++];
  }
  readByteArray() {
    const length = this.readVarUint();
    const start = this._index;
    this._index += length;
    const result = new Uint8Array(length);
    result.set(this._data.subarray(start, start + length));
    return result;
  }
  readVarFloat() {
    const data = this._data;
    let index = this._index;
    const first = data[index];
    if (first === 0) {
      this._index = index + 1;
      return 0;
    }
    let bits = first | data[index + 1] << 8 | data[index + 2] << 16 | data[index + 3] << 24;
    this._index = index + 4;
    bits = bits << 23 | bits >>> 9;
    int32[0] = bits;
    return float32[0];
  }
  readVarFloat16() {
    const data = this._data;
    const index = this._index;
    const half = data[index] | data[index + 1] << 8;
    this._index = index + 2;
    const sign = half >> 15 & 1;
    const exp = half >> 10 & 31;
    const mantissa = half & 1023;
    if (exp === 0) {
      if (mantissa === 0) return sign ? -0 : 0;
      int32[0] = sign << 31 | exp + 112 << 23 | mantissa << 13;
      return float32[0];
    } else if (exp === 31) {
      int32[0] = sign << 31 | 2139095040 | mantissa << 13;
      return float32[0];
    }
    int32[0] = sign << 31 | exp + 112 << 23 | mantissa << 13;
    return float32[0];
  }
  readVarUint() {
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
  readVarInt() {
    const value = this.readVarUint() | 0;
    return value & 1 ? ~(value >>> 1) : value >>> 1;
  }
  readVarUint64() {
    let value = BigInt(0);
    let shift = BigInt(0);
    const seven = BigInt(7);
    let byte;
    while ((byte = this._data[this._index++]) & 128 && shift < 56) {
      value |= BigInt(byte & 127) << shift;
      shift += seven;
    }
    value |= BigInt(byte) << shift;
    return value;
  }
  readVarInt64() {
    const value = this.readVarUint64();
    const one = BigInt(1);
    return value & one ? ~(value >> one) : value >> one;
  }
  readString() {
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
      let codePoint;
      if (a < 192) {
        codePoint = a;
      } else if (a < 224) {
        codePoint = (a & 31) << 6 | data[i++] & 63;
      } else if (a < 240) {
        codePoint = (a & 15) << 12 | (data[i++] & 63) << 6 | data[i++] & 63;
      } else {
        codePoint = (a & 7) << 18 | (data[i++] & 63) << 12 | (data[i++] & 63) << 6 | data[i++] & 63;
      }
      if (codePoint < 65536) {
        result += String.fromCharCode(codePoint);
      } else {
        codePoint -= 65536;
        result += String.fromCharCode(
          (codePoint >> 10) + 55296,
          (codePoint & 1023) + 56320
        );
      }
    }
    return result;
  }
  readVarIntDelta(last) {
    return last + this.readVarInt();
  }
  readBits(bitCount) {
    if (this._bitOffset === 0) {
      this._bitBuffer = this._data[this._index++];
    }
    const mask = (1 << bitCount) - 1;
    const result = this._bitBuffer >> this._bitOffset & mask;
    this._bitOffset += bitCount;
    if (this._bitOffset >= 8) {
      this._bitOffset = 0;
    }
    return result;
  }
  _grow(minCapacity) {
    let capacity = this._data.length;
    while (capacity < minCapacity) {
      capacity *= 2;
    }
    const newData = new Uint8Array(capacity);
    newData.set(this._data);
    this._data = newData;
  }
  writeByte(value) {
    if (this.length >= this._data.length) {
      this._grow(this.length + 1);
    }
    this._data[this.length++] = value;
  }
  writeBytes(values, count) {
    const newLength = this.length + count;
    if (newLength > this._data.length) {
      this._grow(newLength);
    }
    this._data.set(values.subarray(0, count), this.length);
    this.length = newLength;
  }
  writeByteArray(value) {
    this.writeVarUint(value.length);
    const newLength = this.length + value.length;
    if (newLength > this._data.length) {
      this._grow(newLength);
    }
    this._data.set(value, this.length);
    this.length = newLength;
  }
  writeVarFloat(value) {
    float32[0] = value;
    let bits = int32[0];
    bits = bits >>> 23 | bits << 9;
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
  readDouble() {
    const view = new DataView(
      this._data.buffer,
      this._data.byteOffset + this._index
    );
    const value = view.getFloat64(0, true);
    this._index += 8;
    return value;
  }
  writeVarFloat16(value) {
    float32[0] = value;
    const bits = int32[0];
    const sign = bits >> 31 & 1;
    const exp = bits >> 23 & 255;
    const mantissa = bits >> 13 & 1023;
    let half;
    if (exp === 0) {
      half = sign << 15;
    } else if (exp === 255) {
      half = sign << 15 | 31744 | mantissa;
    } else {
      let expHalf = exp - 112;
      if (expHalf < 0) expHalf = 0;
      else if (expHalf > 31) expHalf = 31;
      half = sign << 15 | expHalf << 10 | mantissa;
    }
    const index = this.length;
    const newLength = index + 2;
    if (newLength > this._data.length) {
      this._grow(newLength);
    }
    this._data[index] = half & 255;
    this._data[index + 1] = half >> 8 & 255;
    this.length = newLength;
  }
  writeVarUint(value) {
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
      d[index++] = value & 127 | 128;
      value >>>= 7;
    }
    d[index++] = value;
    this.length = index;
  }
  writeVarInt(value) {
    this.writeVarUint((value << 1 ^ value >> 31) >>> 0);
  }
  writeVarUint64(value) {
    if (typeof value === "string") value = BigInt(value);
    const mask = BigInt(127);
    const seven = BigInt(7);
    for (let i = 0; value > mask && i < 8; i++) {
      this.writeByte(Number(value & mask) | 128);
      value >>= seven;
    }
    this.writeByte(Number(value));
  }
  writeVarInt64(value) {
    if (typeof value === "string") value = BigInt(value);
    const one = BigInt(1);
    this.writeVarUint64(value < 0 ? ~(value << one) : value << one);
  }
  writeString(value) {
    const len = value.length;
    if (len === 0) {
      this.writeByte(0);
      return;
    }
    let isAscii = true;
    for (let i = 0; i < len; i++) {
      if (value.charCodeAt(i) >= 128) {
        isAscii = false;
        break;
      }
    }
    if (isAscii) {
      this.writeVarUint(len);
      const newLength2 = this.length + len;
      if (newLength2 > this._data.length) {
        this._grow(newLength2);
      }
      const data2 = this._data;
      let pos2 = this.length;
      for (let i = 0; i < len; i++) {
        data2[pos2++] = value.charCodeAt(i);
      }
      this.length = newLength2;
      return;
    }
    if (textEncoder) {
      const result = textEncoder.encodeInto(value, encoderBuffer);
      const byteLength2 = result.written;
      this.writeVarUint(byteLength2);
      const newLength2 = this.length + byteLength2;
      if (newLength2 > this._data.length) {
        this._grow(newLength2);
      }
      this._data.set(encoderBuffer.subarray(0, byteLength2), this.length);
      this.length = newLength2;
      return;
    }
    let byteLength = 0;
    for (let i = 0; i < len; i++) {
      const c = value.charCodeAt(i);
      if (c < 128) byteLength += 1;
      else if (c < 2048) byteLength += 2;
      else if (c < 55296 || c >= 57344) byteLength += 3;
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
      if (c < 128) {
        data[pos++] = c;
      } else if (c < 2048) {
        data[pos++] = c >> 6 & 31 | 192;
        data[pos++] = c & 63 | 128;
      } else if (c < 55296 || c >= 57344) {
        data[pos++] = c >> 12 & 15 | 224;
        data[pos++] = c >> 6 & 63 | 128;
        data[pos++] = c & 63 | 128;
      } else {
        const c2 = value.charCodeAt(++i);
        const cp = 65536 + ((c & 1023) << 10) + (c2 & 1023);
        data[pos++] = cp >> 18 & 7 | 240;
        data[pos++] = cp >> 12 & 63 | 128;
        data[pos++] = cp >> 6 & 63 | 128;
        data[pos++] = cp & 63 | 128;
      }
    }
    this.length = newLength;
  }
  writeDouble(value) {
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
  writeVarIntDelta(value, last) {
    this.writeVarInt(value - last);
    return value;
  }
  writeBits(value, bitCount) {
    const mask = (1 << bitCount) - 1;
    this._bitBuffer |= (value & mask) << this._bitOffset;
    this._bitOffset += bitCount;
    if (this._bitOffset >= 8) {
      this.writeByte(this._bitBuffer);
      this._bitBuffer = 0;
      this._bitOffset = 0;
    }
  }
  flushBits() {
    if (this._bitOffset > 0) {
      this.writeByte(this._bitBuffer);
      this._bitBuffer = 0;
      this._bitOffset = 0;
    }
  }
};

// util.ts
function quote(text) {
  return JSON.stringify(text);
}
function error(text, line, column) {
  const err = new Error(text);
  err.line = line;
  err.column = column;
  throw err;
}

// js.ts
function compileInlineReadCode(field, definitions) {
  switch (field.type) {
    case "bool":
      return "!!bb.readByte()";
    case "byte":
      return "bb.readByte()";
    case "int":
      return "bb.readVarInt()";
    case "uint":
      return "bb.readVarUint()";
    case "float":
      return "bb.readVarFloat()";
    case "float16":
      return "bb.readVarFloat16()";
    case "double":
      return "bb.readDouble()";
    case "string":
      return "bb.readString()";
    case "bytes":
      return "bb.readByteArray()";
    case "int64":
      return "bb.readVarInt64()";
    case "uint64":
      return "bb.readVarUint64()";
    default: {
      const def = definitions[field.type];
      if (!def) {
        throw new Error("Invalid type " + quote(field.type));
      } else if (def.kind === "ENUM") {
        return "this[" + quote(def.name) + "][bb.readVarUint()]";
      } else if (def.kind === "STRUCT") {
        return "this[" + quote("decode" + def.name) + "](bb)";
      } else {
        return "this[" + quote("decodeInline" + def.name) + "](bb)";
      }
    }
  }
}
function compileInlineWriteCode(field, definitions) {
  switch (field.type) {
    case "bool":
      return "bb.writeByte(value);";
    case "byte":
      return "bb.writeByte(value);";
    case "int":
      return "bb.writeVarInt(value);";
    case "uint":
      return "bb.writeVarUint(value);";
    case "float":
      return "bb.writeVarFloat(value);";
    case "float16":
      return "bb.writeVarFloat16(value);";
    case "double":
      return "bb.writeDouble(value);";
    case "string":
      return "bb.writeString(value);";
    case "bytes":
      return "bb.writeByteArray(value);";
    case "int64":
      return "bb.writeVarInt64(value);";
    case "uint64":
      return "bb.writeVarUint64(value);";
    default: {
      const def = definitions[field.type];
      if (!def) {
        throw new Error("Invalid type " + quote(field.type));
      } else if (def.kind === "ENUM") {
        return "var encoded = this[" + quote(def.name) + "][value]; if (encoded === void 0) throw new Error(" + quote("Invalid value ") + " + JSON.stringify(value) + " + quote(" for enum " + quote(def.name)) + "); bb.writeVarUint(encoded);";
      } else if (def.kind === "STRUCT") {
        return "this[" + quote("encode" + def.name) + "](value, bb);";
      } else {
        return "bb.writeVarUint(1); this[" + quote("encodeInline" + def.name) + "](value, bb);";
      }
    }
  }
}
function compileReadCodeForType(type, definitions) {
  switch (type) {
    case "bool":
      return "!!bb.readByte()";
    case "byte":
      return "bb.readByte()";
    case "int":
      return "bb.readVarInt()";
    case "uint":
      return "bb.readVarUint()";
    case "float":
      return "bb.readVarFloat()";
    case "float16":
      return "bb.readVarFloat16()";
    case "double":
      return "bb.readDouble()";
    case "string":
      return "bb.readString()";
    case "bytes":
      return "bb.readByteArray()";
    case "int64":
      return "bb.readVarInt64()";
    case "uint64":
      return "bb.readVarUint64()";
    default: {
      const def = definitions[type];
      if (!def) {
        throw new Error("Invalid type " + quote(type));
      } else if (def.kind === "ENUM") {
        return "this[" + quote(def.name) + "][bb.readVarUint()]";
      } else {
        return "this[" + quote("decode" + def.name) + "](bb)";
      }
    }
  }
}
function compileDecode(definition, definitions) {
  const lines = [];
  let indent = "  ";
  lines.push("function (bb) {");
  lines.push("  var result = {};");
  lines.push("  if (!(bb instanceof this.ByteBuffer)) {");
  lines.push("    bb = new this.ByteBuffer(bb);");
  lines.push("  }");
  lines.push("");
  if (definition.kind === "MESSAGE") {
    lines.push("  while (true) {");
    lines.push("    switch (bb.readVarUint()) {");
    lines.push("      case 0:");
    lines.push("        return result;");
    lines.push("");
    indent = "        ";
  }
  for (let i = 0; i < definition.fields.length; i++) {
    const field = definition.fields[i];
    let code;
    switch (field.type) {
      case "bool": {
        code = "!!bb.readByte()";
        break;
      }
      case "byte": {
        code = "bb.readByte()";
        break;
      }
      case "int": {
        code = "bb.readVarInt()";
        break;
      }
      case "uint": {
        code = "bb.readVarUint()";
        break;
      }
      case "float": {
        code = "bb.readVarFloat()";
        break;
      }
      case "float16": {
        code = "bb.readVarFloat16()";
        break;
      }
      case "double": {
        code = "bb.readDouble()";
        break;
      }
      case "string": {
        code = "bb.readString()";
        break;
      }
      case "bytes": {
        code = "bb.readByteArray()";
        break;
      }
      case "int64": {
        code = "bb.readVarInt64()";
        break;
      }
      case "uint64": {
        code = "bb.readVarUint64()";
        break;
      }
      default: {
        const type = definitions[field.type];
        if (!type) {
          error(
            "Invalid type " + quote(field.type) + " for field " + quote(field.name),
            field.line,
            field.column
          );
        } else if (type.kind === "ENUM") {
          code = "this[" + quote(type.name) + "][bb.readVarUint()]";
        } else if (type.kind === "MESSAGE" && !field.isArray) {
          code = "this[" + quote("decodeInline" + type.name) + "](bb)";
        } else {
          code = "this[" + quote("decode" + type.name) + "](bb)";
        }
      }
    }
    if (definition.kind === "MESSAGE") {
      lines.push("      case " + field.value + ":");
    }
    if (field.isMap && field.keyType && field.type) {
      let keyCode = compileReadCodeForType(field.keyType, definitions);
      let valueCode = code;
      if (field.isDeprecated) {
        const length = "bb.readVarUint()";
        lines.push(indent + "var mapLength = " + length + ";");
        lines.push(indent + "while (mapLength-- > 0) {");
        lines.push(indent + "  var key = " + keyCode + ";");
        lines.push(indent + "  var value = " + valueCode + ";");
        lines.push(indent + "}");
      } else {
        lines.push(indent + "var mapLength = bb.readVarUint();");
        lines.push(
          indent + "var map = result[" + quote(field.name) + "] = {};"
        );
        lines.push(indent + "while (mapLength-- > 0) {");
        lines.push(indent + "  var key = " + keyCode + ";");
        lines.push(indent + "  map[key] = " + valueCode + ";");
        lines.push(indent + "}");
      }
    } else if (field.isFixedArray && field.arraySize !== void 0) {
      if (field.isDeprecated) {
        lines.push(
          indent + "for (var i = 0; i < " + field.arraySize + "; i++) " + code + ";"
        );
      } else {
        lines.push(
          indent + "var values = result[" + quote(field.name) + "] = Array(" + field.arraySize + ");"
        );
        lines.push(
          indent + "for (var i = 0; i < " + field.arraySize + "; i++) values[i] = " + code + ";"
        );
      }
    } else if (field.isArray) {
      if (field.isDeprecated) {
        if (field.type === "byte" || field.type === "bytes") {
          lines.push(indent + "bb.readByteArray();");
        } else if (field.type === "bool") {
          lines.push(indent + "var length = bb.readVarUint();");
          lines.push(
            indent + "for (var i = 0; i < length; i++) bb.readBits(1);"
          );
          lines.push(indent + "bb._bitOffset = 0; bb._bitBuffer = 0;");
        } else if (field.type === "int" || field.type === "uint") {
          lines.push(indent + "var length = bb.readVarUint();");
          lines.push(indent + "var useDelta = bb.readByte();");
          lines.push(indent + "if (useDelta) {");
          lines.push(indent + "  var last = 0;");
          lines.push(
            indent + "  for (var i = 0; i < length; i++) last = bb.readVarIntDelta(last);"
          );
          lines.push(indent + "} else {");
          lines.push(
            indent + "  for (var i = 0; i < length; i++) " + code + ";"
          );
          lines.push(indent + "}");
        } else {
          lines.push(indent + "var length = bb.readVarUint();");
          lines.push(indent + "while (length-- > 0) " + code + ";");
        }
      } else {
        if (field.type === "bytes") {
          lines.push(indent + "var length = bb.readVarUint();");
          lines.push(
            indent + "var values = result[" + quote(field.name) + "] = Array(length);"
          );
          lines.push(indent + "for (var i = 0; i < length; i++) {");
          lines.push(indent + "  values[i] = bb.readByteArray();");
          lines.push(indent + "}");
        } else if (field.type === "byte") {
          lines.push(indent + "var length = bb.readVarUint();");
          lines.push(
            indent + "var values = result[" + quote(field.name) + "] = Array(length);"
          );
          lines.push(indent + "for (var i = 0; i < length; i++) {");
          lines.push(indent + "  values[i] = bb.readByte();");
          lines.push(indent + "}");
        } else if (field.type === "bool") {
          lines.push(indent + "var length = bb.readVarUint();");
          lines.push(
            indent + "var values = result[" + quote(field.name) + "] = Array(length);"
          );
          lines.push(indent + "for (var i = 0; i < length; i++) {");
          lines.push(indent + "  values[i] = !!bb.readBits(1);");
          lines.push(indent + "}");
          lines.push(indent + "bb._bitOffset = 0; bb._bitBuffer = 0;");
        } else if (field.type === "int" || field.type === "uint") {
          lines.push(indent + "var length = bb.readVarUint();");
          lines.push(indent + "var useDelta = bb.readByte();");
          lines.push(
            indent + "var values = result[" + quote(field.name) + "] = Array(length);"
          );
          lines.push(indent + "if (useDelta) {");
          lines.push(indent + "  var last = 0;");
          lines.push(indent + "  for (var i = 0; i < length; i++) {");
          lines.push(indent + "    last = bb.readVarIntDelta(last);");
          lines.push(indent + "    values[i] = last;");
          lines.push(indent + "  }");
          lines.push(indent + "} else {");
          lines.push(indent + "  for (var i = 0; i < length; i++) {");
          lines.push(indent + "    values[i] = " + code + ";");
          lines.push(indent + "  }");
          lines.push(indent + "}");
        } else {
          lines.push(indent + "var length = bb.readVarUint();");
          lines.push(
            indent + "var values = result[" + quote(field.name) + "] = Array(length);"
          );
          lines.push(
            indent + "for (var i = 0; i < length; i++) values[i] = " + code + ";"
          );
        }
      }
    } else {
      if (field.isDeprecated) {
        lines.push(indent + code + ";");
      } else {
        lines.push(indent + "result." + field.name + " = " + code + ";");
      }
    }
    if (definition.kind === "MESSAGE") {
      lines.push("        break;");
      lines.push("");
    }
  }
  if (definition.kind === "MESSAGE") {
    lines.push("      default:");
    lines.push(
      indent + 'throw new Error("Attempted to parse invalid message");'
    );
    lines.push("    }");
    lines.push("  }");
  } else {
    lines.push("  return result;");
  }
  lines.push("}");
  return lines.join("\n");
}
function compileWriteCodeForType(type, definitions) {
  switch (type) {
    case "bool":
      return "bb.writeByte(value);";
    case "byte":
      return "bb.writeByte(value);";
    case "int":
      return "bb.writeVarInt(value);";
    case "uint":
      return "bb.writeVarUint(value);";
    case "float":
      return "bb.writeVarFloat(value);";
    case "float16":
      return "bb.writeVarFloat16(value);";
    case "double":
      return "bb.writeDouble(value);";
    case "string":
      return "bb.writeString(value);";
    case "bytes":
      return "bb.writeByteArray(value);";
    case "int64":
      return "bb.writeVarInt64(value);";
    case "uint64":
      return "bb.writeVarUint64(value);";
    default: {
      const def = definitions[type];
      if (!def) {
        throw new Error("Invalid type " + quote(type));
      } else if (def.kind === "ENUM") {
        return "var encoded = this[" + quote(def.name) + "][value]; if (encoded === void 0) throw new Error(" + quote("Invalid value ") + " + JSON.stringify(value) + " + quote(" for enum " + quote(def.name)) + "); bb.writeVarUint(encoded);";
      } else {
        return "this[" + quote("encode" + def.name) + "](value, bb);";
      }
    }
  }
}
function compileEncode(definition, definitions) {
  const lines = [];
  lines.push("function (message, bb) {");
  lines.push("  var isTopLevel = !bb;");
  lines.push("  if (isTopLevel) bb = new this.ByteBuffer();");
  for (let j = 0; j < definition.fields.length; j++) {
    const field = definition.fields[j];
    let code;
    if (field.isDeprecated) {
      continue;
    }
    switch (field.type) {
      case "bool": {
        code = "bb.writeByte(value);";
        break;
      }
      case "byte": {
        code = "bb.writeByte(value);";
        break;
      }
      case "int": {
        code = "bb.writeVarInt(value);";
        break;
      }
      case "uint": {
        code = "bb.writeVarUint(value);";
        break;
      }
      case "float": {
        code = "bb.writeVarFloat(value);";
        break;
      }
      case "float16": {
        code = "bb.writeVarFloat16(value);";
        break;
      }
      case "double": {
        code = "bb.writeDouble(value);";
        break;
      }
      case "string": {
        code = "bb.writeString(value);";
        break;
      }
      case "bytes": {
        code = "bb.writeByteArray(value);";
        break;
      }
      case "int64": {
        code = "bb.writeVarInt64(value);";
        break;
      }
      case "uint64": {
        code = "bb.writeVarUint64(value);";
        break;
      }
      default: {
        const type = definitions[field.type];
        if (!type) {
          throw new Error(
            "Invalid type " + quote(field.type) + " for field " + quote(field.name)
          );
        } else if (type.kind === "ENUM") {
          code = "var encoded = this[" + quote(type.name) + "][value]; if (encoded === void 0) throw new Error(" + quote("Invalid value ") + " + JSON.stringify(value) + " + quote(" for enum " + quote(type.name)) + "); bb.writeVarUint(encoded);";
        } else if (type.kind === "MESSAGE" && !field.isArray) {
          code = "this[" + quote("encodeInline" + type.name) + "](value, bb);";
        } else {
          code = "this[" + quote("encode" + type.name) + "](value, bb);";
        }
      }
    }
    lines.push("");
    lines.push("  var value = message." + field.name + ";");
    lines.push("  if (value != null) {");
    if (definition.kind === "MESSAGE") {
      if (field.value < 128) {
        lines.push("    bb.writeByte(" + field.value + ");");
      } else {
        lines.push("    bb.writeVarUint(" + field.value + ");");
      }
    }
    if (field.isMap && field.keyType && field.type) {
      let keyCode = compileWriteCodeForType(field.keyType, definitions);
      let valueCode = code;
      lines.push("    var map = value, keys = Object.keys(map);");
      lines.push("    bb.writeVarUint(keys.length);");
      lines.push("    for (var i = 0; i < keys.length; i++) {");
      lines.push("      var key = keys[i];");
      lines.push("      " + keyCode.replace(/value/g, "key"));
      lines.push("      " + valueCode.replace(/value/g, "map[key]"));
      lines.push("    }");
    } else if (field.isFixedArray && field.arraySize !== void 0) {
      lines.push("    var values = value;");
      lines.push("    for (var i = 0; i < " + field.arraySize + "; i++) {");
      lines.push("      value = values[i];");
      lines.push("      " + code);
      lines.push("    }");
    } else if (field.isArray) {
      if (field.type === "bytes") {
        lines.push("    var values = value, n = values.length;");
        lines.push("    bb.writeVarUint(n);");
        lines.push(
          "    for (var i = 0; i < n; i++) bb.writeByteArray(values[i]);"
        );
      } else if (field.type === "byte") {
        lines.push("    bb.writeVarUint(value.length);");
        lines.push(
          "    for (var i = 0; i < value.length; i++) bb.writeByte(value[i]);"
        );
      } else if (field.type === "bool") {
        lines.push("    var n = value.length;");
        lines.push("    bb.writeVarUint(n);");
        lines.push(
          "    for (var i = 0; i < n; i++) bb.writeBits(value[i] ? 1 : 0, 1);"
        );
        lines.push("    bb.flushBits();");
      } else if (field.type === "int" || field.type === "uint") {
        const writeMethod = field.type === "int" ? "writeVarInt" : "writeVarUint";
        lines.push("    var values = value, n = values.length;");
        lines.push("    bb.writeVarUint(n);");
        lines.push("    if (n >= 16) {");
        lines.push("      var totalDelta = 0;");
        lines.push(
          "      for (var i = 1; i < 8; i++) totalDelta += Math.abs(values[i] - values[i-1]);"
        );
        lines.push("      if (totalDelta < n) {");
        lines.push("        bb.writeByte(1);");
        lines.push(
          "        for (var i = 0, last = 0; i < n; i++) last = bb.writeVarIntDelta(values[i], last);"
        );
        lines.push("      } else {");
        lines.push("        bb.writeByte(0);");
        lines.push(
          "        for (var i = 0; i < n; i++) bb." + writeMethod + "(values[i]);"
        );
        lines.push("      }");
        lines.push("    } else {");
        lines.push("      bb.writeByte(0);");
        lines.push(
          "      for (var i = 0; i < n; i++) bb." + writeMethod + "(values[i]);"
        );
        lines.push("    }");
      } else {
        lines.push("    var values = value, n = values.length;");
        lines.push("    bb.writeVarUint(n);");
        lines.push("    for (var i = 0; i < n; i++) {");
        lines.push("      value = values[i];");
        lines.push("      " + code);
        lines.push("    }");
      }
    } else {
      lines.push("    " + code);
    }
    if (definition.kind === "STRUCT") {
      lines.push("  } else {");
      lines.push(
        "    throw new Error(" + quote("Missing required field " + quote(field.name)) + ");"
      );
    }
    lines.push("  }");
  }
  if (definition.kind === "MESSAGE") {
    lines.push("  bb.writeByte(0);");
  }
  lines.push("");
  lines.push("  if (isTopLevel) return bb.toUint8Array();");
  lines.push("}");
  return lines.join("\n");
}
function compileInlineDecode(definition, definitions) {
  const lines = [];
  const sortedFields = [...definition.fields].filter((f) => !f.isDeprecated).sort((a, b) => a.value - b.value);
  const isMessageField = (f) => {
    if (!f.type) return false;
    const def = definitions[f.type];
    return (def == null ? void 0 : def.kind) === "MESSAGE";
  };
  lines.push("function (bb) {");
  lines.push("  var result = {};");
  for (let i = 0; i < sortedFields.length; i++) {
    const field = sortedFields[i];
    if (isMessageField(field)) {
      const typeDef = definitions[field.type];
      lines.push("  var v = bb.readVarUint();");
      lines.push("  if (v === 0) return result;");
      lines.push(
        "  result[" + quote(field.name) + "] = this[" + quote("decodeInline" + typeDef.name) + "](bb);"
      );
    } else {
      const code = compileInlineReadCode(field, definitions);
      if (i === 0) {
        lines.push("  var v = " + code + ";");
      } else {
        lines.push("  v = " + code + ";");
      }
      lines.push("  if (v === 0) return result;");
      lines.push("  result[" + quote(field.name) + "] = v;");
    }
  }
  lines.push("  return result;");
  lines.push("}");
  return lines.join("\n");
}
function compileInlineEncode(definition, definitions) {
  const lines = [];
  const sortedFields = [...definition.fields].filter((f) => !f.isDeprecated).sort((a, b) => a.value - b.value);
  const hasMessageFields = sortedFields.some((f) => {
    if (!f.type) return false;
    const def = definitions[f.type];
    return (def == null ? void 0 : def.kind) === "MESSAGE";
  });
  lines.push("function (message, bb) {");
  lines.push("  message = message || {};");
  for (let i = 0; i < sortedFields.length; i++) {
    const field = sortedFields[i];
    const code = compileInlineWriteCode(field, definitions);
    lines.push("  var value = message[" + quote(field.name) + "];");
    lines.push("  if (value == null) { bb.writeVarUint(0); return; }");
    lines.push("  " + code);
  }
  if (hasMessageFields) {
    lines.push("  bb.writeVarUint(0);");
  }
  lines.push("}");
  return lines.join("\n");
}
function compileSchemaJS(schema) {
  const definitions = {};
  let name = schema.package;
  const js = [];
  if (name !== null) {
    js.push("var " + name + " = exports || " + name + " || {}, exports;");
  } else {
    js.push("var exports = exports || {};");
    name = "exports";
  }
  js.push(
    name + ".ByteBuffer = " + name + '.ByteBuffer || require("zephyr-schema").ByteBuffer;'
  );
  for (let i = 0; i < schema.definitions.length; i++) {
    const definition = schema.definitions[i];
    definitions[definition.name] = definition;
  }
  for (let i = 0; i < schema.definitions.length; i++) {
    const definition = schema.definitions[i];
    switch (definition.kind) {
      case "ENUM": {
        const value = {};
        for (let j = 0; j < definition.fields.length; j++) {
          const field = definition.fields[j];
          value[field.name] = field.value;
          value[field.value] = field.name;
        }
        js.push(
          name + "[" + quote(definition.name) + "] = " + JSON.stringify(value, null, 2) + ";"
        );
        break;
      }
      case "STRUCT":
      case "MESSAGE": {
        js.push("");
        js.push(
          name + "[" + quote("decode" + definition.name) + "] = " + compileDecode(definition, definitions) + ";"
        );
        js.push("");
        js.push(
          name + "[" + quote("encode" + definition.name) + "] = " + compileEncode(definition, definitions) + ";"
        );
        if (definition.kind === "MESSAGE") {
          js.push("");
          js.push(
            name + "[" + quote("decodeInline" + definition.name) + "] = " + compileInlineDecode(definition, definitions) + ";"
          );
          js.push("");
          js.push(
            name + "[" + quote("encodeInline" + definition.name) + "] = " + compileInlineEncode(definition, definitions) + ";"
          );
        }
        break;
      }
      default: {
        error(
          "Invalid definition kind " + quote(definition.kind),
          definition.line,
          definition.column
        );
        break;
      }
    }
  }
  js.push("");
  return js.join("\n");
}
function compileSchema(schema) {
  const result = {
    ByteBuffer
  };
  new Function("exports", compileSchemaJS(schema))(result);
  return result;
}

// ts.ts
function getTypeScriptType(field, definitions, options = {}) {
  const { readonly = false } = options;
  if (field.isMap && field.keyType && field.type) {
    const keyType = field.keyType === "string" ? "string" : "number";
    const valueType = resolveFieldType(field.type, definitions);
    return readonly ? `Readonly<Record<${keyType}, ${valueType}>>` : `Record<${keyType}, ${valueType}>`;
  }
  let type = resolveFieldType(field.type || "any", definitions);
  if (field.type === "byte" && field.isArray) {
    return "Uint8Array";
  }
  if (field.isFixedArray && field.arraySize !== void 0) {
    const tuple = Array(field.arraySize).fill(type).join(", ");
    return readonly ? `readonly [${tuple}]` : `[${tuple}]`;
  }
  if (field.isArray) {
    return readonly ? `readonly ${type}[]` : `${type}[]`;
  }
  return type;
}
function resolveFieldType(type, definitions) {
  switch (type) {
    case "bool":
      return "boolean";
    case "byte":
    case "int":
    case "uint":
    case "float":
    case "float16":
    case "double":
      return "number";
    case "int64":
    case "uint64":
      return "bigint";
    case "string":
      return "string";
    case "bytes":
      return "Uint8Array";
    default:
      return type;
  }
}
function isMessageType(type, definitions) {
  return definitions.some((d) => d.name === type && d.kind === "MESSAGE");
}
function compileSchemaTypeScript(schema, options = {}) {
  const {
    readonly = false,
    branded = false,
    typeGuards = false,
    inputTypes = true
  } = options;
  let indent = "";
  const lines = [];
  lines.push("// Generated by Zephyr Schema Compiler");
  lines.push("// Do not edit manually");
  lines.push("");
  if (schema.package !== null) {
    lines.push(`export namespace ${schema.package} {`);
    indent = "  ";
  }
  if (branded) {
    lines.push(indent + "/** Branded type for compile-time type safety */");
    lines.push(
      indent + "type Brand<T, B extends string> = T & { readonly __brand: B };"
    );
    lines.push("");
  }
  for (const definition of schema.definitions) {
    if (definition.kind === "ENUM") {
      generateEnumType(definition, lines, indent);
    }
  }
  for (const definition of schema.definitions) {
    if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
      generateInterfaceType(
        definition,
        schema.definitions,
        lines,
        indent,
        readonly,
        inputTypes
      );
    } else if (definition.kind !== "ENUM") {
      error(
        "Invalid definition kind " + quote(definition.kind),
        definition.line,
        definition.column
      );
    }
  }
  if (typeGuards) {
    generateTypeGuards(schema.definitions, lines, indent);
  }
  generateSchemaInterface(schema.definitions, lines, indent, inputTypes);
  if (schema.package !== null) {
    lines.push("}");
  }
  lines.push("");
  return lines.join("\n");
}
function generateEnumType(definition, lines, indent) {
  const { name, fields } = definition;
  lines.push(indent + `/** Enum: ${name} */`);
  lines.push(indent + `export const ${name} = {`);
  for (let j = 0; j < fields.length; j++) {
    const field = fields[j];
    lines.push(
      indent + `  ${field.name}: ${JSON.stringify(field.name)} as const,`
    );
  }
  lines.push(indent + "} as const;");
  lines.push("");
  lines.push(
    indent + `export type ${name} = (typeof ${name})[keyof typeof ${name}];`
  );
  lines.push("");
  lines.push(indent + `/** Numeric values for ${name} */`);
  lines.push(indent + `export const ${name}Values = {`);
  for (let j = 0; j < fields.length; j++) {
    const field = fields[j];
    lines.push(indent + `  ${field.name}: ${field.value},`);
  }
  lines.push(indent + "} as const;");
  lines.push("");
  lines.push(indent + `/** Reverse mapping for ${name} (value to name) */`);
  lines.push(indent + `export const ${name}Names: Record<number, ${name}> = {`);
  for (let j = 0; j < fields.length; j++) {
    const field = fields[j];
    lines.push(indent + `  ${field.value}: ${JSON.stringify(field.name)},`);
  }
  lines.push(indent + "};");
  lines.push("");
}
function generateInterfaceType(definition, definitions, lines, indent, readonly, inputTypes) {
  const { name, kind, fields } = definition;
  const isMessage = kind === "MESSAGE";
  lines.push(
    indent + `/** ${kind === "STRUCT" ? "Struct" : "Message"}: ${name} */`
  );
  lines.push(indent + `export interface ${name} {`);
  for (const field of fields) {
    if (field.isDeprecated) {
      continue;
    }
    const type = getTypeScriptType(field, definitions, { readonly });
    const optional = isMessage ? "?" : "";
    const readonlyMod = readonly ? "readonly " : "";
    lines.push(indent + `  ${readonlyMod}${field.name}${optional}: ${type};`);
  }
  lines.push(indent + "}");
  lines.push("");
  if (inputTypes && isMessage) {
    lines.push(
      indent + `/** Input type for encoding ${name} (all fields optional) */`
    );
    lines.push(indent + `export interface ${name}Input {`);
    for (const field of fields) {
      if (field.isDeprecated) {
        continue;
      }
      let type = getTypeScriptType(field, definitions, { readonly: false });
      if (field.type && isMessageType(field.type, definitions) && !field.isArray && !field.isMap) {
        type = `${field.type}Input`;
      } else if (field.type && isMessageType(field.type, definitions) && field.isArray) {
        type = `${field.type}Input[]`;
      }
      lines.push(indent + `  ${field.name}?: ${type};`);
    }
    lines.push(indent + "}");
    lines.push("");
  }
}
function generateTypeGuards(definitions, lines, indent) {
  lines.push(indent + "// Type Guards");
  lines.push("");
  for (const definition of definitions) {
    if (definition.kind === "ENUM") {
      const { name, fields } = definition;
      const values = fields.map((f) => JSON.stringify(f.name)).join(", ");
      lines.push(indent + `/** Type guard for ${name} */`);
      lines.push(
        indent + `export function is${name}(value: unknown): value is ${name} {`
      );
      lines.push(indent + `  return [${values}].includes(value as ${name});`);
      lines.push(indent + "}");
      lines.push("");
    } else if (definition.kind === "STRUCT" || definition.kind === "MESSAGE") {
      const { name, fields } = definition;
      const isMessage = definition.kind === "MESSAGE";
      lines.push(indent + `/** Type guard for ${name} */`);
      lines.push(
        indent + `export function is${name}(value: unknown): value is ${name} {`
      );
      lines.push(
        indent + "  if (typeof value !== 'object' || value === null) return false;"
      );
      lines.push(indent + `  const obj = value as Record<string, unknown>;`);
      for (const field of fields) {
        if (field.isDeprecated) continue;
        const fieldCheck = generateFieldTypeCheck(field, isMessage);
        if (fieldCheck) {
          lines.push(indent + `  ${fieldCheck}`);
        }
      }
      lines.push(indent + "  return true;");
      lines.push(indent + "}");
      lines.push("");
    }
  }
}
function generateFieldTypeCheck(field, isMessage) {
  const { name, type, isArray, isMap } = field;
  const accessor = `obj[${JSON.stringify(name)}]`;
  if (isMessage) {
    return `if (${accessor} !== undefined && ${accessor} !== null) { /* check ${name} */ }`;
  }
  if (isMap) {
    return `if (typeof ${accessor} !== 'object') return false;`;
  }
  if (isArray) {
    return `if (!Array.isArray(${accessor})) return false;`;
  }
  switch (type) {
    case "bool":
      return `if (typeof ${accessor} !== 'boolean') return false;`;
    case "byte":
    case "int":
    case "uint":
    case "float":
    case "float16":
    case "double":
      return `if (typeof ${accessor} !== 'number') return false;`;
    case "int64":
    case "uint64":
      return `if (typeof ${accessor} !== 'bigint') return false;`;
    case "string":
      return `if (typeof ${accessor} !== 'string') return false;`;
    case "bytes":
      return `if (!(${accessor} instanceof Uint8Array)) return false;`;
    default:
      return `if (typeof ${accessor} !== 'object') return false;`;
  }
}
function generateSchemaInterface(definitions, lines, indent, inputTypes) {
  lines.push(indent + "/** Compiled Zephyr Schema interface */");
  lines.push(indent + "export interface Schema {");
  for (const definition of definitions) {
    const { name, kind } = definition;
    if (kind === "ENUM") {
      lines.push(indent + `  /** Enum values for ${name} */`);
      lines.push(indent + `  ${name}: typeof ${name};`);
    } else if (kind === "STRUCT" || kind === "MESSAGE") {
      const inputType = inputTypes && kind === "MESSAGE" ? `${name}Input` : name;
      lines.push(indent + `  /** Encode ${name} to binary */`);
      lines.push(
        indent + `  encode${name}(message: ${inputType}): Uint8Array;`
      );
      lines.push(indent + `  /** Decode binary to ${name} */`);
      lines.push(indent + `  decode${name}(buffer: Uint8Array): ${name};`);
    }
  }
  lines.push(indent + "}");
  lines.push("");
}
function compileSchemaTypeScriptDeclaration(schema) {
  return compileSchemaTypeScript(schema, {
    readonly: true,
    branded: false,
    typeGuards: true,
    inputTypes: true
  });
}

// cpp.ts
function cppType(definitions, field, isArray) {
  let type;
  switch (field.type) {
    case "bool":
      type = "bool";
      break;
    case "byte":
      type = "uint8_t";
      break;
    case "int":
      type = "int32_t";
      break;
    case "uint":
      type = "uint32_t";
      break;
    case "float":
      type = "float";
      break;
    case "float16":
      type = "float";
      break;
    case "double":
      type = "double";
      break;
    case "string":
      type = "zephyr::String";
      break;
    case "bytes":
      type = "zephyr::Array<uint8_t>";
      break;
    case "int64":
      type = "int64_t";
      break;
    case "uint64":
      type = "uint64_t";
      break;
    default: {
      const definition = definitions[field.type];
      if (!definition) {
        error(
          "Invalid type " + quote(field.type) + " for field " + quote(field.name),
          field.line,
          field.column
        );
      }
      type = definition.name;
      break;
    }
  }
  if (isArray || field.isFixedArray) {
    type = "zephyr::Array<" + type + ">";
  }
  return type;
}
function cppFieldName(field) {
  return "_data_" + field.name;
}
function cppFlagIndex(i) {
  return i >> 5;
}
function cppFlagMask(i) {
  return 1 << i % 32 >>> 0;
}
function cppIsFieldPointer(definitions, field) {
  return !field.isArray && !field.isFixedArray && !field.isMap && field.type in definitions && definitions[field.type].kind !== "ENUM";
}
function compileSchemaCPP(schema) {
  const definitions = {};
  const cpp = [];
  cpp.push('#include "zephyr.h"');
  cpp.push("");
  if (schema.package !== null) {
    cpp.push("namespace " + schema.package + " {");
    cpp.push("");
    cpp.push("#ifndef INCLUDE_" + schema.package.toUpperCase() + "_H");
    cpp.push("#define INCLUDE_" + schema.package.toUpperCase() + "_H");
    cpp.push("");
  }
  for (let i = 0; i < schema.definitions.length; i++) {
    const definition = schema.definitions[i];
    definitions[definition.name] = definition;
  }
  cpp.push("class BinarySchema {");
  cpp.push("public:");
  cpp.push("  bool parse(zephyr::ByteBuffer &bb);");
  cpp.push(
    "  const zephyr::BinarySchema &underlyingSchema() const { return _schema; }"
  );
  for (let i = 0; i < schema.definitions.length; i++) {
    const definition = schema.definitions[i];
    if (definition.kind === "MESSAGE") {
      cpp.push(
        "  bool skip" + definition.name + "Field(zephyr::ByteBuffer &bb, uint32_t id) const;"
      );
    }
  }
  cpp.push("");
  cpp.push("private:");
  cpp.push("  zephyr::BinarySchema _schema;");
  for (let i = 0; i < schema.definitions.length; i++) {
    const definition = schema.definitions[i];
    if (definition.kind === "MESSAGE") {
      cpp.push("  uint32_t _index" + definition.name + " = 0;");
    }
  }
  cpp.push("};");
  cpp.push("");
  for (let i = 0; i < schema.definitions.length; i++) {
    const definition = schema.definitions[i];
    if (definition.kind === "ENUM") {
      cpp.push("enum class " + definition.name + " : uint32_t {");
      for (let j = 0; j < definition.fields.length; j++) {
        const field = definition.fields[j];
        cpp.push("  " + field.name + " = " + field.value + ",");
      }
      cpp.push("};");
      cpp.push("");
    } else if (definition.kind !== "STRUCT" && definition.kind !== "MESSAGE") {
      error(
        "Invalid definition kind " + quote(definition.kind),
        definition.line,
        definition.column
      );
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    let newline = false;
    if (pass === 2) {
      if (schema.package !== null) {
        cpp.push("#endif");
      }
      cpp.push("#ifdef IMPLEMENT_SCHEMA_H");
      cpp.push("");
      cpp.push("bool BinarySchema::parse(zephyr::ByteBuffer &bb) {");
      cpp.push("  if (!_schema.parse(bb)) return false;");
      for (let i = 0; i < schema.definitions.length; i++) {
        const definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          cpp.push(
            '  _schema.findDefinition("' + definition.name + '", _index' + definition.name + ");"
          );
        }
      }
      cpp.push("  return true;");
      cpp.push("}");
      cpp.push("");
      for (let i = 0; i < schema.definitions.length; i++) {
        const definition = schema.definitions[i];
        if (definition.kind === "MESSAGE") {
          cpp.push(
            "bool BinarySchema::skip" + definition.name + "Field(zephyr::ByteBuffer &bb, uint32_t id) const {"
          );
          cpp.push(
            "  return _schema.skipField(bb, _index" + definition.name + ", id);"
          );
          cpp.push("}");
          cpp.push("");
        }
      }
    }
    for (let i = 0; i < schema.definitions.length; i++) {
      const definition = schema.definitions[i];
      if (definition.kind === "ENUM") {
        continue;
      }
      const fields = definition.fields;
      if (pass === 0) {
        cpp.push("class " + definition.name + ";");
        newline = true;
      } else if (pass === 1) {
        cpp.push("class " + definition.name + " {");
        cpp.push("public:");
        cpp.push("  " + definition.name + "() { (void)_flags; }");
        cpp.push("");
        for (let j = 0; j < fields.length; j++) {
          const field = fields[j];
          if (field.isDeprecated) {
            continue;
          }
          const type = cppType(definitions, field, field.isArray);
          if (cppIsFieldPointer(definitions, field)) {
            cpp.push("  " + type + " *" + field.name + "();");
            cpp.push("  const " + type + " *" + field.name + "() const;");
            cpp.push("  void set_" + field.name + "(" + type + " *value);");
          } else if (field.isArray || field.isFixedArray) {
            cpp.push("  " + type + " *" + field.name + "();");
            cpp.push("  const " + type + " *" + field.name + "() const;");
            cpp.push(
              "  " + type + " &set_" + field.name + "(zephyr::MemoryPool &pool, uint32_t count);"
            );
          } else {
            cpp.push("  " + type + " *" + field.name + "();");
            cpp.push("  const " + type + " *" + field.name + "() const;");
            cpp.push(
              "  void set_" + field.name + "(const " + type + " &value);"
            );
          }
          cpp.push("");
        }
        cpp.push("  bool encode(zephyr::ByteBuffer &bb);");
        cpp.push(
          "  bool decode(zephyr::ByteBuffer &bb, zephyr::MemoryPool &pool, const BinarySchema *schema = nullptr);"
        );
        cpp.push("");
        cpp.push("private:");
        cpp.push(
          "  uint32_t _flags[" + (fields.length + 31 >> 5) + "] = {};"
        );
        const sizes = {
          bool: 1,
          byte: 1,
          int: 4,
          uint: 4,
          float: 4,
          float16: 2,
          double: 8
        };
        const sortedFields = fields.slice().sort(function(a, b) {
          const sizeA = !a.isArray && !a.isFixedArray && sizes[a.type] || 8;
          const sizeB = !b.isArray && !b.isFixedArray && sizes[b.type] || 8;
          if (sizeA !== sizeB) return sizeB - sizeA;
          return fields.indexOf(a) - fields.indexOf(b);
        });
        for (let j = 0; j < sortedFields.length; j++) {
          const field = sortedFields[j];
          if (field.isDeprecated) {
            continue;
          }
          const name = cppFieldName(field);
          const type = cppType(definitions, field, field.isArray);
          if (cppIsFieldPointer(definitions, field)) {
            cpp.push("  " + type + " *" + name + " = {};");
          } else {
            cpp.push("  " + type + " " + name + " = {};");
          }
        }
        cpp.push("};");
        cpp.push("");
      } else {
        for (let j = 0; j < fields.length; j++) {
          const field = fields[j];
          const name = cppFieldName(field);
          const type = cppType(definitions, field, field.isArray);
          const flagIndex = cppFlagIndex(j);
          const flagMask = cppFlagMask(j);
          if (field.isDeprecated) {
            continue;
          }
          if (cppIsFieldPointer(definitions, field)) {
            cpp.push(
              type + " *" + definition.name + "::" + field.name + "() {"
            );
            cpp.push("  return " + name + ";");
            cpp.push("}");
            cpp.push("");
            cpp.push(
              "const " + type + " *" + definition.name + "::" + field.name + "() const {"
            );
            cpp.push("  return " + name + ";");
            cpp.push("}");
            cpp.push("");
            cpp.push(
              "void " + definition.name + "::set_" + field.name + "(" + type + " *value) {"
            );
            cpp.push("  " + name + " = value;");
            cpp.push("}");
            cpp.push("");
          } else if (field.isArray || field.isFixedArray) {
            cpp.push(
              type + " *" + definition.name + "::" + field.name + "() {"
            );
            cpp.push(
              "  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;"
            );
            cpp.push("}");
            cpp.push("");
            cpp.push(
              "const " + type + " *" + definition.name + "::" + field.name + "() const {"
            );
            cpp.push(
              "  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;"
            );
            cpp.push("}");
            cpp.push("");
            cpp.push(
              type + " &" + definition.name + "::set_" + field.name + "(zephyr::MemoryPool &pool, uint32_t count) {"
            );
            cpp.push(
              "  _flags[" + flagIndex + "] |= " + flagMask + "; return " + name + " = pool.array<" + cppType(definitions, field, false) + ">(count);"
            );
            cpp.push("}");
            cpp.push("");
          } else {
            cpp.push(
              type + " *" + definition.name + "::" + field.name + "() {"
            );
            cpp.push(
              "  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;"
            );
            cpp.push("}");
            cpp.push("");
            cpp.push(
              "const " + type + " *" + definition.name + "::" + field.name + "() const {"
            );
            cpp.push(
              "  return _flags[" + flagIndex + "] & " + flagMask + " ? &" + name + " : nullptr;"
            );
            cpp.push("}");
            cpp.push("");
            cpp.push(
              "void " + definition.name + "::set_" + field.name + "(const " + type + " &value) {"
            );
            cpp.push(
              "  _flags[" + flagIndex + "] |= " + flagMask + "; " + name + " = value;"
            );
            cpp.push("}");
            cpp.push("");
          }
        }
        cpp.push(
          "bool " + definition.name + "::encode(zephyr::ByteBuffer &_bb) {"
        );
        for (let j = 0; j < fields.length; j++) {
          const field = fields[j];
          if (field.isDeprecated) {
            continue;
          }
          const name = cppFieldName(field);
          const value = field.isArray || field.isFixedArray ? "_it" : name;
          const flagIndex = cppFlagIndex(j);
          const flagMask = cppFlagMask(j);
          let code;
          switch (field.type) {
            case "bool": {
              code = "_bb.writeByte(" + value + ");";
              break;
            }
            case "byte": {
              code = "_bb.writeByte(" + value + ");";
              break;
            }
            case "int": {
              code = "_bb.writeVarInt(" + value + ");";
              break;
            }
            case "uint": {
              code = "_bb.writeVarUint(" + value + ");";
              break;
            }
            case "float": {
              code = "_bb.writeVarFloat(" + value + ");";
              break;
            }
            case "float16": {
              code = "_bb.writeVarFloat16(" + value + ");";
              break;
            }
            case "double": {
              code = "_bb.writeDouble(" + value + ");";
              break;
            }
            case "string": {
              code = "_bb.writeString(" + value + ".c_str(), " + value + ".length());";
              break;
            }
            case "bytes": {
              code = "_bb.writeBytes(" + value + ".data(), " + value + ".size());";
              break;
            }
            case "int64": {
              code = "_bb.writeVarInt64(" + value + ");";
              break;
            }
            case "uint64": {
              code = "_bb.writeVarUint64(" + value + ");";
              break;
            }
            default: {
              const type = definitions[field.type];
              if (!type) {
                error(
                  "Invalid type " + quote(field.type) + " for field " + quote(field.name),
                  field.line,
                  field.column
                );
              } else if (type.kind === "ENUM") {
                code = "_bb.writeVarUint(static_cast<uint32_t>(" + value + "));";
              } else {
                code = "if (!" + value + (cppIsFieldPointer(definitions, field) ? "->" : ".") + "encode(_bb)) return false;";
              }
            }
          }
          let indent = "  ";
          if (definition.kind === "STRUCT") {
            cpp.push("  if (" + field.name + "() == nullptr) return false;");
          } else {
            cpp.push("  if (" + field.name + "() != nullptr) {");
            indent = "    ";
          }
          if (definition.kind === "MESSAGE") {
            cpp.push(indent + "_bb.writeVarUint(" + field.value + ");");
          }
          if (field.isFixedArray && field.arraySize !== void 0) {
            cpp.push(
              indent + "for (uint32_t _i = 0; _i < " + field.arraySize + "; _i++) {"
            );
            cpp.push(indent + "  " + value + " = " + name + "[_i];");
            cpp.push(indent + "  " + code);
            cpp.push(indent + "}");
          } else if (field.isArray) {
            cpp.push(indent + "_bb.writeVarUint(" + name + ".size());");
            cpp.push(
              indent + "for (" + cppType(definitions, field, false) + " &_it : " + name + ") " + code
            );
          } else {
            cpp.push(indent + code);
          }
          if (definition.kind !== "STRUCT") {
            cpp.push("  }");
          }
        }
        if (definition.kind === "MESSAGE") {
          cpp.push("  _bb.writeVarUint(0);");
        }
        cpp.push("  return true;");
        cpp.push("}");
        cpp.push("");
        cpp.push(
          "bool " + definition.name + "::decode(zephyr::ByteBuffer &_bb, zephyr::MemoryPool &_pool, const BinarySchema *_schema) {"
        );
        for (let j = 0; j < fields.length; j++) {
          if (fields[j].isArray || fields[j].isFixedArray) {
            cpp.push("  uint32_t _count;");
            break;
          }
        }
        if (definition.kind === "MESSAGE") {
          cpp.push("  while (true) {");
          cpp.push("    uint32_t _type;");
          cpp.push("    if (!_bb.readVarUint(_type)) return false;");
          cpp.push("    switch (_type) {");
          cpp.push("      case 0:");
          cpp.push("        return true;");
        }
        for (let j = 0; j < fields.length; j++) {
          const field = fields[j];
          const name = cppFieldName(field);
          const value = field.isArray || field.isFixedArray ? "_it" : name;
          const isPointer = cppIsFieldPointer(definitions, field);
          let code;
          switch (field.type) {
            case "bool": {
              code = "_bb.readByte(" + value + ")";
              break;
            }
            case "byte": {
              code = "_bb.readByte(" + value + ")";
              break;
            }
            case "int": {
              code = "_bb.readVarInt(" + value + ")";
              break;
            }
            case "uint": {
              code = "_bb.readVarUint(" + value + ")";
              break;
            }
            case "float": {
              code = "_bb.readVarFloat(" + value + ")";
              break;
            }
            case "float16": {
              code = "_bb.readVarFloat16(" + value + ")";
              break;
            }
            case "double": {
              code = "_bb.readDouble(" + value + ")";
              break;
            }
            case "string": {
              code = "_bb.readString(" + value + ", _pool)";
              break;
            }
            case "bytes": {
              code = "_bb.readBytes(" + value + ", _length)";
              break;
            }
            case "int64": {
              code = "_bb.readVarInt64(" + value + ")";
              break;
            }
            case "uint64": {
              code = "_bb.readVarUint64(" + value + ")";
              break;
            }
            default: {
              const type2 = definitions[field.type];
              if (!type2) {
                error(
                  "Invalid type " + quote(field.type) + " for field " + quote(field.name),
                  field.line,
                  field.column
                );
              } else if (type2.kind === "ENUM") {
                code = "_bb.readVarUint(reinterpret_cast<uint32_t &>(" + value + "))";
              } else {
                code = value + (isPointer ? "->" : ".") + "decode(_bb, _pool, _schema)";
              }
            }
          }
          const type = cppType(definitions, field, false);
          let indent = "  ";
          if (definition.kind === "MESSAGE") {
            cpp.push("      case " + field.value + ": {");
            indent = "        ";
          }
          if (field.isFixedArray && field.arraySize !== void 0) {
            cpp.push(
              indent + "for (" + type + " &_it : set_" + field.name + "(_pool, " + field.arraySize + ")) if (!" + code + ") return false;"
            );
          } else if (field.isArray) {
            cpp.push(indent + "if (!_bb.readVarUint(_count)) return false;");
            if (field.isDeprecated) {
              cpp.push(
                indent + "for (" + type + " &_it : _pool.array<" + cppType(definitions, field, false) + ">(_count)) if (!" + code + ") return false;"
              );
            } else {
              cpp.push(
                indent + "for (" + type + " &_it : set_" + field.name + "(_pool, _count)) if (!" + code + ") return false;"
              );
            }
          } else {
            if (field.isDeprecated) {
              if (isPointer) {
                cpp.push(
                  indent + type + " *" + name + " = _pool.allocate<" + type + ">();"
                );
              } else {
                cpp.push(indent + type + " " + name + " = {};");
              }
              cpp.push(indent + "if (!" + code + ") return false;");
            } else {
              if (isPointer) {
                cpp.push(indent + name + " = _pool.allocate<" + type + ">();");
              }
              cpp.push(indent + "if (!" + code + ") return false;");
              if (!isPointer) {
                cpp.push(indent + "set_" + field.name + "(" + name + ");");
              }
            }
          }
          if (definition.kind === "MESSAGE") {
            cpp.push("        break;");
            cpp.push("      }");
          }
        }
        if (definition.kind === "MESSAGE") {
          cpp.push("      default: {");
          cpp.push(
            "        if (!_schema || !_schema->skip" + definition.name + "Field(_bb, _type)) return false;"
          );
          cpp.push("        break;");
          cpp.push("      }");
          cpp.push("    }");
          cpp.push("  }");
        } else {
          cpp.push("  return true;");
        }
        cpp.push("}");
        cpp.push("");
      }
    }
    if (pass === 2) {
      cpp.push("#endif");
      cpp.push("");
    } else if (newline) cpp.push("");
  }
  if (schema.package !== null) {
    cpp.push("}");
    cpp.push("");
  }
  return cpp.join("\n");
}

// binary.ts
var types = [
  "bool",
  "byte",
  "int",
  "uint",
  "float",
  "float16",
  "double",
  "string",
  "bytes",
  "int64",
  "uint64"
];
var kinds = ["ENUM", "STRUCT", "MESSAGE"];
function decodeBinarySchema(buffer) {
  const bb = buffer instanceof ByteBuffer ? buffer : new ByteBuffer(buffer);
  const definitionCount = bb.readVarUint();
  const definitions = [];
  for (let i = 0; i < definitionCount; i++) {
    const definitionName = bb.readString();
    const kind = bb.readByte();
    const fieldCount = bb.readVarUint();
    const fields = [];
    for (let j = 0; j < fieldCount; j++) {
      const fieldName = bb.readString();
      const type = bb.readVarInt();
      const isArray = !!(bb.readByte() & 1);
      const isFixedArray = !!(bb.readByte() & 1);
      const isMap = !!(bb.readByte() & 1);
      let arraySize = void 0;
      let keyType = null;
      if (isFixedArray) {
        arraySize = bb.readVarUint();
      }
      if (isMap) {
        const keyTypeIndex = bb.readVarInt();
        if (keyTypeIndex < 0) {
          keyType = types[~keyTypeIndex] || null;
        } else {
          keyType = definitions[keyTypeIndex].name;
        }
      }
      const value = bb.readVarUint();
      fields.push({
        name: fieldName,
        line: 0,
        column: 0,
        type: kinds[kind] === "ENUM" ? null : type,
        isArray,
        isFixedArray,
        isMap,
        arraySize,
        keyType: keyType || void 0,
        isDeprecated: false,
        value
      });
    }
    definitions.push({
      name: definitionName,
      line: 0,
      column: 0,
      kind: kinds[kind],
      fields
    });
  }
  const definitionIndex = {};
  for (let i = 0; i < definitionCount; i++) {
    definitionIndex[definitions[i].name] = i;
  }
  for (let i = 0; i < definitionCount; i++) {
    const fields = definitions[i].fields;
    for (let j = 0; j < fields.length; j++) {
      const field = fields[j];
      let type = field.type;
      if (type !== null && type < 0) {
        if (~type >= types.length) {
          throw new Error("Invalid type " + type);
        }
        field.type = types[~type];
      } else {
        if (type !== null && type >= definitions.length) {
          throw new Error("Invalid type " + type);
        }
        if (type !== null) {
          field.type = definitions[type].name;
        }
      }
    }
  }
  return {
    package: null,
    definitions
  };
}
function encodeBinarySchema(schema) {
  const bb = new ByteBuffer();
  const definitions = schema.definitions;
  const definitionIndex = {};
  bb.writeVarUint(definitions.length);
  for (let i = 0; i < definitions.length; i++) {
    definitionIndex[definitions[i].name] = i;
  }
  for (let i = 0; i < definitions.length; i++) {
    const definition = definitions[i];
    bb.writeString(definition.name);
    bb.writeByte(kinds.indexOf(definition.kind));
    bb.writeVarUint(definition.fields.length);
    for (let j = 0; j < definition.fields.length; j++) {
      const field = definition.fields[j];
      const type = types.indexOf(field.type || "");
      bb.writeString(field.name);
      bb.writeVarInt(type === -1 ? definitionIndex[field.type] : ~type);
      bb.writeByte(field.isArray ? 1 : 0);
      bb.writeByte(field.isFixedArray ? 1 : 0);
      bb.writeByte(field.isMap ? 1 : 0);
      if (field.isFixedArray && field.arraySize !== void 0) {
        bb.writeVarUint(field.arraySize);
      }
      if (field.isMap && field.keyType) {
        const keyTypeIndex = types.indexOf(field.keyType);
        bb.writeVarInt(
          keyTypeIndex === -1 ? definitionIndex[field.keyType] : ~keyTypeIndex
        );
      }
      bb.writeVarUint(field.value);
    }
  }
  return bb.toUint8Array();
}

// parser.ts
var nativeTypes = [
  "bool",
  "byte",
  "float",
  "float16",
  "double",
  "int",
  "int64",
  "string",
  "bytes",
  "uint",
  "uint64"
];
var reservedNames = ["ByteBuffer", "package"];
var regex = /((?:-|\b)\d+\b|\[\]|\[deprecated\]|\[\d+\]|map<|>|[=;{},[\]]|\b[A-Za-z_][A-Za-z0-9_]*\b|\/\/.*|\s+)/g;
var identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
var whitespace = /^\/\/.*|\s+$/;
var equals = /^=$/;
var endOfFile = /^$/;
var semicolon = /^;$/;
var integer = /^-?\d+$/;
var leftBrace = /^\{$/;
var rightBrace = /^\}$/;
var arrayToken = /^\[\]$/;
var fixedArrayToken = /^\[(\d+)\]$/;
var mapToken = /^map<$/;
var mapCloseToken = /^>$/;
var enumKeyword = /^enum$/;
var structKeyword = /^struct$/;
var messageKeyword = /^message$/;
var packageKeyword = /^package$/;
var deprecatedToken = /^\[deprecated\]$/;
function tokenize(text) {
  const parts = text.split(regex);
  const tokens = [];
  let column = 0;
  let line = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === void 0) continue;
    if (i & 1) {
      if (!whitespace.test(part)) {
        const match = part.match(fixedArrayToken);
        tokens.push({
          text: part,
          line: line + 1,
          column: column + 1,
          match: match || void 0
        });
      }
    } else if (part !== "" && part.trim() !== "") {
      error("Syntax error " + quote(part), line + 1, column + 1);
    }
    const lines = part.split("\n");
    if (lines.length > 1) column = 0;
    line += lines.length - 1;
    column += lines[lines.length - 1].length;
  }
  tokens.push({
    text: "",
    line,
    column
  });
  return tokens;
}
function parse(tokens) {
  function current() {
    return tokens[index];
  }
  function eat(test) {
    if (test.test(current().text)) {
      index++;
      return true;
    }
    return false;
  }
  function expect(test, expected) {
    if (!eat(test)) {
      const token = current();
      error(
        "Expected " + expected + " but found " + quote(token.text),
        token.line,
        token.column
      );
    }
  }
  function unexpectedToken() {
    const token = current();
    error("Unexpected token " + quote(token.text), token.line, token.column);
  }
  const definitions = [];
  let packageText = null;
  let index = 0;
  if (eat(packageKeyword)) {
    packageText = current().text;
    expect(identifier, "identifier");
    expect(semicolon, '";"');
  }
  while (index < tokens.length && !eat(endOfFile)) {
    const fields = [];
    let kind;
    if (eat(enumKeyword)) kind = "ENUM";
    else if (eat(structKeyword)) kind = "STRUCT";
    else if (eat(messageKeyword)) kind = "MESSAGE";
    else unexpectedToken();
    const name = current();
    expect(identifier, "identifier");
    expect(leftBrace, '"{"');
    while (!eat(rightBrace)) {
      let type = null;
      let isArray = false;
      let isFixedArray = false;
      let isMap = false;
      let arraySize = void 0;
      let keyType = null;
      let isDeprecated = false;
      if (kind !== "ENUM") {
        if (eat(mapToken)) {
          isMap = true;
          keyType = current().text;
          expect(identifier, "key type");
          const comma = current();
          if (comma.text === ",") {
            index++;
          } else {
            error(
              "Expected ',' but found " + quote(comma.text),
              comma.line,
              comma.column
            );
          }
          type = current().text;
          expect(identifier, "value type");
          expect(mapCloseToken, '">"');
        } else {
          type = current().text;
          expect(identifier, "identifier");
        }
        if (fixedArrayToken.test(current().text)) {
          const token = current();
          index++;
          isFixedArray = true;
          const match = token.match;
          if (match && match[1]) {
            arraySize = parseInt(match[1], 10);
          }
        } else if (eat(arrayToken)) {
          isArray = true;
        }
      }
      const field = current();
      expect(identifier, "identifier");
      let value = null;
      if (kind !== "STRUCT") {
        expect(equals, '"="');
        value = current();
        expect(integer, "integer");
        if ((+value.text | 0) + "" !== value.text) {
          error(
            "Invalid integer " + quote(value.text),
            value.line,
            value.column
          );
        }
      }
      const deprecated = current();
      if (eat(deprecatedToken)) {
        if (kind !== "MESSAGE") {
          error(
            "Cannot deprecate this field",
            deprecated.line,
            deprecated.column
          );
        }
        isDeprecated = true;
      }
      expect(semicolon, '";"');
      fields.push({
        name: field.text,
        line: field.line,
        column: field.column,
        type,
        isArray,
        isFixedArray,
        isMap,
        arraySize,
        keyType: keyType || void 0,
        isDeprecated,
        value: value !== null ? +value.text | 0 : fields.length + 1
      });
    }
    definitions.push({
      name: name.text,
      line: name.line,
      column: name.column,
      kind,
      fields
    });
  }
  return {
    package: packageText,
    definitions
  };
}
function verify(root) {
  const definedTypes = nativeTypes.slice();
  const definitions = {};
  for (let i = 0; i < root.definitions.length; i++) {
    const definition = root.definitions[i];
    if (definedTypes.indexOf(definition.name) !== -1) {
      error(
        "The type " + quote(definition.name) + " is defined twice",
        definition.line,
        definition.column
      );
    }
    if (reservedNames.indexOf(definition.name) !== -1) {
      error(
        "The type name " + quote(definition.name) + " is reserved",
        definition.line,
        definition.column
      );
    }
    definedTypes.push(definition.name);
    definitions[definition.name] = definition;
  }
  for (let i = 0; i < root.definitions.length; i++) {
    const definition = root.definitions[i];
    const fields = definition.fields;
    if (definition.kind === "ENUM" || fields.length === 0) {
      continue;
    }
    for (let j = 0; j < fields.length; j++) {
      const field = fields[j];
      if (field.isMap) {
        if (field.keyType && definedTypes.indexOf(field.keyType) === -1) {
          error(
            "The key type " + quote(field.keyType) + " is not defined for field " + quote(field.name),
            field.line,
            field.column
          );
        }
      }
      if (field.type && definedTypes.indexOf(field.type) === -1) {
        error(
          "The type " + quote(field.type) + " is not defined for field " + quote(field.name),
          field.line,
          field.column
        );
      }
    }
    const values = [];
    for (let j = 0; j < fields.length; j++) {
      const field = fields[j];
      if (values.indexOf(field.value) !== -1) {
        error(
          "The id for field " + quote(field.name) + " is used twice",
          field.line,
          field.column
        );
      }
      if (field.value <= 0) {
        error(
          "The id for field " + quote(field.name) + " must be positive",
          field.line,
          field.column
        );
      }
      if (field.value > fields.length) {
        error(
          "The id for field " + quote(field.name) + " cannot be larger than " + fields.length,
          field.line,
          field.column
        );
      }
      values.push(field.value);
    }
  }
  const state = {};
  const check = (name) => {
    const definition = definitions[name];
    if (definition && definition.kind === "STRUCT") {
      if (state[name] === 1) {
        error(
          "Recursive nesting of " + quote(name) + " is not allowed",
          definition.line,
          definition.column
        );
      }
      if (state[name] !== 2 && definition) {
        state[name] = 1;
        const fields = definition.fields;
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i];
          if (!field.isArray && !field.isFixedArray && field.type) {
            check(field.type);
          }
        }
        state[name] = 2;
      }
    }
    return true;
  };
  for (let i = 0; i < root.definitions.length; i++) {
    check(root.definitions[i].name);
  }
}
function parseSchema(text) {
  const schema = parse(tokenize(text));
  verify(schema);
  return schema;
}

// printer.ts
function prettyPrintSchema(schema) {
  const definitions = schema.definitions;
  let text = "";
  if (schema.package !== null) {
    text += "package " + schema.package + ";\n";
  }
  for (let i = 0; i < definitions.length; i++) {
    const definition = definitions[i];
    if (i > 0 || schema.package !== null) text += "\n";
    text += definition.kind.toLowerCase() + " " + definition.name + " {\n";
    for (let j = 0; j < definition.fields.length; j++) {
      const field = definition.fields[j];
      text += "  ";
      if (definition.kind !== "ENUM") {
        if (field.isMap && field.keyType && field.type) {
          text += "map<" + field.keyType + ", " + field.type + "> ";
        } else {
          text += field.type || "";
          if (field.isFixedArray && field.arraySize !== void 0) {
            text += "[" + field.arraySize + "]";
          } else if (field.isArray) {
            text += "[]";
          }
          text += " ";
        }
      }
      text += field.name;
      if (definition.kind !== "STRUCT") {
        text += " = " + field.value;
      }
      if (field.isDeprecated) {
        text += " [deprecated]";
      }
      text += ";\n";
    }
    text += "}\n";
  }
  return text;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ByteBuffer,
  compileSchema,
  compileSchemaCPP,
  compileSchemaJS,
  compileSchemaTypeScript,
  compileSchemaTypeScriptDeclaration,
  decodeBinarySchema,
  encodeBinarySchema,
  parseSchema,
  prettyPrintSchema
});
