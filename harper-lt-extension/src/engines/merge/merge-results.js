export function mergeResults(lt = [], harper = {}) {
    return {
        grammar: lt,
        harper: {
            tone: harper.tone || [],
            terminology: harper.terminology || []
        }
    };
}
