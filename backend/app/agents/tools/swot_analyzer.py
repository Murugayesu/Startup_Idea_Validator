"""
SWOT Analyzer Tool
------------------
Validates that a SWOT analysis has adequate depth (≥2 items per quadrant)
and returns a structured JSON output for the Report Compiler to use.
"""

import json
from crewai.tools import BaseTool
from pydantic import BaseModel, Field


class SwotInput(BaseModel):
    strengths: list[str] = Field(description="List of internal strengths (at least 2)")
    weaknesses: list[str] = Field(description="List of internal weaknesses (at least 2)")
    opportunities: list[str] = Field(description="List of external opportunities (at least 2)")
    threats: list[str] = Field(description="List of external threats (at least 2)")


class SwotAnalyzerTool(BaseTool):
    name: str = "swot_analyzer"
    description: str = (
        "Validates and structures a SWOT analysis. "
        "Each quadrant (strengths, weaknesses, opportunities, threats) must have at least 2 items. "
        "If any quadrant is shallow, this tool will return an error asking you to add more factors "
        "before finalizing. Provide specific, idea-relevant items — not generic platitudes."
    )
    args_schema: type[BaseModel] = SwotInput

    def _run(
        self,
        strengths: list[str],
        weaknesses: list[str],
        opportunities: list[str],
        threats: list[str],
    ) -> str:
        MIN_ITEMS = 2
        errors = []

        quadrants = {
            "Strengths": strengths,
            "Weaknesses": weaknesses,
            "Opportunities": opportunities,
            "Threats": threats,
        }

        for name, items in quadrants.items():
            if not isinstance(items, list) or len(items) < MIN_ITEMS:
                count = len(items) if isinstance(items, list) else 0
                errors.append(
                    f"{name}: has {count} item(s), minimum is {MIN_ITEMS}. "
                    f"Add more specific {name.lower()} before calling this tool again."
                )

        if errors:
            return (
                "SWOT validation failed — analysis is too shallow:\n"
                + "\n".join(f"  • {e}" for e in errors)
                + "\nPlease deepen your analysis and call this tool again with at least 2 items per quadrant."
            )

        result = {
            "swot": {
                "strengths": strengths,
                "weaknesses": weaknesses,
                "opportunities": opportunities,
                "threats": threats,
            },
            "summary": {
                "total_factors": sum(len(v) for v in quadrants.values()),
                "strengths_count": len(strengths),
                "weaknesses_count": len(weaknesses),
                "opportunities_count": len(opportunities),
                "threats_count": len(threats),
            },
            "status": "valid",
        }
        return json.dumps(result, indent=2)
