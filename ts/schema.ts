/**
 * Schema definitions for Zephyr protocol
 */

export interface Schema {
  package: string | null;
  definitions: Definition[];
}

export type DefinitionKind = "ENUM" | "STRUCT" | "MESSAGE";

export interface Definition {
  name: string;
  line: number;
  column: number;
  kind: DefinitionKind;
  fields: Field[];
}

export interface Field {
  name: string;
  line: number;
  column: number;
  type: string | null;
  isArray: boolean;
  isFixedArray: boolean;
  isMap: boolean;
  arraySize?: number;
  keyType?: string | null;
  isDeprecated: boolean;
  value: number;
}
