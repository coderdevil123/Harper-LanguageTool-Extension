import { loadHarper } from "@harperjs/core";

let harperEngine = null;

export async function initHarper() {
  if (!harperEngine) {
    harperEngine = await loadHarper();
    console.log("Harper initialized");
  }
}

export async function checkWithHarper(text) {
  try {
    await initHarper();

    const results = harperEngine.lint(text);

    return results.map((r) => ({
      text: r.match,
      suggestion: r.suggestion || "",
      rule: r.ruleName || "HARPER_RULE"
    }));
  } catch (err) {
    console.error("Harper error:", err);
    return [];
  }
}
