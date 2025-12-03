"use strict";
var zephyr = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // bb.ts
  var int32, float32, textDecoder, textEncoder, encoderBuffer, ByteBuffer;
  var init_bb = __esm({
    "bb.ts"() {
      "use strict";
      int32 = new Int32Array(1);
      float32 = new Float32Array(int32.buffer);
      textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
      textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
      encoderBuffer = new Uint8Array(4096);
      ByteBuffer = class {
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
    }
  });

  // binary.ts
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
  var types, kinds;
  var init_binary = __esm({
    "binary.ts"() {
      "use strict";
      init_bb();
      types = [
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
      kinds = ["ENUM", "STRUCT", "MESSAGE"];
    }
  });

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
  var init_util = __esm({
    "util.ts"() {
      "use strict";
    }
  });

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
  var init_js = __esm({
    "js.ts"() {
      "use strict";
      init_bb();
      init_util();
    }
  });

  // parser.ts
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
  var nativeTypes, reservedNames, regex, identifier, whitespace, equals, endOfFile, semicolon, integer, leftBrace, rightBrace, arrayToken, fixedArrayToken, mapToken, mapCloseToken, enumKeyword, structKeyword, messageKeyword, packageKeyword, deprecatedToken;
  var init_parser = __esm({
    "parser.ts"() {
      "use strict";
      init_util();
      nativeTypes = [
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
      reservedNames = ["ByteBuffer", "package"];
      regex = /((?:-|\b)\d+\b|\[\]|\[deprecated\]|\[\d+\]|map<|>|[=;{},[\]]|\b[A-Za-z_][A-Za-z0-9_]*\b|\/\/.*|\s+)/g;
      identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
      whitespace = /^\/\/.*|\s+$/;
      equals = /^=$/;
      endOfFile = /^$/;
      semicolon = /^;$/;
      integer = /^-?\d+$/;
      leftBrace = /^\{$/;
      rightBrace = /^\}$/;
      arrayToken = /^\[\]$/;
      fixedArrayToken = /^\[(\d+)\]$/;
      mapToken = /^map<$/;
      mapCloseToken = /^>$/;
      enumKeyword = /^enum$/;
      structKeyword = /^struct$/;
      messageKeyword = /^message$/;
      packageKeyword = /^package$/;
      deprecatedToken = /^\[deprecated\]$/;
    }
  });

  // browser.ts
  var require_browser = __commonJS({
    "browser.ts"(exports, module) {
      init_binary();
      init_js();
      init_parser();
      init_bb();
      module.exports = {
        decodeBinarySchema,
        compileSchema,
        parseSchema,
        ByteBuffer
      };
    }
  });
  return require_browser();
})();
