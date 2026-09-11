import { test } from "node:test";
import assert from "node:assert/strict";
import { decisionQrKey, validDecisionQrKey } from "../src/lib/decision-access.ts";
import { isPublicNavigation } from "../src/lib/public-navigation.ts";

test("QR access requires the signed entry key and fails closed without configuration", () => {
  const key = decisionQrKey("test-secret");
  assert.equal(validDecisionQrKey(key, "test-secret"), true);
  for (const value of [undefined, "", "true", [key], key.slice(1), "a".repeat(64)]) {
    assert.equal(validDecisionQrKey(value, "test-secret"), false);
  }
  assert.equal(validDecisionQrKey(key, "other-secret"), false);
  assert.equal(validDecisionQrKey(key, ""), false);
});
test("submission URLs cannot reappear through saved navigation", () => {
  for (const href of ["/bad-decisions", "/bad-decisions/", "/bad-decisions?qr=abc", "https://pinsandneedlescomedy.com/bad-decisions#form"]) {
    assert.equal(isPublicNavigation(href), false);
  }
  assert.equal(isPublicNavigation("/shows"), true);
});
