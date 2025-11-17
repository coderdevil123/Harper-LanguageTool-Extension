export function mergeResults(ltMatches = [], harper = { tone: [], terminology: [] }) {
  return {
    grammar: Array.isArray(ltMatches) ? ltMatches : [],
    harper: {
      tone: Array.isArray(harper.tone) ? harper.tone : [],
      terminology: Array.isArray(harper.terminology) ? harper.terminology : []
    }
  };
}
