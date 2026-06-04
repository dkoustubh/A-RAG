import re
from typing import Dict, Any, List


class QueryRouter:
    """
    Intelligent query router that determines which data sources to consult.
    Instead of routing to a SINGLE source, it returns a priority-ordered list
    of ALL relevant sources so the system can gather evidence from multiple places.
    """

    # Patterns that strongly indicate SQL/structured data queries
    SQL_PATTERNS = [
        r"\bhow many\b", r"\bcount\b", r"\btotal\b", r"\blist\s+(all|the|recent)?\s*(document|rfq|vendor|customer|project|bom|email)",
        r"\bshow\s+(all|the|recent)?\s*(document|rfq|vendor|customer|project|bom|email)",
        r"\baverage\b", r"\bsum\s+of\b", r"\bmaximum\b", r"\bminimum\b",
        r"\bwho is\b", r"\bshow all\b", r"\blist of\b",
        r"\bis there\s+(a|any)\b", r"\bfind\s+(a|any|the)?\s*(document|file|rfq)",
        r"\bdocument\s+(named|called|titled)\b", r"\bfile\s+(named|called|titled)\b",
        r"\bnamed\s+\w+", r"\bcalled\s+\w+",
        r"\bexist\b", r"\bexists\b", r"\bdo we have\b", r"\bhave we\b",
        r"\bsearch\s+for\b", r"\blookup\b", r"\blook\s+up\b",
    ]

    # Patterns that indicate graph/relationship queries
    GRAPH_PATTERNS = [
        r"\brelationship\b", r"\bconnected\b", r"\blinked\b", r"\bassociated\b",
        r"\bwhich\s+(customer|vendor|project|employee)\b",
        r"\bwho\s+(sent|received|created|assigned|manages|works)\b",
        r"\brelated\s+to\b", r"\bpart\s+of\b", r"\bbelongs\s+to\b",
        r"\bsupplied\s+by\b", r"\bquoted\s+by\b", r"\bordered\s+from\b",
        r"\bnetwork\b", r"\bgraph\b", r"\bentit(y|ies)\b",
    ]

    # Patterns for fact-store (SPO triples) queries
    FACT_PATTERNS = [
        r"\bvendor\s+name\b", r"\bcustomer\s+name\b", r"\bproject\s+name\b",
        r"\bwhat\s+is\s+the\s+\w+\s+(name|number|code|type|status|value|price|date)\b",
        r"\bpayload\b", r"\bcycle\s+time\b", r"\bspecification\b",
        r"\bwarranty\b", r"\bdimension\b", r"\bpart\s+number\b",
        r"\bexact\s+value\b", r"\bspeed\b", r"\bweight\b", r"\bprice\b",
        r"\bbudget\b", r"\bcost\b", r"\bamount\b",
    ]

    # Patterns that need semantic understanding
    SEMANTIC_PATTERNS = [
        r"\bsummar(y|ize|ise)\b", r"\bexplain\b", r"\bwhat\s+does\b",
        r"\btell\s+me\s+about\b", r"\bdescribe\b", r"\bwhat\s+happened\b",
        r"\bwhy\b", r"\bhow\s+does\b", r"\bmeaning\b", r"\bcontext\b",
        r"\babout\b", r"\boverview\b", r"\bdetails?\b", r"\bcontent\b",
    ]

    @staticmethod
    def route_query(query: str) -> Dict[str, Any]:
        """
        Routes the natural language query and returns the PRIMARY route
        plus a list of all sources to consult.
        """
        q_lower = query.lower().strip()
        scores = {"sql": 0, "graph": 0, "fact_store": 0, "semantic": 0}

        # Score each route based on pattern matches
        for pattern in QueryRouter.SQL_PATTERNS:
            if re.search(pattern, q_lower):
                scores["sql"] += 1

        for pattern in QueryRouter.GRAPH_PATTERNS:
            if re.search(pattern, q_lower):
                scores["graph"] += 1

        for pattern in QueryRouter.FACT_PATTERNS:
            if re.search(pattern, q_lower):
                scores["fact_store"] += 1

        for pattern in QueryRouter.SEMANTIC_PATTERNS:
            if re.search(pattern, q_lower):
                scores["semantic"] += 1

        # Determine primary route (highest score wins, ties go to SQL > Graph > Fact > Semantic)
        priority_order = ["sql", "graph", "fact_store", "semantic"]
        max_score = max(scores.values())

        if max_score == 0:
            # No pattern matched - default to semantic with all sources
            primary = "semantic"
        else:
            for route in priority_order:
                if scores[route] == max_score:
                    primary = route
                    break

        # Build ordered list of ALL sources to consult (primary first)
        all_sources = [primary] + [r for r in priority_order if r != primary]

        return {
            "route": primary,
            "all_sources": all_sources,
            "scores": scores,
            "reason": f"Primary route '{primary}' selected (scores: {scores})",
            "confidence": min(1.0, 0.5 + (max_score * 0.15))
        }


query_router = QueryRouter()
