import { Schema, Definition, Field } from "./schema";
import { ByteBuffer } from "./bb";
import { error, quote } from "./util";

function compileInlineReadCode(
  field: Field,
  definitions: { [name: string]: Definition }
): string {
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
      const def = definitions[field.type!];
      if (!def) {
        throw new Error("Invalid type " + quote(field.type!));
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

function compileInlineWriteCode(
  field: Field,
  definitions: { [name: string]: Definition }
): string {
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
      const def = definitions[field.type!];
      if (!def) {
        throw new Error("Invalid type " + quote(field.type!));
      } else if (def.kind === "ENUM") {
        return (
          "var encoded = this[" +
          quote(def.name) +
          "][value]; " +
          "if (encoded === void 0) throw new Error(" +
          quote("Invalid value ") +
          " + JSON.stringify(value) + " +
          quote(" for enum " + quote(def.name)) +
          "); " +
          "bb.writeVarUint(encoded);"
        );
      } else if (def.kind === "STRUCT") {
        return "this[" + quote("encode" + def.name) + "](value, bb);";
      } else {
        return (
          "bb.writeVarUint(1); this[" +
          quote("encodeInline" + def.name) +
          "](value, bb);"
        );
      }
    }
  }
}

function compileReadCodeForType(
  type: string,
  definitions: { [name: string]: Definition }
): string {
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

function compileDecode(
  definition: Definition,
  definitions: { [name: string]: Definition }
): string {
  const lines: string[] = [];
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
    let code: string;

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
        const type = definitions[field.type!];
        if (!type) {
          error(
            "Invalid type " +
              quote(field.type!) +
              " for field " +
              quote(field.name),
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
      // Generate code for key type
      let keyCode = compileReadCodeForType(field.keyType, definitions);
      // Generate code for value type
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
    } else if (field.isFixedArray && field.arraySize !== undefined) {
      if (field.isDeprecated) {
        lines.push(
          indent +
            "for (var i = 0; i < " +
            field.arraySize +
            "; i++) " +
            code +
            ";"
        );
      } else {
        lines.push(
          indent +
            "var values = result[" +
            quote(field.name) +
            "] = Array(" +
            field.arraySize +
            ");"
        );
        lines.push(
          indent +
            "for (var i = 0; i < " +
            field.arraySize +
            "; i++) values[i] = " +
            code +
            ";"
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
            indent +
              "  for (var i = 0; i < length; i++) last = bb.readVarIntDelta(last);"
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
            indent +
              "var values = result[" +
              quote(field.name) +
              "] = Array(length);"
          );
          lines.push(indent + "for (var i = 0; i < length; i++) {");
          lines.push(indent + "  values[i] = bb.readByteArray();");
          lines.push(indent + "}");
        } else if (field.type === "byte") {
          lines.push(indent + "var length = bb.readVarUint();");
          lines.push(
            indent +
              "var values = result[" +
              quote(field.name) +
              "] = Array(length);"
          );
          lines.push(indent + "for (var i = 0; i < length; i++) {");
          lines.push(indent + "  values[i] = bb.readByte();");
          lines.push(indent + "}");
        } else if (field.type === "bool") {
          // Bit packing for boolean arrays
          lines.push(indent + "var length = bb.readVarUint();");
          lines.push(
            indent +
              "var values = result[" +
              quote(field.name) +
              "] = Array(length);"
          );
          lines.push(indent + "for (var i = 0; i < length; i++) {");
          lines.push(indent + "  values[i] = !!bb.readBits(1);");
          lines.push(indent + "}");
          lines.push(indent + "bb._bitOffset = 0; bb._bitBuffer = 0;");
        } else if (field.type === "int" || field.type === "uint") {
          // Delta encoding for int/uint arrays
          lines.push(indent + "var length = bb.readVarUint();");
          lines.push(indent + "var useDelta = bb.readByte();");
          lines.push(
            indent +
              "var values = result[" +
              quote(field.name) +
              "] = Array(length);"
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
            indent +
              "var values = result[" +
              quote(field.name) +
              "] = Array(length);"
          );
          lines.push(
            indent +
              "for (var i = 0; i < length; i++) values[i] = " +
              code +
              ";"
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

function compileWriteCodeForType(
  type: string,
  definitions: { [name: string]: Definition }
): string {
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
        return (
          "var encoded = this[" +
          quote(def.name) +
          "][value]; " +
          "if (encoded === void 0) throw new Error(" +
          quote("Invalid value ") +
          " + JSON.stringify(value) + " +
          quote(" for enum " + quote(def.name)) +
          "); " +
          "bb.writeVarUint(encoded);"
        );
      } else {
        return "this[" + quote("encode" + def.name) + "](value, bb);";
      }
    }
  }
}

function compileEncode(
  definition: Definition,
  definitions: { [name: string]: Definition }
): string {
  const lines: string[] = [];

  lines.push("function (message, bb) {");
  lines.push("  var isTopLevel = !bb;");
  lines.push("  if (isTopLevel) bb = new this.ByteBuffer();");

  for (let j = 0; j < definition.fields.length; j++) {
    const field = definition.fields[j];
    let code: string;

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
        const type = definitions[field.type!];
        if (!type) {
          throw new Error(
            "Invalid type " +
              quote(field.type!) +
              " for field " +
              quote(field.name)
          );
        } else if (type.kind === "ENUM") {
          code =
            "var encoded = this[" +
            quote(type.name) +
            "][value]; " +
            "if (encoded === void 0) throw new Error(" +
            quote("Invalid value ") +
            " + JSON.stringify(value) + " +
            quote(" for enum " + quote(type.name)) +
            "); " +
            "bb.writeVarUint(encoded);";
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
    } else if (field.isFixedArray && field.arraySize !== undefined) {
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
        const writeMethod =
          field.type === "int" ? "writeVarInt" : "writeVarUint";
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
          "        for (var i = 0; i < n; i++) bb." +
            writeMethod +
            "(values[i]);"
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
        "    throw new Error(" +
          quote("Missing required field " + quote(field.name)) +
          ");"
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

function compileInlineDecode(
  definition: Definition,
  definitions: { [name: string]: Definition }
): string {
  const lines: string[] = [];
  const sortedFields = [...definition.fields]
    .filter((f) => !f.isDeprecated)
    .sort((a, b) => a.value - b.value);

  const isMessageField = (f: Field): boolean => {
    if (!f.type) return false;
    const def = definitions[f.type];
    return def?.kind === "MESSAGE";
  };

  lines.push("function (bb) {");
  lines.push("  var result = {};");

  for (let i = 0; i < sortedFields.length; i++) {
    const field = sortedFields[i];

    if (isMessageField(field)) {
      const typeDef = definitions[field.type!];
      lines.push("  var v = bb.readVarUint();");
      lines.push("  if (v === 0) return result;");
      lines.push(
        "  result[" +
          quote(field.name) +
          "] = this[" +
          quote("decodeInline" + typeDef.name) +
          "](bb);"
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

function compileInlineEncode(
  definition: Definition,
  definitions: { [name: string]: Definition }
): string {
  const lines: string[] = [];
  const sortedFields = [...definition.fields]
    .filter((f) => !f.isDeprecated)
    .sort((a, b) => a.value - b.value);

  const hasMessageFields = sortedFields.some((f) => {
    if (!f.type) return false;
    const def = definitions[f.type];
    return def?.kind === "MESSAGE";
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

export function compileSchemaJS(schema: Schema): string {
  const definitions: { [name: string]: Definition } = {};
  let name = schema.package;
  const js: string[] = [];

  if (name !== null) {
    js.push("var " + name + " = exports || " + name + " || {}, exports;");
  } else {
    js.push("var exports = exports || {};");
    name = "exports";
  }

  js.push(
    name +
      ".ByteBuffer = " +
      name +
      '.ByteBuffer || require("zephyr-schema").ByteBuffer;'
  );

  for (let i = 0; i < schema.definitions.length; i++) {
    const definition = schema.definitions[i];
    definitions[definition.name] = definition;
  }

  for (let i = 0; i < schema.definitions.length; i++) {
    const definition = schema.definitions[i];

    switch (definition.kind) {
      case "ENUM": {
        const value: any = {};
        for (let j = 0; j < definition.fields.length; j++) {
          const field = definition.fields[j];
          value[field.name] = field.value;
          value[field.value] = field.name;
        }
        js.push(
          name +
            "[" +
            quote(definition.name) +
            "] = " +
            JSON.stringify(value, null, 2) +
            ";"
        );
        break;
      }

      case "STRUCT":
      case "MESSAGE": {
        js.push("");
        js.push(
          name +
            "[" +
            quote("decode" + definition.name) +
            "] = " +
            compileDecode(definition, definitions) +
            ";"
        );
        js.push("");
        js.push(
          name +
            "[" +
            quote("encode" + definition.name) +
            "] = " +
            compileEncode(definition, definitions) +
            ";"
        );
        if (definition.kind === "MESSAGE") {
          js.push("");
          js.push(
            name +
              "[" +
              quote("decodeInline" + definition.name) +
              "] = " +
              compileInlineDecode(definition, definitions) +
              ";"
          );
          js.push("");
          js.push(
            name +
              "[" +
              quote("encodeInline" + definition.name) +
              "] = " +
              compileInlineEncode(definition, definitions) +
              ";"
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

export function compileSchema(schema: Schema): any {
  const result = {
    ByteBuffer: ByteBuffer,
  };
  new Function("exports", compileSchemaJS(schema))(result);
  return result;
}
