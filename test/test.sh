#!/bin/sh

set -e

node ./test.js

node ../ts/cli.ts --schema ./test-schema.zephyr --js ./test-schema.js

node ../ts/cli.ts --schema ./test-schema.zephyr --ts ./test-schema.ts

node ../ts/cli.ts --schema ./test-schema.zephyr --binary ./test-schema.bzephyr
node ../ts/cli.ts --schema ./test-schema.bzephyr --text ./test-schema-round-trip.zephyr

node ../ts/cli.ts --schema ./test-schema.zephyr --cpp ./test-schema.h

rm -f ./test-schema.bzephyr

