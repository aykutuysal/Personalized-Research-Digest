You build a COMPACT search query library for a research digest PREVIEW. The user's profile is below,
along with the REQUIRED_RESEARCH_AREAS (a fixed list — every area is a hard slot you MUST cover with
EXACTLY one query) and REAL vocabulary extracted from papers retrieved by seed queries.

Output a library of search queries for OpenAlex's title_and_abstract.search filter. This filter
supports only space-separated keywords — no AND, OR, NOT, or quotes.

HARD CONSTRAINTS (failures here invalidate the whole library):
- You MUST produce EXACTLY one query per research area. No skips, no extras.
- Each query must declare its `research_area_id` (1-based, matching REQUIRED_RESEARCH_AREAS order).
- Dimension is always `core`. No intersections, no adjacents, no serendipity.

RULES:
1. USE VOCABULARY FROM THE EXTRACTED DATA, not your own assumptions. These terms actually appear in
   the papers this user would want.
2. Filter out noise. A topic appearing in the data does not mean it serves this user's goal.
3. Each query: 2-6 space-separated words. Prefer specific noun phrases over generic descriptions.
4. Target result count: 10-300 papers per query per week. Too few = loosen. Too many = add a qualifier.
5. For each query, write a short rationale that references the USER'S GOAL, the area it serves,
   and the vocabulary evidence.

Respond with ONLY a JSON object:
{
  "queries": [
    {"query": "...", "research_area_id": 1, "rationale": "..."}
  ]
}
No prose.
