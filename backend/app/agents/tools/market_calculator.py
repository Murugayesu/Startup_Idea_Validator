"""
Market Calculator Tool
----------------------
Deterministic TAM/SAM/SOM calculator — no LLM call, pure math.
The agent supplies the inputs; this tool returns reproducible numbers.
"""

import json
from crewai.tools import BaseTool
from pydantic import BaseModel, Field


class MarketCalculatorInput(BaseModel):
    population: float = Field(
        description="Total addressable population or unit count (e.g. number of SMBs in the US)"
    )
    addressable_pct: float = Field(
        description="Percentage of population that is genuinely addressable (SAM), 0–100"
    )
    obtainable_pct: float = Field(
        description="Percentage of SAM that can realistically be captured (SOM), 0–100"
    )
    avg_revenue_per_user: float = Field(
        description="Average annual revenue per user/customer in USD"
    )
    currency: str = Field(default="USD", description="Currency label for output")


class MarketCalculatorTool(BaseTool):
    name: str = "market_calculator"
    description: str = (
        "Calculates TAM, SAM, and SOM from market inputs. "
        "Use this tool to produce reproducible market-size numbers after gathering data with web search. "
        "Inputs: population, addressable_pct (0-100), obtainable_pct (0-100), avg_revenue_per_user."
    )
    args_schema: type[BaseModel] = MarketCalculatorInput

    def _run(
        self,
        population: float,
        addressable_pct: float,
        obtainable_pct: float,
        avg_revenue_per_user: float,
        currency: str = "USD",
    ) -> str:
        if not (0 < addressable_pct <= 100):
            return "Error: addressable_pct must be between 0 and 100."
        if not (0 < obtainable_pct <= 100):
            return "Error: obtainable_pct must be between 0 and 100."
        if avg_revenue_per_user <= 0:
            return "Error: avg_revenue_per_user must be positive."

        tam = population * avg_revenue_per_user
        sam = tam * (addressable_pct / 100)
        som = sam * (obtainable_pct / 100)

        def fmt(n: float) -> str:
            if n >= 1_000_000_000:
                return f"{currency} {n / 1_000_000_000:.2f}B"
            if n >= 1_000_000:
                return f"{currency} {n / 1_000_000:.2f}M"
            return f"{currency} {n:,.0f}"

        result = {
            "inputs": {
                "population": population,
                "addressable_pct": addressable_pct,
                "obtainable_pct": obtainable_pct,
                "avg_revenue_per_user": avg_revenue_per_user,
            },
            "TAM": fmt(tam),
            "SAM": fmt(sam),
            "SOM": fmt(som),
            "TAM_raw": tam,
            "SAM_raw": sam,
            "SOM_raw": som,
            "methodology": (
                f"TAM = {population:,.0f} × {currency}{avg_revenue_per_user:,.2f} = {fmt(tam)}. "
                f"SAM = TAM × {addressable_pct}% = {fmt(sam)}. "
                f"SOM = SAM × {obtainable_pct}% = {fmt(som)}."
            ),
        }
        return json.dumps(result, indent=2)
