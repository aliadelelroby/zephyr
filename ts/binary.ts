import { ByteBuffer } from "./bb";
import { Schema, Field, Definition, DefinitionKind } from "./schema";

const types: (string | null)[] = [
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
  "uint64",
];
const kinds: DefinitionKind[] = ["ENUM", "STRUCT", "MESSAGE"];

export function decodeBinarySchema(buffer: Uint8Array | ByteBuffer): Schema {
  const bb = buffer instanceof ByteBuffer ? buffer : new ByteBuffer(buffer);
  const definitionCount = bb.readVarUint();
  const definitions: Definition[] = [];

  for (let i = 0; i < definitionCount; i++) {
    const definitionName = bb.readString();
    const kind = bb.readByte();
    const fieldCount = bb.readVarUint();
    const fields: Field[] = [];

    for (let j = 0; j < fieldCount; j++) {
      const fieldName = bb.readString();
      const type = bb.readVarInt();
      const isArray = !!(bb.readByte() & 1);
      const isFixedArray = !!(bb.readByte() & 1);
      const isMap = !!(bb.readByte() & 1);
      let arraySize: number | undefined = undefined;
      let keyType: string | null = null;

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
        type: kinds[kind] === "ENUM" ? null : (type as any),
        isArray: isArray,
        isFixedArray: isFixedArray,
        isMap: isMap,
        arraySize: arraySize,
        keyType: keyType || undefined,
        isDeprecated: false,
        value: value,
      });
    }

    definitions.push({
      name: definitionName,
      line: 0,
      column: 0,
      kind: kinds[kind],
      fields: fields,
    });
  }

  const definitionIndex: { [name: string]: number } = {};
  for (let i = 0; i < definitionCount; i++) {
    definitionIndex[definitions[i].name] = i;
  }

  for (let i = 0; i < definitionCount; i++) {
    const fields = definitions[i].fields;
    for (let j = 0; j < fields.length; j++) {
      const field = fields[j];
      let type = field.type as any as number | null;

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
    definitions: definitions,
  };
}

export function encodeBinarySchema(schema: Schema): Uint8Array {
  const bb = new ByteBuffer();
  const definitions = schema.definitions;
  const definitionIndex: { [name: string]: number } = {};

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
      bb.writeVarInt(type === -1 ? definitionIndex[field.type!] : ~type);
      bb.writeByte(field.isArray ? 1 : 0);
      bb.writeByte(field.isFixedArray ? 1 : 0);
      bb.writeByte(field.isMap ? 1 : 0);

      if (field.isFixedArray && field.arraySize !== undefined) {
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
