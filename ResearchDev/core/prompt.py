"""Extraction prompt — one place only. Imported by s3_extract.py and tests."""

from core.taxonomy import REVIEW_PARAMS, PARAM_DEFINITIONS, ALL_TAGS

SYSTEM_PROMPT = (
    "You are an aspect-based sentiment analysis engine for salon reviews. "
    "Extract opinions from the review and map them to the parameters and service tags provided. "
    "Return only valid JSON. No explanation, no markdown, no extra keys."
)

def build_user_prompt(review_text: str) -> str:
    param_block = "\n".join(
        f"  {p}: {PARAM_DEFINITIONS[p]}" for p in REVIEW_PARAMS
    )
    tag_list = ", ".join(ALL_TAGS)

    return f"""Review:
\"\"\"{review_text}\"\"\"

Extract opinions for these parameters only:
{param_block}

Service tags to detect (mention only if clearly stated in the review):
{tag_list}

Return exactly this JSON structure:
{{
  "opinions": [
    {{"parameter": "<one of the parameter names above>", "sentiment": <float -1.0 to 1.0>, "confidence": <float 0.0 to 1.0>}}
  ],
  "service_tags": ["<tag_name>"]
}}

Rules:
- Include a parameter only if the review explicitly or clearly implies an opinion about it.
- sentiment: positive experience → toward +1.0, negative → toward -1.0.
- confidence: your certainty that this opinion is expressed (not its intensity).
- service_tags: only tag if a specific service is clearly named.
- If nothing relevant is found, return empty lists."""
