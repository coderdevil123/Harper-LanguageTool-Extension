export async function checkWithLanguageTool(text) {
  try {
    const res = await fetch("http://localhost:8081/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        text: text,
        language: "en-US"
      })
    });

    const data = await res.json();

    return data.matches.map((m) => ({
      text: m.context.text,
      suggestion: m.replacements?.[0]?.value || "",
      rule: m.rule?.id || "LT_RULE"
    }));
  } catch (err) {
    console.error("LanguageTool error:", err);
    return [];
  }
}
