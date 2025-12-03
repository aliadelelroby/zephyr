#!/usr/bin/env node

import * as fs from "node:fs";
import { compileSchema, compileSchemaJS } from "./js";
import { compileSchemaTypeScript } from "./ts";
import { compileSchemaCPP } from "./cpp";
import { compileSchemaRust } from "./rust";
import { Schema } from "./schema";
import { encodeBinarySchema, decodeBinarySchema } from "./binary";
import { prettyPrintSchema } from "./printer";
import { parseSchema } from "./parser";
import { ByteBuffer } from "./bb";

const usage = `
Usage: zephyrc [OPTIONS]

Options:

  --help                Print this message.
  --schema [PATH]       The schema file to use.
  --js [PATH]           Generate JavaScript code.
  --ts [PATH]           Generate TypeScript type definitions.
  --ts-readonly         Make decoded types readonly (use with --ts).
  --ts-guards           Generate type guard functions (use with --ts).
  --ts-no-input-types   Don't generate separate input types (use with --ts).
  --cpp [PATH]          Generate C++ code.
  --rust [PATH]         Generate Rust code.
  --text [PATH]         Encode the schema as text.
  --binary [PATH]       Encode the schema as a binary blob.
  --root-type [NAME]    Set the root type for JSON.
  --to-json [PATH]      Convert a binary file to JSON.
  --from-json [PATH]    Convert a JSON file to binary.

Examples:

  zephyrc --schema test.zephyr --js test.js
  zephyrc --schema test.zephyr --ts test.ts
  zephyrc --schema test.zephyr --ts test.ts --ts-readonly --ts-guards
  zephyrc --schema test.zephyr --cpp test.h
  zephyrc --schema test.zephyr --rust test.rs
  zephyrc --schema test.zephyr --binary test.bzephyr
  zephyrc --schema test.zephyr --root-type Test --from-json buffer.json
  zephyrc --schema test.zephyr --root-type Test --to-json buffer.bin
`;

function writeFileString(path: string, text: string): void {
  try {
    if (fs.readFileSync(path, "utf8") === text) {
      return;
    }
  } catch (e) {
    // File doesn't exist, continue
  }
  fs.writeFileSync(path, text);
}

function writeFileBuffer(path: string, buffer: Buffer): void {
  try {
    if (fs.readFileSync(path).equals(buffer)) {
      return;
    }
  } catch (e) {
    // File doesn't exist, continue
  }
  fs.writeFileSync(path, buffer);
}

function main(args: string[]): number {
  const flags: { [flag: string]: string | null } = {
    "--schema": null,
    "--js": null,
    "--ts": null,
    "--cpp": null,
    "--rust": null,
    "--binary": null,
    "--text": null,
    "--root-type": null,
    "--to-json": null,
    "--from-json": null,
  };

  const boolFlags: { [flag: string]: boolean } = {
    "--ts-readonly": false,
    "--ts-guards": false,
    "--ts-no-input-types": false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help" || arg[0] !== "-") {
      console.log(usage);
      return 1;
    } else if (arg in boolFlags) {
      boolFlags[arg] = true;
    } else if (arg in flags) {
      if (i + 1 === args.length) {
        throw new Error(
          "Missing value for " +
            JSON.stringify(arg) +
            ' (use "--help" for usage)'
        );
      }
      flags[arg] = args[++i];
    } else {
      throw new Error(
        "Unknown flag " + JSON.stringify(arg) + ' (use "--help" for usage)'
      );
    }
  }

  if (flags["--schema"] === null) {
    console.log(usage);
    return 1;
  }

  let buffer = fs.readFileSync(flags["--schema"]);
  const isText = Array.prototype.indexOf.call(buffer, 0) === -1;
  const content = isText ? buffer.toString() : new Uint8Array(buffer);

  let parsed: Schema;
  let compiled: any;
  try {
    parsed =
      typeof content === "string"
        ? parseSchema(content)
        : decodeBinarySchema(new ByteBuffer(content));
    compiled = compileSchema(parsed);
  } catch (err) {
    const e = err as Error | (Error & { line: number; column: number });
    if (e && e.message && "line" in e && "column" in e) {
      e.message =
        flags["--schema"] +
        ":" +
        e.line +
        ":" +
        e.column +
        ": error: " +
        e.message;
      if (typeof content === "string") {
        e.message +=
          "\n" +
          content.split("\n")[e.line - 1] +
          "\n" +
          new Array(e.column).join(" ") +
          "^";
      }
    }
    throw e;
  }

  const rootType = flags["--root-type"];
  if (
    rootType !== null &&
    !("encode" + rootType in compiled && "decode" + rootType in compiled)
  ) {
    throw new Error("Invalid root type: " + JSON.stringify(rootType));
  }

  if (flags["--js"] !== null) {
    writeFileString(flags["--js"], compileSchemaJS(parsed));
  }

  if (flags["--ts"] !== null) {
    const tsOptions = {
      readonly: boolFlags["--ts-readonly"],
      typeGuards: boolFlags["--ts-guards"],
      inputTypes: !boolFlags["--ts-no-input-types"],
    };
    writeFileString(flags["--ts"], compileSchemaTypeScript(parsed, tsOptions));
  }

  if (flags["--cpp"] !== null) {
    writeFileString(flags["--cpp"], compileSchemaCPP(parsed));
  }

  if (flags["--rust"] !== null) {
    writeFileString(flags["--rust"], compileSchemaRust(parsed));
  }

  if (flags["--binary"] !== null) {
    writeFileBuffer(flags["--binary"], Buffer.from(encodeBinarySchema(parsed)));
  }

  if (flags["--text"] !== null) {
    writeFileBuffer(flags["--text"], Buffer.from(prettyPrintSchema(parsed)));
  }

  if (flags["--to-json"] !== null) {
    if (rootType === null) {
      throw new Error("Missing flag --root-type when using --to-json");
    }
    const replacer = (k: any, v: any) => (typeof v === "bigint" ? "" + v : v);
    writeFileString(
      flags["--to-json"] + ".json",
      JSON.stringify(
        (compiled as any)["decode" + rootType](
          new Uint8Array(fs.readFileSync(flags["--to-json"]))
        ),
        replacer,
        2
      ) + "\n"
    );
  }

  if (flags["--from-json"] !== null) {
    if (rootType === null) {
      throw new Error("Missing flag --root-type when using --from-json");
    }
    writeFileBuffer(
      flags["--from-json"] + ".bin",
      Buffer.from(
        (compiled as any)["encode" + rootType](
          JSON.parse(fs.readFileSync(flags["--from-json"], "utf8"))
        )
      )
    );
  }

  return 0;
}

exports.main = main;

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
