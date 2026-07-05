"""
CrewAI Validation Crew
-----------------------
4-agent sequential pipeline:
  1. Market Researcher  — web search + TAM/SAM/SOM
  2. Tech Analyst       — feasibility + stack + risks
  3. Business Strategist — SWOT (informed by market research)
  4. Report Compiler    — synthesis + honest 1–10 score

All agents use Groq llama-3.1-8b-instant (free tier, 20k TPM).
"""

from crewai import Agent, Task, Crew, Process, LLM
import litellm
from tenacity import (
    retry,
    wait_fixed,
    stop_after_attempt,
    retry_if_exception_type,
)
from app.agents.tools.market_calculator import MarketCalculatorTool
from app.agents.tools.web_search import WebSearchTool
from app.agents.tools.swot_analyzer import SwotAnalyzerTool
from app.core.config import get_settings

# -----------------------------------------------------------------------
# Groq compatibility + rate-limit patch
# -----------------------------------------------------------------------
# Problem 1: CrewAI >=0.80 injects Anthropic-specific 'cache_breakpoint': True
# (a raw bool) into system messages for ALL providers. Groq rejects it.
# litellm.drop_params=True made it worse — its code calls .get() on True.
# Fix: strip offending fields before litellm ever sees them.
#
# Problem 2: Groq free tier is 12,000 TPM. With 4 agents + context passing
# a single run easily exceeds this mid-run.
# Fix: retry on RateLimitError with a 25s fixed wait (error says ~17s).
# -----------------------------------------------------------------------
_original_litellm_completion = litellm.completion


@retry(
    retry=retry_if_exception_type(litellm.RateLimitError),
    wait=wait_fixed(25),        # Groq tells us to wait ~17 s; 25 s gives margin
    stop=stop_after_attempt(4), # Max ~100 s of total wait before giving up
    reraise=True,               # Propagate the exception if all retries fail
)
def _groq_safe_completion(*args, **kwargs):
    """Strip Anthropic cache params and auto-retry on Groq TPM rate limits."""
    model = kwargs.get("model", "")
    if "anthropic" not in model and "claude" not in model:
        for msg in kwargs.get("messages", []):
            if not isinstance(msg, dict):
                continue
            msg.pop("cache_breakpoint", None)  # bool — Groq rejects this
            content = msg.get("content")
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict):
                        block.pop("cache_control", None)   # Anthropic-only
                        block.pop("cache_breakpoint", None)
    return _original_litellm_completion(*args, **kwargs)


litellm.completion = _groq_safe_completion


def build_crew(startup_idea: str, step_callback=None) -> Crew:
    settings = get_settings()

    # ------------------------------------------------------------------
    # LLM — Groq free tier
    # ------------------------------------------------------------------
    groq_llm = LLM(
        model="groq/llama-3.1-8b-instant",   # 20k TPM free tier vs 12k for 70b
        api_key=settings.groq_api_key,
        temperature=0.3,      # Lower temp for more factual, consistent output
        max_tokens=2048,      # Stays comfortably within free-tier TPM budget
    )



    # ------------------------------------------------------------------
    # Tools
    # ------------------------------------------------------------------
    web_search = WebSearchTool(api_key=settings.serper_api_key)
    market_calc = MarketCalculatorTool()
    swot_tool = SwotAnalyzerTool()

    # ------------------------------------------------------------------
    # Agents
    # ------------------------------------------------------------------
    market_researcher = Agent(
        role="Market Research Analyst",
        goal=(
            "Research the market for the startup idea and produce a rigorous market-size analysis. "
            "Find real data on market size, growth trends, and key players. "
            "Use the market_calculator tool to produce reproducible TAM/SAM/SOM numbers."
        ),
        backstory=(
            "You are a senior market research analyst who has sized hundreds of markets for VCs and founders. "
            "You rely on real data from web searches, not estimates. "
            "You are honest: if a market is small, you say so."
        ),
        llm=groq_llm,
        tools=[web_search, market_calc],
        verbose=True,
        allow_delegation=False,
        max_iter=4,             # Reduced from 5 to cap token budget
    )

    tech_analyst = Agent(
        role="Technical Feasibility Analyst",
        goal=(
            "Assess the technical feasibility of building the startup idea. "
            "Identify the core technology stack, key technical risks, build timeline estimate, "
            "and whether the technology already exists or needs to be created from scratch."
        ),
        backstory=(
            "You are a principal engineer who has evaluated hundreds of technical pitches. "
            "You cut through hype: if something is technically hard or expensive, you say so clearly. "
            "You also identify existing solutions, open-source tools, and API services that could accelerate development."
        ),
        llm=groq_llm,
        tools=[web_search],
        verbose=True,
        allow_delegation=False,
        max_iter=3,             # Reduced from 4 to cap token budget
    )

    business_strategist = Agent(
        role="Business Strategy Analyst",
        goal=(
            "Produce a deep, specific SWOT analysis for the startup idea informed by the market research. "
            "Use the swot_analyzer tool to validate your analysis has adequate depth (≥2 items per quadrant). "
            "Each item must be specific to this idea — no generic business-school platitudes."
        ),
        backstory=(
            "You are a strategy consultant who has advised dozens of early-stage startups. "
            "You write SWOT analyses that founders actually use — specific, honest, and actionable. "
            "You refuse to write generic items like 'strong team' without justification."
        ),
        llm=groq_llm,
        tools=[swot_tool],
        verbose=True,
        allow_delegation=False,
        max_iter=4,
    )

    report_compiler = Agent(
        role="Validation Report Compiler",
        goal=(
            "Synthesize the market research, technical analysis, and SWOT into a final validation report. "
            "Assign an honest integer validation score from 1 to 10. "
            "Be critical and specific: a mediocre idea should score 3–4, not 7. "
            "Do NOT default to encouraging language — founders need truth, not cheerleading."
        ),
        backstory=(
            "You are a hard-nosed startup evaluator who has seen a thousand pitches. "
            "You give founders the honest assessment a good mentor would give in private — "
            "not the polite response they'd give in public. "
            "Your scores mean something because you are willing to give low ones."
        ),
        llm=groq_llm,
        tools=[],
        verbose=True,
        allow_delegation=False,
        max_iter=3,
    )

    # ------------------------------------------------------------------
    # Tasks
    # ------------------------------------------------------------------
    market_research_task = Task(
        description=(
            f"Research the market for this startup idea: '{startup_idea}'\n\n"
            "You must:\n"
            "1. Search the web for market size data, growth rates, and existing competitors\n"
            "2. Identify the target customer segment and how large it is\n"
            "3. Use the market_calculator tool with your researched numbers to produce TAM, SAM, and SOM\n"
            "4. List 3–5 key competitors or alternatives already in the space\n"
            "5. Identify key market trends (tailwinds or headwinds)\n\n"
            "Output a structured summary covering all the above points with your sources."
        ),
        expected_output=(
            "A structured market research report including: market size with TAM/SAM/SOM numbers "
            "(produced by the market_calculator tool), growth rate, customer segment, "
            "3–5 competitors with brief descriptions, and 2–3 key market trends."
        ),
        agent=market_researcher,
    )

    tech_analysis_task = Task(
        description=(
            f"Assess the technical feasibility of building this startup: '{startup_idea}'\n\n"
            "You must:\n"
            "1. Search for existing solutions, APIs, or open-source tools relevant to this idea\n"
            "2. Identify the core technical stack needed (languages, frameworks, infrastructure)\n"
            "3. Estimate the MVP build time for a small technical team (2–3 engineers)\n"
            "4. List the top 3 technical risks (e.g. data acquisition, scaling, algorithm complexity)\n"
            "5. Assess overall technical feasibility: Low / Medium / High difficulty\n\n"
            "Be specific. Name actual technologies and tools where possible."
        ),
        expected_output=(
            "A technical feasibility assessment covering: recommended tech stack, "
            "MVP timeline estimate, top 3 technical risks with severity, "
            "existing tools/APIs that can be leveraged, and an overall feasibility rating."
        ),
        agent=tech_analyst,
    )

    swot_task = Task(
        description=(
            f"Produce a SWOT analysis for this startup idea: '{startup_idea}'\n\n"
            "Use the market research context provided to you.\n\n"
            "Rules:\n"
            "• Each item must be SPECIFIC to this idea — no generic statements\n"
            "• At least 2 items per quadrant\n"
            "• Use the swot_analyzer tool to validate your analysis before finalizing\n"
            "• If the tool rejects your analysis, add more specific items and try again\n\n"
            "Examples of BAD items (too generic):\n"
            "  ✗ 'Strong potential for growth'\n"
            "  ✗ 'Competition from established players'\n\n"
            "Examples of GOOD items (specific):\n"
            "  ✓ 'No API currently provides real-time X data at < $0.01/call'\n"
            "  ✓ 'Google entered this space in 2023 with a product that has 2M MAUs'"
        ),
        expected_output=(
            "A validated SWOT analysis (output from swot_analyzer tool) with at least 2 specific "
            "items per quadrant, relevant to this particular startup idea."
        ),
        agent=business_strategist,
        context=[market_research_task],
    )

    report_task = Task(
        description=(
            f"Compile the final validation report for: '{startup_idea}'\n\n"
            "Use ALL previous outputs (market research, technical analysis, SWOT).\n\n"
            "Format the report in this EXACT markdown structure:\n\n"
            "## Executive Summary\n"
            "[2–3 sentence honest summary of the idea's viability]\n\n"
            "## Market Opportunity\n"
            "[TAM/SAM/SOM with methodology, market trends, competitors]\n\n"
            "## Technical Feasibility\n"
            "[Tech stack, timeline, risks, rating]\n\n"
            "## Business Strategy (SWOT)\n"
            "[Full SWOT table]\n\n"
            "## Validation Score: X/10\n"
            "[1–2 paragraphs justifying the score. Be honest — explain both why it scores "
            "what it does AND what would need to be true for the score to improve. "
            "Do NOT round up to sound encouraging.]\n\n"
            "## Recommended Next Steps\n"
            "[3–5 concrete, specific actions the founder should take in the next 30 days]\n\n"
            "SCORING GUIDE (use this strictly):\n"
            "1–3: Significant structural problems; not recommended to pursue as-is\n"
            "4–5: Marginal viability; major pivots needed\n"
            "6–7: Viable but crowded/risky; clear differentiation needed\n"
            "8–9: Strong opportunity; favorable market + feasibility\n"
            "10: Reserved for once-in-a-decade ideas with strong evidence"
        ),
        expected_output=(
            "A complete validation report in the specified markdown format, with an integer "
            "validation score 1–10 that is clearly extractable from the '## Validation Score: X/10' heading."
        ),
        agent=report_compiler,
        context=[market_research_task, tech_analysis_task, swot_task],
    )

    # ------------------------------------------------------------------
    # Crew
    # ------------------------------------------------------------------
    crew = Crew(
        agents=[market_researcher, tech_analyst, business_strategist, report_compiler],
        tasks=[market_research_task, tech_analysis_task, swot_task, report_task],
        process=Process.sequential,
        verbose=True,
        step_callback=step_callback,
    )

    return crew


def extract_score(report_markdown: str) -> int | None:
    """
    Extracts the integer score from '## Validation Score: X/10' heading.
    Returns None if parsing fails.
    """
    import re
    match = re.search(r"##\s+Validation Score:\s*(\d+)\s*/\s*10", report_markdown, re.IGNORECASE)
    if match:
        score = int(match.group(1))
        return max(1, min(10, score))  # clamp to 1–10
    return None
