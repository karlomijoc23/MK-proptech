from __future__ import annotations

import copy
import re
from typing import Any, Dict, List, Optional


def deepcopy_document(data: Dict[str, Any]) -> Dict[str, Any]:
    """Return a deep copy of the provided document."""

    return copy.deepcopy(data)


def _regex_match(pattern: str, value: Any, *, case_insensitive: bool) -> bool:
    flags = re.IGNORECASE if case_insensitive else 0
    return re.search(pattern, str(value or ""), flags) is not None


def value_matches(doc_value: Any, condition_value: Any) -> bool:
    """Evaluate a single field against a Mongo-style condition."""

    if isinstance(condition_value, dict):
        if "$regex" in condition_value:
            pattern = condition_value["$regex"]
            case_insensitive = "i" in condition_value.get("$options", "")
            return _regex_match(pattern, doc_value, case_insensitive=case_insensitive)
        if "$lte" in condition_value:
            return doc_value is not None and doc_value <= condition_value["$lte"]
        if "$gte" in condition_value:
            return doc_value is not None and doc_value >= condition_value["$gte"]
        if "$gt" in condition_value:
            return doc_value is not None and doc_value > condition_value["$gt"]
        if "$lt" in condition_value:
            return doc_value is not None and doc_value < condition_value["$lt"]
        if "$ne" in condition_value:
            return doc_value != condition_value["$ne"]
        if "$in" in condition_value:
            candidates = condition_value["$in"]
            if isinstance(candidates, list):
                return doc_value in candidates
            return False
        return doc_value == condition_value

    # Mongo-style array matching: if doc_value is a list and condition_value is scalar, check containment
    if isinstance(doc_value, list) and not isinstance(condition_value, (list, dict)):
        return condition_value in doc_value

    return doc_value == condition_value


def document_matches(document: Dict[str, Any], query: Optional[Dict[str, Any]]) -> bool:
    """Evaluate whether a document matches a simplified Mongo-style query."""

    if not query:
        return True
    for key, value in query.items():
        if key == "$or":
            if not any(document_matches(document, sub_query) for sub_query in value):
                return False
            continue
        if key == "$and":
            if not all(document_matches(document, sub_query) for sub_query in value):
                return False
            continue
        if isinstance(value, dict) and "$exists" in value:
            has_key = key in document
            if value["$exists"] and not has_key:
                return False
            if not value["$exists"] and has_key:
                return False
            continue
        if not value_matches(document.get(key), value):
            return False
    return True


def apply_set(document: Dict[str, Any], updates: Dict[str, Any]) -> None:
    """Apply a $set style update operation to a document in-place."""

    for key, value in updates.items():
        document[key] = value


def aggregate_pipeline(
    documents: List[Dict[str, Any]], pipeline: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Run a minimal aggregation pipeline supporting $match and $group ($sum)."""

    results: List[Dict[str, Any]] = documents
    for stage in pipeline:
        if "$match" in stage:
            match_query = stage["$match"]
            results = [doc for doc in results if document_matches(doc, match_query)]
            continue
        if "$group" in stage:
            group_spec = stage["$group"]
            sum_key = None
            sum_field = None
            for key, value in group_spec.items():
                if key == "_id":
                    continue
                if isinstance(value, dict) and "$sum" in value:
                    sum_key = key
                    raw = value["$sum"]
                    if isinstance(raw, str) and raw.startswith("$"):
                        sum_field = raw.lstrip("$")
            total = 0
            if sum_field:
                for doc in results:
                    total += float(doc.get(sum_field, 0) or 0)
            results = (
                [{"_id": group_spec.get("_id"), sum_key: total}] if sum_key else results
            )
    return results
