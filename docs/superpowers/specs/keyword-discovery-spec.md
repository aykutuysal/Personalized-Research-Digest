# Keyword Discovery for Preview — Implementation Spec

This document specifies the keyword/query discovery mechanism used during onboarding to build a grounded query library before the preview digest is generated. It is written for an implementing LLM or engineer to build without further clarification.

---

## Problem Statement

A user describes their research interests in natural language during an onboarding chat. To find papers relevant to them, the system needs search queries that:

1. **Match how papers are actually worded** — not how the user speaks. A marketing director who says "behavioral science" won't find papers that use "neuromarketing," "consumer behaviour" (British spelling), or "subconscious." A health-curious person who says "gut brain connection" won't find papers that use "gut-brain axis," "dysbiosis," or "psychobiotics."

2. **Cover the full shape of their interest** — not just the obvious angle. A user interested in measurement-based care might also benefit from papers tagged under Psychedelic Therapy, Implementation Science, or LGBTQ Health — all of which publish measurement-based care research under different primary topics.

3. **Return usable volumes** — between ~5 and ~500 results per query per weekly window. Too few means silence; too many means noise.

LLMs cannot solve this from their training data alone. They don't know what terms actually index papers in OpenAlex, and their guesses at "adjacent fields" are often wrong or imagined. The discovery mechanism must be **grounded in real paper metadata**, not LLM imagination.

---

## Mechanism Overview

```
USER CHAT OUTPUT
  ↓
[1] Generate seed queries (LLM, literal)
  ↓
[2] Run seeds against OpenAlex (code, parallel)
  ↓
[3] Extract vocabulary from returned papers (code)
  ↓
[4] Build refined query library (LLM, grounded)
  ↓
[5] Validate each query (code)
  ↓
[6] Reformulate failures (LLM, optional)
  ↓
FINAL QUERY LIBRARY
```

Three LLM calls, three code steps. Total budget: ~$0.005. Total time: 2-4 seconds.

---

## Step 1: Generate Seed Queries

### Purpose

Convert the user's natural-language interests into 3-5 broad search phrases that will return a representative sample of papers in their general area. These are nets, not scalpels.

### Input

The user profile produced by the onboarding chat:

```typescript
{
  description: string;   // AI-synthesized summary of their interests
  role: string;          // e.g., "researcher", "marketing director"
  seniority: string;     // academic stage or non-academic
  goal: string;          // why they want the digest
}
```

Plus the list of angles confirmed in the chat (e.g., "methods", "applications", "specific populations").

### LLM Call

**Model:** Haiku (this is a simple extraction task)

**Prompt:**

```
You are generating SEED search queries for an academic paper database
(OpenAlex). The user's profile is below.

Generate 3-5 broad seed queries that will return papers in this person's
general area. These are seed queries — their job is to retrieve a sample
of real papers whose metadata we can mine for better vocabulary later.

Rules:
1. Use the user's OWN terminology from their profile. Do not introduce
   jargon they didn't mention.
2. Keep each query simple: 2-4 words, space-separated. No boolean
   operators, no quotes, no special syntax.
3. Do NOT get creative. Do NOT combine too many concepts. Each query
   should represent one clean angle of their interest.
4. Prefer noun phrases over descriptions. "consumer psychology" beats
   "how consumers make decisions."

USER PROFILE:
{profile.description}

GOAL:
{profile.goal}

CONFIRMED ANGLES FROM CHAT:
{list of angles}

Return as JSON only:
{"seeds": ["query 1", "query 2", "query 3"]}
```

### Example Outputs

**Clinical psychologist:**
```json
{"seeds": ["measurement-based care", "digital mental health", "clinical outcomes psychotherapy"]}
```

**Marketing director:**
```json
{"seeds": ["consumer psychology", "decision making advertising", "behavioral science marketing"]}
```

**AI/software engineer:**
```json
{"seeds": ["AI agents", "LLM autonomous", "agentic software"]}
```

**Health-curious non-academic:**
```json
{"seeds": ["gut brain anxiety", "microbiome mental health", "nutrition anxiety stress"]}
```

### Why Literal

The temptation is to let the LLM be clever — generate queries like `"adaptive dosing AND depression"` or `"neural correlates of brand preference"`. Don't. Those clever queries often return zero results because the exact phrasing isn't what papers use. The purpose of this step is to get a wide net that retrieves *enough* papers to mine for real vocabulary in Step 3.

### Cost

~$0.0001 per call.

---

## Step 2: Run Seeds Against OpenAlex

### Purpose

Retrieve a sample of real papers — with full metadata — for vocabulary mining.

### API Call Pattern

For each seed, make one API request:

```
GET https://api.openalex.org/works
  ?filter=title_and_abstract.search:{URL_ENCODED_SEED},
          from_publication_date:{SIX_MONTHS_AGO}
  &per_page=50
  &select=title,primary_topic,keywords,primary_location,publication_date,abstract_inverted_index,cited_by_count
  &mailto=your_email@example.com
```

### Critical Parameters

**`title_and_abstract.search`** — not `default.search`. The `default.search` includes fulltext, which returns far too much noise. In our testing, `default.search` returned 27,267 papers for "measurement-based care" over 6 weeks; `title_and_abstract.search` returned 651. The latter is the right precision for this use case.

**`from_publication_date`** — use 6 months ago, not 1 week. Weekly windows are too thin for vocabulary extraction; you want enough papers to see real patterns. The vocabulary you extract will be used to build queries that ARE run against a 1-week window later.

**`per_page=50`** — we want 50 papers per seed, so typically 150 total across 3 seeds. This is enough to see stable term frequencies without over-fetching.

**`mailto`** — include for the OpenAlex polite pool (faster response times, higher rate limits, no auth required).

### Execution

Run all 3-5 seed queries in parallel (not sequential). Total time: ~400ms.

### Failure Handling

If a seed returns zero results, it's too specific or uses terms that don't appear in paper titles/abstracts. Don't fail the whole pipeline — drop the empty seed and continue with the others. If all seeds return zero, fall back to running the user's raw `profile.description` as a single query.

### Cost

~$0.003-0.005 in OpenAlex API calls (well under the free tier).

---

## Step 3: Extract Vocabulary

### Purpose

Mine the returned papers' metadata to discover the real vocabulary that indexes papers in the user's area — including the adjacent fields they wouldn't have thought to search.

This is pure code. No LLM.

### Data to Extract

For every paper returned across all seed queries, extract and aggregate:

**Topics** — from `primary_topic.display_name`. These are OpenAlex's classifications (~4,500 topics across 4 levels). Count how often each topic appears across the seed papers. The top topics reveal both the core field AND adjacent fields.

**Subfields** — from `primary_topic.subfield.display_name`. Coarser than topics, useful for identifying broader research areas.

**Fields** — from `primary_topic.field.display_name`. Coarsest level (e.g., "Psychology", "Medicine", "Computer Science"). Useful for catching cross-disciplinary signals.

**Keywords** — from `keywords[].display_name`. These are OpenAlex's automated keyword extractions. Count frequency across papers.

**Journals** — from `primary_location.source.display_name`. Frequent journals suggest where the user's field lives and what to trust.

### Aggregation Code

```python
from collections import Counter

topic_counts = Counter()
subfield_counts = Counter()
field_counts = Counter()
keyword_counts = Counter()
journal_counts = Counter()
sample_titles = []

for seed_query_results in all_seed_results:
    for paper in seed_query_results:
        sample_titles.append(paper['title'])

        topic = paper.get('primary_topic')
        if topic:
            topic_counts[topic['display_name']] += 1
            if topic.get('subfield'):
                subfield_counts[topic['subfield']['display_name']] += 1
            if topic.get('field'):
                field_counts[topic['field']['display_name']] += 1

        for kw in paper.get('keywords', []):
            name = kw.get('display_name', '')
            if is_valid_keyword(name):
                keyword_counts[name] += 1

        loc = paper.get('primary_location') or {}
        source = (loc.get('source') or {}).get('display_name')
        if source:
            journal_counts[source] += 1
```

### Keyword Filtering

OpenAlex keywords are noisy. Filter out:

- **Terms containing parentheses**: `"Quality (philosophy)"`, `"Work (physics)"`, `"Context (archaeology)"` — these are disambiguation artifacts, not useful research terms.
- **Terms shorter than 3 characters**: acronym noise.
- **Overly generic single words**: `"study"`, `"research"`, `"analysis"` — these match everything.

```python
def is_valid_keyword(name: str) -> bool:
    if not name or len(name) < 3:
        return False
    if '(' in name or ')' in name:
        return False
    if name.lower() in {'study', 'research', 'analysis', 'method', 'result'}:
        return False
    return True
```

### Output

A structured vocabulary package:

```python
vocabulary = {
    "topics": topic_counts.most_common(15),
    "subfields": subfield_counts.most_common(10),
    "fields": field_counts.most_common(5),
    "keywords": keyword_counts.most_common(25),
    "journals": journal_counts.most_common(10),
    "sample_titles": sample_titles[:15],
}
```

This package is typically ~500 tokens. Small enough to fit comfortably in the next LLM call's context.

### What the Extracted Data Reveals (Empirical)

From actual testing against OpenAlex with real profiles:

**Marketing director — seeds: "consumer psychology", "decision making advertising", "behavioral science marketing"**

150 papers analyzed. Top extracted terms:

| Type | Terms (with counts) |
|------|---------------------|
| Keywords | Consumer behaviour (76x, note British spelling), Social media (26x), Neuromarketing (14x), Subconscious (10x), Decision theory (6x), Brand loyalty (6x) |
| Topics | Consumer Behavior in Brand Consumption and Identification (13x), AI in Service Interactions (10x), Decision-Making and Behavioral Economics (4x), Color perception and design (3x), Language, Metaphor, and Cognition (2x) |
| Subfields | Marketing (49x), Experimental and Cognitive Psychology (2x), General Decision Sciences (4x) |

The user would never have searched for "consumer behaviour" (British spelling), "neuromarketing," or the "Color perception and design" topic — but all three surface high-value papers.

**Health-curious non-academic — seeds: "gut brain anxiety", "microbiome mental health", "nutrition anxiety stress"**

150 papers analyzed. Top extracted terms:

| Type | Terms (with counts) |
|------|---------------------|
| Keywords | Gut–brain axis (28x), Dysbiosis (19x), Microbiome (40x), Metagenomics (9x), Psychobiotics (in titles), Anxiolytic (5x), Neurotrophic factors (7x), Tryptophan (in titles) |
| Topics | Gut microbiota and health (70x), Tryptophan and brain disorders (3x), Oral microbiology and periodontitis research (3x), Probiotics and Fermented Foods (1x), Vagus Nerve Stimulation Research (1x) |

The user said "gut brain connection" — papers say "gut–brain axis." The user said "anxiety" — papers say "anxiolytic." The user would never guess "oral microbiology" or "vagus nerve stimulation" are adjacent fields, but they are.

**This is not solvable by LLM imagination.** The vocabulary gap is only bridged by reading real papers.

---

## Step 4: Build Refined Query Library

### Purpose

Turn the extracted vocabulary into a concrete query library of 12-16 search phrases that cover the user's interest space efficiently.

### LLM Call

**Model:** Sonnet (judgment-heavy task: filter noise, combine dimensions, balance coverage)

**Prompt:**

```
You are building a search query library for a research digest. The user's
profile is below, along with REAL vocabulary extracted from papers retrieved
by seed queries.

USER PROFILE: {profile}
USER GOAL: {profile.goal}

ANGLES CONFIRMED IN CHAT: {angles}

SEED QUERIES ALREADY RUN:
{list of seeds with result counts}

EXTRACTED VOCABULARY (from 150 real papers in this user's area):

Topics found on seed papers (OpenAlex's classification):
{topic_counts list}

Subfields:
{subfield_counts list}

Keywords from paper metadata:
{keyword_counts list}

Sample titles:
{sample_titles}

YOUR JOB:
Build a query library of 12-16 search queries for OpenAlex's
title_and_abstract.search filter. This filter supports only space-separated
keywords — no AND, OR, NOT, or quotes.

RULES:
1. USE VOCABULARY FROM THE EXTRACTED DATA, not your own assumptions. These
   are terms that actually appear in the papers this user would want.
2. Filter out noise. Just because a topic appeared in the data doesn't
   mean it serves this user's goal. A marketing director's data might
   include "Environmental Sustainability in Business" — but unless their
   goal involves sustainability specifically, exclude it.
3. Include a balanced mix:
   - **core** (4-6 queries): obvious searches, refined with real vocab
   - **intersection** (3-5): combining two dimensions the user cares about
   - **adjacent** (2-3): topics from related fields that could yield
     surprising but applicable insights
   - **serendipity** (1-2): unexpected fields that appeared in the data
     and might yield "wow" papers
4. Each query: 2-6 space-separated words. Prefer specific noun phrases over
   generic descriptions.
5. Target result count: 10-300 papers per query per week. Too few = loosen.
   Too many = add a qualifier.
6. For each query, write a rationale that references the USER'S GOAL and
   the vocabulary evidence.
7. Assign priority: every_cycle, rotate_biweekly, or rotate_monthly.

Respond in JSON only:
{
  "queries": [
    {
      "query": "...",
      "dimension": "core|intersection|adjacent|serendipity",
      "priority": "every_cycle|rotate_biweekly|rotate_monthly",
      "rationale": "..."
    }
  ]
}
```

### Why Sonnet Not Haiku

This step requires judgment. The LLM must:
- Distinguish signal from noise in extracted vocabulary (is this term relevant to the user's goal, or did it appear incidentally?)
- Balance coverage across dimensions (not all core, not all serendipity)
- Combine terms productively (intersection queries that wouldn't exist as standalone extracted terms)
- Calibrate specificity (neither too broad nor too narrow)

Haiku can do it but produces lower-quality judgment calls. Sonnet is worth the cost here — this is the step that determines the quality of every future digest.

### Example Output (Marketing Director)

```json
{
  "queries": [
    {
      "query": "neuromarketing consumer decision",
      "dimension": "core",
      "priority": "every_cycle",
      "rationale": "Neuromarketing (14x in data) is the scientific backbone of how brains respond to marketing stimuli — directly supports user's goal of applying behavioral science to campaigns."
    },
    {
      "query": "consumer behaviour purchasing",
      "dimension": "core",
      "priority": "every_cycle",
      "rationale": "Most frequent terms in extracted data (76x + 19x). Note British spelling — the user would not have searched with this phrasing."
    },
    {
      "query": "color psychology consumer",
      "dimension": "adjacent",
      "priority": "rotate_biweekly",
      "rationale": "'Color perception and design' topic (3x) on relevant papers. Surprising, specific, immediately actionable for creative work."
    },
    {
      "query": "augmented reality consumer experience",
      "dimension": "serendipity",
      "priority": "rotate_monthly",
      "rationale": "Appeared in titles from adjacent field. Emerging tech × consumer behavior — future-looking, matches the 'apply to campaigns' goal."
    }
    // ... 10-12 more queries
  ]
}
```

### Cost

~$0.003-0.005 per call.

---

## Step 5: Validate Queries

### Purpose

Catch failed queries (zero results) and overly broad queries (too many results) before they reach the user's config.

### Execution

Run each generated query against OpenAlex with the same date window the preview uses (the last 7 days):

```
GET https://api.openalex.org/works
  ?filter=title_and_abstract.search:{URL_ENCODED_QUERY},
          from_publication_date:{SEVEN_DAYS_AGO}
  &per_page=1
  &select=title
  &mailto=your_email@example.com
```

We only need the `meta.count` to validate. Fetch `per_page=1` to minimize payload.

Run all 12-16 validations in parallel. Total time: ~500ms.

### Thresholds

| Result count | Interpretation | Action |
|--------------|----------------|--------|
| 0 | Query failed — vocabulary mismatch or too specific | Flag for reformulation |
| 1-4 | Very low — acceptable only for `rotate_monthly` priority | If marked `every_cycle`, flag for reformulation |
| 5-500 | Good | Keep as-is |
| 500-1500 | Broad — acceptable if `every_cycle` with a clear rationale | Keep, flag for monitoring |
| >1500 | Too broad — too much noise to be useful | Flag for narrowing |

Store `last_run_count` on each query for future reference.

### When to Trigger Reformulation

If ≤2 queries failed, accept the library as-is. A few zero-result queries in a weekly window is expected — those niches just didn't publish this week, and they may be valuable in future weeks.

If ≥3 queries failed, run one reformulation pass (Step 6).

---

## Step 6: Reformulate Failures (Optional)

### Purpose

Fix the failed queries using the vocabulary evidence.

### LLM Call

**Model:** Haiku (targeted adjustment, not deep judgment)

**Prompt:**

```
These queries did not perform well against OpenAlex:

FAILURES:
{list of failed queries with their counts and why they failed}

EXTRACTED VOCABULARY (same as original):
{vocabulary package}

Reformulate each failing query. Rules:
- For ZERO-result queries: the vocabulary was wrong. Replace terms with
  phrases from the extracted keywords or topics. Loosen if needed.
- For TOO-BROAD queries (>1500): add a qualifier from the user's goal to
  make them more specific.
- For NEAR-ZERO queries (1-4 results) marked every_cycle: loosen by
  replacing the most specific term with a broader one from the vocabulary.

Return only the reformulated queries, same JSON structure as before.
```

### Re-Validate

Run the new queries through Step 5 one more time. Accept whatever the result is — don't loop more than once at this stage. Deep refinement happens post-payment (Step 8 of the onboarding spec), not here.

### Cost

~$0.0002 per call.

---

## Empirical Validation

Tested against real OpenAlex data for 4 distinct user profiles. 55 queries generated across profiles, all using the seed-extract-build method:

| Metric | Value |
|--------|-------|
| Queries returning ≥1 result | 54/55 (98%) |
| Queries in ideal 5-500 range | 36/55 (65%) |
| Queries needing calibration | 19/55 (35%) |
| Queries fixed by one reformulation pass | ~15/19 estimated |

### Vocabulary Bridging — Empirical Examples

The following mismatches were real and were only bridged by the extraction step:

| User said | Papers say | Extra papers surfaced |
|-----------|-----------|----------------------|
| "measurement-based care" | "routine outcome monitoring" | 651 additional papers |
| "digital mental health" | "mHealth" | Different paper set |
| "consumer behavior" | "consumer behaviour" (British) | Major coverage gap closed |
| "behavioral science" | "neuromarketing", "subconscious" | New research angles |
| "AI agents" | "autonomous agent", "intelligent agent" | Formal CS terminology |
| "gut brain connection" | "gut-brain axis", "dysbiosis", "psychobiotics" | Proper scientific terms |
| "anxiety" | "anxiolytic" | Clinical vocabulary |

None of these bridges would have been discovered by LLM imagination alone. They emerge only from reading real paper metadata.

---

## Timing & Cost Summary

| Step | Duration | LLM cost | API cost |
|------|----------|----------|----------|
| 1. Generate seeds | 400ms | $0.0001 | — |
| 2. Run seeds (parallel) | 400ms | — | $0.003 |
| 3. Extract vocabulary | <50ms | — | — |
| 4. Build query library | 1-2s | $0.003-0.005 | — |
| 5. Validate (parallel) | 500ms | — | $0.002 |
| 6. Reformulate (optional) | 500ms | $0.0002 | $0.001 |
| **Total** | **~3-4s** | **~$0.005** | **~$0.006** |

Total cost per onboarding: ~$0.01. Well within budget for users who may never convert.

---

## Failure Modes & Handling

**All seeds return zero results** — the user's profile description uses terminology not present anywhere in OpenAlex. Fall back to running the full `profile.description` as a single wildcard query to get any sample of papers. If that also fails, show the user a message: "We couldn't find papers matching your interests. Try rephrasing with more specific research terms."

**Extracted vocabulary is too sparse** — fewer than 50 papers total across all seeds. The user's area may be very niche. Continue with the sparse vocabulary but flag the query library as potentially incomplete. The post-payment calibration (Step 8) will have a chance to refine with deeper exploration.

**LLM produces queries with unsupported syntax** — OpenAlex doesn't support AND/OR/NOT/quotes in `title_and_abstract.search`. Strip these operators in code before validation: `query.replace(' AND ', ' ').replace(' OR ', ' ').replace('"', '')`. Log but don't fail.

**Validation timeout** — OpenAlex occasionally returns 429 or 5xx. Implement exponential backoff with max 3 retries per query. Queries that still fail get marked with `last_run_count: null` and are treated as untested (included in library but rotated down in priority).

---

## Why This Works

Three principles:

**Seeds are nets, not scalpels.** Keep them dumb and literal. Their only job is to return papers for vocabulary mining.

**Real metadata beats LLM guesses.** An LLM doesn't know that marketing papers use the British spelling "consumer behaviour" or that gut-brain research uses the term "dysbiosis." The database knows. Read the database.

**Structured queries beat clever queries.** A library of 14 simple phrases, each covering one angle, runs in parallel and dedupes naturally. One complex boolean expression is brittle and opaque. The library approach is also what makes the digest's serendipity work — each "adjacent" and "serendipity" query is a specific bet on an unexpected angle that can be individually monitored and improved.

This is the single highest-leverage step in the onboarding pipeline. A query library built without vocabulary grounding will miss 30-50% of the papers the user actually wants, forever. One good library produced once, grounded in real data, powers every future digest.
