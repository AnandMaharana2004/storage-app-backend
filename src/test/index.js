// here we need to apply testing

import assert from "node:assert";
import test from "node:test";

test("basic testing", () => {
  assert.strictEqual(addNumber(1, 2), 3);
});

function addNumber(a, b) {
  return a + b;
}
