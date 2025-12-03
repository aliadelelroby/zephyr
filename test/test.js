const assert = require("assert");
const zephyr = require("../ts/zephyr");
const fs = require("fs");
const it = require("node:test");

const schemaText = fs.readFileSync(__dirname + "/test-schema.zephyr", "utf8");
const schema = zephyr.compileSchema(zephyr.parseSchema(schemaText));

it("struct bool", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeBoolStruct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeBoolStruct(new Uint8Array(o)), { x: i });
  }

  check(false, [0]);
  check(true, [1]);
});

it("struct byte", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeByteStruct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeByteStruct(new Uint8Array(o)), { x: i });
  }

  check(0x00, [0x00]);
  check(0x01, [0x01]);
  check(0x7f, [0x7f]);
  check(0x80, [0x80]);
  check(0xff, [0xff]);
});

it("struct uint", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeUintStruct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeUintStruct(new Uint8Array(o)), { x: i });
  }

  check(0x00, [0x00]);
  check(0x01, [0x01]);
  check(0x02, [0x02]);
  check(0x7f, [0x7f]);
  check(0x80, [0x80, 0x01]);
  check(0x81, [0x81, 0x01]);
  check(0x100, [0x80, 0x02]);
  check(0x101, [0x81, 0x02]);
  check(0x17f, [0xff, 0x02]);
  check(0x180, [0x80, 0x03]);
  check(0x1ff, [0xff, 0x03]);
  check(0x200, [0x80, 0x04]);
  check(0x7fff, [0xff, 0xff, 0x01]);
  check(0x8000, [0x80, 0x80, 0x02]);
  check(0x7fffffff, [0xff, 0xff, 0xff, 0xff, 0x07]);
  check(0x80000000, [0x80, 0x80, 0x80, 0x80, 0x08]);
});

it("struct int", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeIntStruct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeIntStruct(new Uint8Array(o)), { x: i });
  }

  check(0x00, [0x00]);
  check(-0x01, [0x01]);
  check(0x01, [0x02]);
  check(-0x02, [0x03]);
  check(0x02, [0x04]);
  check(-0x3f, [0x7d]);
  check(0x3f, [0x7e]);
  check(-0x40, [0x7f]);
  check(0x40, [0x80, 0x01]);
  check(-0x3fff, [0xfd, 0xff, 0x01]);
  check(0x3fff, [0xfe, 0xff, 0x01]);
  check(-0x4000, [0xff, 0xff, 0x01]);
  check(0x4000, [0x80, 0x80, 0x02]);
  check(-0x3fffffff, [0xfd, 0xff, 0xff, 0xff, 0x07]);
  check(0x3fffffff, [0xfe, 0xff, 0xff, 0xff, 0x07]);
  check(-0x40000000, [0xff, 0xff, 0xff, 0xff, 0x07]);
  check(0x40000000, [0x80, 0x80, 0x80, 0x80, 0x08]);
  check(-0x7fffffff, [0xfd, 0xff, 0xff, 0xff, 0x0f]);
  check(0x7fffffff, [0xfe, 0xff, 0xff, 0xff, 0x0f]);
  check(-0x80000000, [0xff, 0xff, 0xff, 0xff, 0x0f]);
});

it("struct float", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeFloatStruct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(
      JSON.stringify(schema.decodeFloatStruct(new Uint8Array(o))),
      JSON.stringify({ x: i })
    );
  }

  check(0, [0]);
  check(1, [127, 0, 0, 0]);
  check(-1, [127, 1, 0, 0]);
  check(3.1415927410125732, [128, 182, 31, 146]);
  check(-3.1415927410125732, [128, 183, 31, 146]);
  check(Infinity, [255, 0, 0, 0]);
  check(-Infinity, [255, 1, 0, 0]);
  check(NaN, [255, 0, 0, 128]);
});

it("struct float16", function () {
  function check(i, o) {
    const encoded = schema.encodeFloat16Struct({ x: i });
    assert.deepEqual(Buffer.from(encoded), Buffer.from(o));
    const decoded = schema.decodeFloat16Struct(new Uint8Array(o));
    assert(Math.abs(decoded.x - i) < 0.01 || (isNaN(i) && isNaN(decoded.x)));
  }

  check(0, [0, 0]);
  check(1.0, [0, 60]);
  check(-1.0, [0, 188]);
  check(3.14, [71, 66]);
  check(-3.14, [71, 194]);
});

it("struct double", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeDoubleStruct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(
      JSON.stringify(schema.decodeDoubleStruct(new Uint8Array(o))),
      JSON.stringify({ x: i })
    );
  }

  check(0, [0, 0, 0, 0, 0, 0, 0, 0]);
  check(1.0, [0, 0, 0, 0, 0, 0, 240, 63]);
  check(-1.0, [0, 0, 0, 0, 0, 0, 240, 191]);
  check(3.141592653589793, [24, 45, 68, 84, 251, 33, 9, 64]);
});

it("struct string", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeStringStruct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeStringStruct(new Uint8Array(o)), { x: i });
  }

  check("", [0]);
  check("abc", [3, 97, 98, 99]);
  check(
    "🙉🙈🙊",
    [12, 240, 159, 153, 137, 240, 159, 153, 136, 240, 159, 153, 138]
  );
});

it("struct bytes", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeBytesStruct({ x: i })),
      Buffer.from(o)
    );
    const decoded = schema.decodeBytesStruct(new Uint8Array(o));
    assert.deepEqual(Array.from(decoded.x), Array.from(i || new Uint8Array()));
  }

  check(new Uint8Array(), [0]);
  check(new Uint8Array([1, 2, 3]), [3, 1, 2, 3]);
  check(new Uint8Array([0, 255, 128]), [3, 0, 255, 128]);
});

it("struct int64", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeInt64Struct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeInt64Struct(new Uint8Array(o)), { x: i });
  }

  check(0x00n, [0x00]);
  check(-0x01n, [0x01]);
  check(0x01n, [0x02]);
  check(-0x02n, [0x03]);
  check(0x02n, [0x04]);
  check(-0x3fn, [0x7d]);
  check(0x3fn, [0x7e]);
  check(-0x40n, [0x7f]);
  check(0x40n, [0x80, 0x01]);
  check(-0x3fffn, [0xfd, 0xff, 0x01]);
  check(0x3fffn, [0xfe, 0xff, 0x01]);
  check(-0x4000n, [0xff, 0xff, 0x01]);
  check(0x4000n, [0x80, 0x80, 0x02]);
  check(
    0x44070c1420304040n,
    [0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88]
  );
  check(
    -0x1000000000000001n,
    [0x81, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x20]
  );
  check(
    0x1000000000000001n,
    [0x82, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x20]
  );
  check(
    -0x3fffffffffffffffn,
    [0xfd, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]
  );
  check(
    0x3fffffffffffffffn,
    [0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]
  );
  check(
    -0x4000000000000000n,
    [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]
  );
  check(
    0x4000000000000000n,
    [0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]
  );
  check(
    -0x7fffffffffffffffn,
    [0xfd, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]
  );
  check(
    0x7fffffffffffffffn,
    [0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]
  );
  check(
    -0x8000000000000000n,
    [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]
  );
});

it("struct uint64", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeUint64Struct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeUint64Struct(new Uint8Array(o)), { x: i });
  }

  check(0x00n, [0x00]);
  check(0x01n, [0x01]);
  check(0x02n, [0x02]);
  check(0x7fn, [0x7f]);
  check(0x80n, [0x80, 0x01]);
  check(0x81n, [0x81, 0x01]);
  check(0x100n, [0x80, 0x02]);
  check(0x101n, [0x81, 0x02]);
  check(0x17fn, [0xff, 0x02]);
  check(0x180n, [0x80, 0x03]);
  check(0x1ffn, [0xff, 0x03]);
  check(0x200n, [0x80, 0x04]);
  check(0x7fffn, [0xff, 0xff, 0x01]);
  check(0x8000n, [0x80, 0x80, 0x02]);
  check(0x7fffffffn, [0xff, 0xff, 0xff, 0xff, 0x07]);
  check(0x80000000n, [0x80, 0x80, 0x80, 0x80, 0x08]);
  check(
    0x880e182840608080n,
    [0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88]
  );
  check(
    0x1000000000000001n,
    [0x81, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x10]
  );
  check(
    0x7fffffffffffffffn,
    [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]
  );
  check(
    0x8000000000000000n,
    [0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]
  );
  check(
    0xffffffffffffffffn,
    [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]
  );
});

it("struct compound", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeCompoundStruct(i)),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeCompoundStruct(new Uint8Array(o)), i);
  }

  check({ x: 0, y: 0 }, [0, 0]);
  check({ x: 1, y: 2 }, [1, 2]);
  check({ x: 12345, y: 54321 }, [185, 96, 177, 168, 3]);
});

it("struct nested", function () {
  function check(i, o) {
    assert.deepEqual(Buffer.from(schema.encodeNestedStruct(i)), Buffer.from(o));
    assert.deepEqual(schema.decodeNestedStruct(new Uint8Array(o)), i);
  }

  check({ a: 0, b: { x: 0, y: 0 }, c: 0 }, [0, 0, 0, 0]);
  check({ a: 1, b: { x: 2, y: 3 }, c: 4 }, [1, 2, 3, 4]);
  check(
    { a: 534, b: { x: 12345, y: 54321 }, c: 321 },
    [150, 4, 185, 96, 177, 168, 3, 193, 2]
  );
});

it("message bool", function () {
  function check(i, o) {
    assert.deepEqual(Buffer.from(schema.encodeBoolMessage(i)), Buffer.from(o));
    assert.deepEqual(schema.decodeBoolMessage(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check({ x: false }, [1, 0, 0]);
  check({ x: true }, [1, 1, 0]);
});

it("message byte", function () {
  function check(i, o) {
    assert.deepEqual(Buffer.from(schema.encodeByteMessage(i)), Buffer.from(o));
    assert.deepEqual(schema.decodeByteMessage(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check({ x: 234 }, [1, 234, 0]);
});

it("struct byte array", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeByteArrayStruct(i)),
      Buffer.from(o)
    );
    const decoded = schema.decodeByteArrayStruct(new Uint8Array(o));
    assert.deepEqual(Array.from(decoded.x), Array.from(i.x || []));
  }

  check({ x: new Uint8Array() }, [0]);
  check({ x: new Uint8Array([4, 5, 6]) }, [3, 4, 5, 6]);
});

it("message uint", function () {
  function check(i, o) {
    assert.deepEqual(Buffer.from(schema.encodeUintMessage(i)), Buffer.from(o));
    assert.deepEqual(schema.decodeUintMessage(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check({ x: 12345678 }, [1, 206, 194, 241, 5, 0]);
});

it("message int", function () {
  function check(i, o) {
    assert.deepEqual(Buffer.from(schema.encodeIntMessage(i)), Buffer.from(o));
    assert.deepEqual(schema.decodeIntMessage(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check({ x: 12345678 }, [1, 156, 133, 227, 11, 0]);
});

it("message float", function () {
  function check(i, o) {
    assert.deepEqual(Buffer.from(schema.encodeFloatMessage(i)), Buffer.from(o));
    assert.deepEqual(schema.decodeFloatMessage(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check({ x: 3.1415927410125732 }, [1, 128, 182, 31, 146, 0]);
});

it("message float16", function () {
  function check(i, o) {
    const encoded = schema.encodeFloat16Message(i);
    assert.deepEqual(Buffer.from(encoded), Buffer.from(o));
    const decoded = schema.decodeFloat16Message(new Uint8Array(o));
    assert(
      Math.abs(decoded.x - i.x) < 0.01 || (isNaN(i.x) && isNaN(decoded.x))
    );
  }

  check({}, [0]);
  check({ x: 0 }, [1, 0, 0, 0]);
  check({ x: 3.14 }, [1, 71, 66, 0]);
  check({ x: -1.5 }, [1, 0, 190, 0]); // Little-endian float16
});

it("message double", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeDoubleMessage(i)),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeDoubleMessage(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check({ x: 3.141592653589793 }, [1, 24, 45, 68, 84, 251, 33, 9, 64, 0]);
});

it("message string", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeStringMessage(i)),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeStringMessage(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check({ x: "" }, [1, 0, 0]);
  check(
    { x: "🙉🙈🙊" },
    [1, 12, 240, 159, 153, 137, 240, 159, 153, 136, 240, 159, 153, 138, 0]
  );
});

it("message bytes", function () {
  function check(i, o) {
    assert.deepEqual(Buffer.from(schema.encodeBytesMessage(i)), Buffer.from(o));
    const decoded = schema.decodeBytesMessage(new Uint8Array(o));
    assert.deepEqual(
      Array.from(decoded.x || new Uint8Array()),
      Array.from(i.x || new Uint8Array())
    );
  }

  check({}, [0]);
  check({ x: new Uint8Array([1, 2, 3]) }, [1, 3, 1, 2, 3, 0]);
});

it("message int64", function () {
  function check(i, o) {
    assert.deepEqual(Buffer.from(schema.encodeInt64Message(i)), Buffer.from(o));
    assert.deepEqual(schema.decodeInt64Message(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check(
    { x: 123456789012345678n },
    [0x01, 0x9c, 0xcd, 0x87, 0xe3, 0xf4, 0xd2, 0xcd, 0xb6, 0x03, 0x00]
  );
  check(
    { x: -123456789012345678n },
    [0x01, 0x9b, 0xcd, 0x87, 0xe3, 0xf4, 0xd2, 0xcd, 0xb6, 0x03, 0x00]
  );
});

it("message uint64", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeUint64Message(i)),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeUint64Message(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check(
    { x: 123456789012345678n },
    [0x01, 0xce, 0xe6, 0xc3, 0xb1, 0xba, 0xe9, 0xa6, 0xdb, 0x01, 0x00]
  );
});

it("message compound", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeCompoundMessage(i)),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeCompoundMessage(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check({ x: 123 }, [1, 123, 0]);
  check({ y: 234 }, [2, 234, 1, 0]);
  check({ x: 123, y: 234 }, [1, 123, 2, 234, 1, 0]);
  check({ y: 234, x: 123 }, [1, 123, 2, 234, 1, 0]);
});

it("message nested", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeNestedMessage(i)),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeNestedMessage(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check({ a: 123, c: 234 }, [1, 123, 3, 234, 1, 0]); // 234 = varint [234, 1]
  check({ b: { x: 5, y: 6 } }, [2, 5, 6, 0]);
  check({ b: { x: 5 }, c: 123 }, [2, 5, 0, 3, 123, 0]);
  check({ c: 123, b: { x: 5, y: 6 }, a: 234 }, [1, 234, 1, 2, 5, 6, 3, 123, 0]); // no separator after complete nested
});

it("struct bool array", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeBoolArrayStruct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeBoolArrayStruct(new Uint8Array(o)), { x: i });
  }

  check([], [0]);
  check([true, false], [2, 1]); // Bit-packed: 2 items, 1 byte (0b01 = 1)
});

it("message bool array", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeBoolArrayMessage(i)),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeBoolArrayMessage(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check({ x: [] }, [1, 0, 0]);
  check({ x: [true, false] }, [1, 2, 1, 0]); // field 1, 2 items, bit-packed byte 1, end
});

it("struct int array", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeIntArrayStruct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeIntArrayStruct(new Uint8Array(o)), { x: i });
  }

  check([], [0, 0]); // 0 items, no delta
  check([1, 2, 3], [3, 0, 2, 4, 6]); // 3 items, no delta (small array optimization), zigzag [2,4,6]
  check([-1, -2, -3], [3, 0, 1, 3, 5]); // 3 items, no delta, zigzag [1,3,5]
});

it("struct uint array", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeUintArrayStruct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeUintArrayStruct(new Uint8Array(o)), { x: i });
  }

  check([], [0, 0]); // 0 items, no delta
  check([1, 2, 3], [3, 0, 1, 2, 3]); // 3 items, no delta (small array optimization)
  check([100, 200, 300], [3, 0, 100, 200, 1, 172, 2]); // 3 items, no delta (deltas too large)
});

it("struct float array", function () {
  function check(i, o) {
    const encoded = schema.encodeFloatArrayStruct({ x: i });
    const decoded = schema.decodeFloatArrayStruct(encoded);
    assert(decoded.x.length === i.length);
    for (let j = 0; j < i.length; j++) {
      assert(
        Math.abs(decoded.x[j] - i[j]) < 0.0001 ||
          (isNaN(i[j]) && isNaN(decoded.x[j]))
      );
    }
  }

  check([], [0]);
  check([1.0, 2.0, 3.0], [3, 127, 0, 0, 0, 128, 0, 0, 0, 128, 64, 0, 0]);
});

it("struct float16 array", function () {
  function check(i, o) {
    const encoded = schema.encodeFloat16ArrayStruct({ x: i });
    const decoded = schema.decodeFloat16ArrayStruct(encoded);
    assert(decoded.x.length === i.length);
    for (let j = 0; j < i.length; j++) {
      assert(Math.abs(decoded.x[j] - i[j]) < 0.01);
    }
  }

  check([], [0]);
  check([1.0, 2.0, 3.0], [3, 60, 0, 64, 0, 64, 64]);
});

it("struct double array", function () {
  function check(i, o) {
    const encoded = schema.encodeDoubleArrayStruct({ x: i });
    const decoded = schema.decodeDoubleArrayStruct(encoded);
    assert(decoded.x.length === i.length);
    for (let j = 0; j < i.length; j++) {
      assert(
        Math.abs(decoded.x[j] - i[j]) < 0.0000001 ||
          (isNaN(i[j]) && isNaN(decoded.x[j]))
      );
    }
  }

  check([], [0]);
  check(
    [1.0, 2.0, 3.141592653589793],
    [
      3, 0, 0, 0, 0, 0, 0, 240, 63, 0, 0, 0, 0, 0, 0, 0, 64, 110, 134, 27, 240,
      249, 33, 9, 64,
    ]
  );
});

it("struct string array", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeStringArrayStruct({ x: i })),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeStringArrayStruct(new Uint8Array(o)), {
      x: i,
    });
  }

  check([], [0]);
  check(["a", "b", "c"], [3, 1, 97, 1, 98, 1, 99]);
  check(["", "test"], [2, 0, 4, 116, 101, 115, 116]);
});

it("struct bytes array", function () {
  function check(i, o) {
    const encoded = schema.encodeBytesArrayStruct({ x: i });
    const decoded = schema.decodeBytesArrayStruct(encoded);
    assert(decoded.x.length === i.length);
    for (let j = 0; j < i.length; j++) {
      assert.deepEqual(Array.from(decoded.x[j]), Array.from(i[j] || []));
    }
  }

  check([], [0]);
  check([new Uint8Array([1, 2]), new Uint8Array([3, 4])], [2, 0, 0]);
});

it("recursive message", function () {
  function check(i, o) {
    assert.deepEqual(
      Buffer.from(schema.encodeRecursiveMessage(i)),
      Buffer.from(o)
    );
    assert.deepEqual(schema.decodeRecursiveMessage(new Uint8Array(o)), i);
  }

  check({}, [0]);
  check({ x: {} }, [1, 0, 0]);
  check({ x: { x: {} } }, [1, 1, 0, 0, 0]);
});

it("message map", function () {
  function check(i, o) {
    const encoded = schema.encodeMapMessage(i);
    const decoded = schema.decodeMapMessage(encoded);
    assert.deepEqual(decoded, i);
  }

  check({}, [0]);
  check(
    { metadata: { key1: 100, key2: 200 } },
    [1, 2, 4, 107, 101, 121, 49, 200, 1, 4, 107, 101, 121, 50, 144, 3, 0]
  );
  check(
    { reverse: { 1: "one", 2: "two" } },
    [2, 1, 2, 1, 1, 1, 3, 111, 110, 101, 1, 2, 1, 3, 116, 119, 111, 0]
  );
});

it("struct fixed array", function () {
  function check(i, o) {
    const encoded = schema.encodeFixedArrayStruct(i);
    const decoded = schema.decodeFixedArrayStruct(encoded);
    assert(decoded.position.length === 4);
    for (let j = 0; j < 4; j++) {
      assert(Math.abs(decoded.position[j] - i.position[j]) < 0.01);
    }
    assert(decoded.indices.length === 8);
    for (let j = 0; j < 8; j++) {
      assert.deepEqual(decoded.indices[j], i.indices[j]);
    }
  }

  check(
    {
      position: [1.0, 2.0, 3.0, 4.0],
      indices: [0, 1, 2, 3, 4, 5, 6, 7],
    },
    [0, 126, 0]
  );
});

it("message with deprecated fields", function () {
  const nonDeprecated = {
    a: 1,
    b: 2,
    c: [3, 4, 5],
    d: [6, 7, 8],
    e: { x: 123 },
    f: { x: 234 },
    g: 9,
  };

  const deprecated = {
    a: 1,
    c: [3, 4, 5],
    e: { x: 123 },
    g: 9,
  };

  assert.deepEqual(
    schema.decodeDeprecatedMessage(
      schema.encodeNonDeprecatedMessage(nonDeprecated)
    ),
    deprecated
  );
  assert.deepEqual(
    schema.decodeNonDeprecatedMessage(
      schema.encodeDeprecatedMessage(nonDeprecated)
    ),
    deprecated
  );
});

it("binary schema", function () {
  const compiledSchema = zephyr.compileSchema(
    zephyr.decodeBinarySchema(
      zephyr.encodeBinarySchema(zephyr.parseSchema(schemaText))
    )
  );

  function check(message) {
    assert.deepEqual(
      Buffer.from(schema.encodeNestedMessage(message)),
      Buffer.from(compiledSchema.encodeNestedMessage(message))
    );
  }

  check({ a: 1, c: 4 });
  check({ a: 1, b: {}, c: 4 });
  check({ a: 1, b: { x: 2, y: 3 }, c: 4 });
});

it("schema round trip", function () {
  const parsed = zephyr.parseSchema(schemaText);
  const schemaText2 = zephyr.prettyPrintSchema(parsed);
  const parsed2 = zephyr.parseSchema(schemaText2);

  function deleteLocations(ast) {
    ast.definitions.forEach(function (definition) {
      delete definition.line;
      delete definition.column;
      definition.fields.forEach(function (field) {
        delete field.line;
        delete field.column;
      });
    });
  }

  deleteLocations(parsed);
  deleteLocations(parsed2);

  assert.deepEqual(parsed, parsed2);
});

it("typescript generation", function () {
  const tsSchema = `
    enum Status { PENDING = 0; ACTIVE = 1; }
    struct Point { float x; float y; }
    message User { uint id = 1; string name = 2; Status status = 3; Point[] points = 4; }
  `;
  const parsed = zephyr.parseSchema(tsSchema);
  const tsCode = zephyr.compileSchemaTypeScript(parsed);

  assert.ok(tsCode.includes("export const Status"));
  assert.ok(tsCode.includes('PENDING: "PENDING" as const'));
  assert.ok(tsCode.includes("export type Status"));
  assert.ok(tsCode.includes("export const StatusValues"));
  assert.ok(tsCode.includes("PENDING: 0"));
  assert.ok(tsCode.includes("export const StatusNames"));

  assert.ok(tsCode.includes("export interface Point"));
  assert.ok(tsCode.includes("x: number;"));

  assert.ok(tsCode.includes("export interface User"));
  assert.ok(tsCode.includes("id?: number;"));
  assert.ok(tsCode.includes("status?: Status;"));
  assert.ok(tsCode.includes("points?: Point[];"));

  assert.ok(tsCode.includes("export interface UserInput"));

  assert.ok(tsCode.includes("export interface Schema"));
  assert.ok(tsCode.includes("Status: typeof Status;"));
  assert.ok(tsCode.includes("encodeUser(message: UserInput): Uint8Array;"));
  assert.ok(tsCode.includes("decodeUser(buffer: Uint8Array): User;"));
});

it("typescript generation with type guards", function () {
  const tsSchema = `
    enum Type { A = 0; B = 1; }
    message Data { uint id = 1; Type type = 2; }
  `;
  const parsed = zephyr.parseSchema(tsSchema);
  const tsCode = zephyr.compileSchemaTypeScriptDeclaration(parsed);

  assert.ok(tsCode.includes("readonly id?: number;"));
  assert.ok(
    tsCode.includes("export function isType(value: unknown): value is Type")
  );
  assert.ok(
    tsCode.includes("export function isData(value: unknown): value is Data")
  );
});
