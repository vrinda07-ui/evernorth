from typing import Any, Dict, List


def validate_chart_data(
    chart_data: List[Dict[str, Any]],
    chart_name: str = "",
) -> Dict[str, Any]:
    """Validate extracted chart data without changing its values."""

    errors = []
    warnings = []

    if not isinstance(chart_data, list):
        return {
            "valid": False,
            "errors": ["chartData must be a list."],
            "warnings": [],
            "rowCount": 0,
        }

    if not chart_data:
        warnings.append(
            f"No chart data extracted for: {chart_name}"
        )

    seen = set()

    for index, item in enumerate(chart_data):
        if not isinstance(item, dict):
            errors.append(
                f"Row {index}: expected a dictionary."
            )
            continue

        # Heatmap records use region + condition.
        if "region" in item or "condition" in item:
            if not item.get("region"):
                errors.append(
                    f"Row {index}: missing region."
                )

            if not item.get("condition"):
                errors.append(
                    f"Row {index}: missing condition."
                )

            if not isinstance(item.get("color"), dict):
                errors.append(
                    f"Row {index}: missing heatmap color."
                )

            key = (
                item.get("region"),
                item.get("condition"),
            )

            if key in seen:
                errors.append(
                    f"Row {index}: duplicate heatmap cell {key}."
                )

            seen.add(key)
            continue

        # Standard chart records use label + value.
        if not item.get("label"):
            errors.append(
                f"Row {index}: missing label."
            )

        value = item.get("value")

        if not isinstance(value, (int, float)):
            errors.append(
                f"Row {index}: value must be numeric."
            )

        if item.get("isEstimated") is True:
            warnings.append(
                f"Row {index}: value is estimated from geometry."
            )

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "rowCount": len(chart_data),
    }


def validate_heatmap_completeness(
    chart_data: List[Dict[str, Any]],
    expected_regions: int = 12,
    expected_conditions: int = 7,
) -> Dict[str, Any]:
    """Check whether the expected heatmap grid was extracted."""

    regions = {
        item.get("region")
        for item in chart_data
        if item.get("region")
    }

    conditions = {
        item.get("condition")
        for item in chart_data
        if item.get("condition")
    }

    expected_cells = expected_regions * expected_conditions

    return {
        "regionCount": len(regions),
        "conditionCount": len(conditions),
        "cellCount": len(chart_data),
        "expectedCellCount": expected_cells,
        "complete": len(chart_data) == expected_cells,
        "missingCells": max(
            0,
            expected_cells - len(chart_data),
        ),
    }


def validate_age_band_data(
    chart_data: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Check age-band extraction and identify estimated values."""

    estimated_count = sum(
        1 for item in chart_data
        if item.get("isEstimated") is True
    )

    return {
        "rowCount": len(chart_data),
        "estimatedCount": estimated_count,
        "allValuesEstimated": (
            len(chart_data) > 0
            and estimated_count == len(chart_data)
        ),
        "expectedCategories": 6,
        "complete": len(chart_data) == 6,
    }