import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { serializePanelParams } from "./panel-params"

describe("serializePanelParams", () => {
  test("preserves home filters while replacing panel state", () => {
    assert.equal(
      serializePanelParams(
        "?q=runtime&project=agents&type=review&panel=comments&thread=old",
        { panel: "colab", thread: null, node: "2.1", pick: "1" },
      ),
      "?q=runtime&project=agents&type=review&panel=colab&node=2.1&pick=1",
    )
  })

  test("removes only panel parameters when closing", () => {
    assert.equal(
      serializePanelParams(
        "?q=runtime&type=explainer&panel=comments&thread=one",
        { panel: null, thread: null, node: null, pick: null },
      ),
      "?q=runtime&type=explainer",
    )
  })
})
