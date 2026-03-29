"""LLM service — Featherless.ai OpenAI-compatible client."""

import re
from openai import AsyncOpenAI
from app.config import settings
from app.models.schemas import ReviewGenerateRequest, ReviewGenerateResponse

# Strip <think>...</think> blocks that Qwen3 may emit despite /no_think
_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def _build_prompt(request: ReviewGenerateRequest) -> list[dict]:
    """Build the chat messages for review generation."""
    system_msg = (
        "/no_think\n\n"
        "You are an expert Amazon product reviewer. Your task is to write a product review "
        "that matches the user's writing style demonstrated in the sample reviews provided. "
        "Write naturally and authentically. Do not mention that you are an AI or that this "
        "review was generated. Match the tone, vocabulary, sentence structure, and level of "
        "detail shown in the sample reviews.\n\n"
        "Output format — use these EXACT markers on their own lines:\n"
        "TITLE: <a short, punchy review title in the same voice>\n"
        "REVIEW:\n<the full review text>\n\n"
        "No preamble, no commentary, no thinking, no markdown formatting."
    )

    # Build product context
    product_context = f"Product: {request.product_name} (ASIN: {request.asin})\n"
    if request.product_info:
        pi = request.product_info
        if pi.description:
            product_context += f"Description: {pi.description}\n"
        if pi.average_rating is not None:
            product_context += f"Average rating on Amazon: {pi.average_rating}/5\n"
        if pi.features:
            product_context += f"Key features: {', '.join(pi.features)}\n"
        if pi.positive_themes:
            product_context += f"Common praises: {', '.join(pi.positive_themes)}\n"
        if pi.negative_themes:
            product_context += f"Common complaints: {', '.join(pi.negative_themes)}\n"

    # Select style-matched sample reviews (same star tier ±1)
    target = request.star_rating
    matched = [r for r in request.sample_reviews if abs(r.star_rating - target) <= 1]
    if not matched:
        matched = request.sample_reviews[:5]
    else:
        matched = matched[:8]

    samples_text = ""
    if matched:
        samples_text = "\n\n--- SAMPLE REVIEWS (match this writing style) ---\n"
        for i, s in enumerate(matched, 1):
            samples_text += f"\nSample {i} ({s.star_rating} stars):\n{s.review_text}\n"

    user_msg = (
        f"{product_context}\n"
        f"Star rating to give: {request.star_rating}/5\n"
        f"{samples_text}\n\n"
        f"Write a {request.star_rating}-star review for this product. "
        f"Match the writing style of the sample reviews above. "
        f"The review should be detailed, authentic, and between 100-300 words. "
        f"Remember: output TITLE: on its own line, then REVIEW: on its own line followed by the body."
    )

    return [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
    ]


async def generate_review(request: ReviewGenerateRequest) -> ReviewGenerateResponse:
    """Generate a review using the LLM."""
    # Use request-level overrides if provided, else fall back to config
    llm = request.llm_settings
    api_key = (llm and llm.api_key) or settings.featherless_api_key
    api_url = (llm and llm.api_url) or settings.featherless_api_url
    model = (llm and llm.model) or settings.llm_model
    temperature = (llm and llm.temperature) if (llm and llm.temperature is not None) else settings.llm_temperature
    max_tokens = (llm and llm.max_tokens) if (llm and llm.max_tokens is not None) else settings.llm_max_tokens
    top_p = (llm and llm.top_p) if (llm and llm.top_p is not None) else settings.llm_top_p
    freq_penalty = (llm and llm.frequency_penalty) if (llm and llm.frequency_penalty is not None) else settings.llm_frequency_penalty
    pres_penalty = (llm and llm.presence_penalty) if (llm and llm.presence_penalty is not None) else settings.llm_presence_penalty

    if not api_key:
        raise ValueError("No API key configured. Set FEATHERLESS_API_KEY in .env or provide it in LLM settings.")
    if not model:
        raise ValueError("No model configured. Set LLM_MODEL in .env or provide it in LLM settings.")

    client = AsyncOpenAI(
        api_key=api_key,
        base_url=api_url,
    )

    messages = _build_prompt(request)

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        top_p=top_p,
        frequency_penalty=freq_penalty,
        presence_penalty=pres_penalty,
    )

    raw = response.choices[0].message.content or ""
    # Strip any <think> blocks that slipped through
    raw = _THINK_RE.sub("", raw)
    # Normalize smart quotes / dashes that may arrive as mojibake
    raw = (
        raw
        .replace("\u2018", "'").replace("\u2019", "'")
        .replace("\u201c", '"').replace("\u201d", '"')
        .replace("\u2013", "-").replace("\u2014", "-")
    ).strip()

    # Parse TITLE: and REVIEW: markers
    review_title = ""
    review_text = raw
    title_match = re.search(r"(?i)^TITLE:\s*(.+)$", raw, re.MULTILINE)
    review_match = re.search(r"(?i)^REVIEW:\s*", raw, re.MULTILINE)
    if title_match:
        review_title = title_match.group(1).strip()
    if review_match:
        review_text = raw[review_match.end():].strip()
    elif title_match:
        # No REVIEW: marker but TITLE: was found — everything after TITLE line is the review
        review_text = raw[title_match.end():].strip()

    tokens_used = response.usage.total_tokens if response.usage else None

    return ReviewGenerateResponse(
        review_title=review_title,
        review_text=review_text,
        model_used=model,
        tokens_used=tokens_used,
    )
