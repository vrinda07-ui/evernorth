
import re
from typing import Any, Dict, List

from .node_utils import (
    normalize_nodes,
    get_node_id,
    get_node_text,
    get_bbox,
    get_center,
    get_descendants,
    build_node_maps,
    get_fill_color,
    is_rectangle,
    is_text_node,
)


# =========================================================
# SHARED HELPERS
# =========================================================


def _chart_nodes(component, source_nodes):
    """Find a chart and all its descendants."""

    nodes = normalize_nodes(source_nodes)
    by_id, children_map = build_node_maps(nodes)

    # Support both raw Figma nodes and pipeline candidates.
    candidate_id = (
        component.get("candidate_id")
        or component.get("id")
        or component.get("node_id")
    )

    if candidate_id is None:
        return None, []

    candidate_id = str(candidate_id)

    chart = by_id.get(candidate_id)

    if chart is None:
        return None, []

    descendants = get_descendants(chart, children_map)

    return chart, descendants


def _text_nodes(nodes):
    return [
        node for node in nodes
        if is_text_node(node) and get_node_text(node)
    ]


def _parse_number(value):
    """Parse numbers such as 60, 60%, 1,200, or $4.5k."""

    value = str(value).strip().replace(",", "")

    match = re.fullmatch(
        r"[$€£]?\s*(-?\d+(?:\.\d+)?)\s*([%kKmMbB]?)",
        value,
    )

    if not match:
        return None

    number = float(match.group(1))
    suffix = match.group(2).lower()

    if suffix == "k":
        number *= 1_000
    elif suffix == "m":
        number *= 1_000_000
    elif suffix == "b":
        number *= 1_000_000_000

    return number


def _unique_sorted_labels(nodes, axis="x"):
    """Sort text nodes by their center and remove duplicates."""

    positioned = []

    for node in nodes:
        label = get_node_text(node)
        center = get_center(node)

        if not label or not center:
            continue

        positioned.append({
            "label": label,
            "x": center["x"],
            "y": center["y"],
        })

    key = "x" if axis == "x" else "y"
    positioned.sort(key=lambda item: item[key])

    result = []
    seen = set()

    for item in positioned:
        if item["label"] in seen:
            continue

        seen.add(item["label"])
        result.append(item)

    return result


# =========================================================
# 1. HORIZONTAL BAR CHART
# =========================================================

def extract_horizontal_bar_data(component, source_nodes):
    """
    Extract label/value pairs from Figma horizontal bar rows.

    Preserves the Category bar naming convention.
    """

    chart, descendants = _chart_nodes(
        component,
        source_nodes,
    )

    if chart is None:
        return []

    result = []

    for row in descendants:

        if row.get("name") != "Category bar":
            continue

        row_nodes = get_descendants(row)

        label = next(
            (
                get_node_text(node)
                for node in row_nodes
                if node.get("name") == "Category label"
                and get_node_text(node)
            ),
            "",
        )

        value_text = next(
            (
                get_node_text(node)
                for node in row_nodes
                if is_text_node(node)
                and node.get("name") == "Label"
                and _parse_number(get_node_text(node)) is not None
            ),
            "",
        )

        value = _parse_number(value_text)

        if label and value is not None:
            result.append({
                "label": label,
                "value": value,
                "valueSource": "figma_text",
            })

    return result


# =========================================================
# 2. AGE-BAND COLUMN CHART
# =========================================================

def extract_age_band_data(component, source_nodes):
    """
    Extract age-band categories and estimate values from
    rectangle heights and visible Y-axis tick labels.

    Values are geometry-derived estimates, not original
    source data.
    """

    chart, descendants = _chart_nodes(
        component,
        source_nodes,
    )

    if chart is None:
        return []

    chart_box = get_bbox(chart)

    if not chart_box:
        return []

    text_nodes = _text_nodes(descendants)

    # -----------------------------------------------------
    # Extract category labels
    # Example: 0–17, 18–34, 35–44, 45–54, 55–64, 65+
    # -----------------------------------------------------

    category_nodes = []

    for node in text_nodes:
        label = get_node_text(node)

        if re.fullmatch(
            r"\d+\s*[–-]\s*\d+|\d+\+",
            label,
        ):
            category_nodes.append(node)

    categories = _unique_sorted_labels(
        category_nodes,
        axis="x",
    )

    # -----------------------------------------------------
    # Extract Y-axis percentage ticks
    # Example: 0%, 20%, 40%, 60%, 80%
    # -----------------------------------------------------

    tick_nodes = []

    for node in text_nodes:
        label = get_node_text(node)

        if re.fullmatch(
            r"-?\d+(?:\.\d+)?%",
            label,
        ):
            tick_nodes.append(node)

    ticks = []

    for node in tick_nodes:
        center = get_center(node)
        value = _parse_number(get_node_text(node))

        if center and value is not None:
            ticks.append({
                "value": value,
                "y": center["y"],
            })

    # Figma coordinates increase downwards.
    ticks.sort(key=lambda item: item["y"])

    if len(categories) < 2 or len(ticks) < 2:
        return []

    plot_top = min(item["y"] for item in ticks)
    plot_bottom = max(item["y"] for item in ticks)

    if plot_bottom <= plot_top:
        return []

    # -----------------------------------------------------
    # Identify bars using rectangle geometry
    # -----------------------------------------------------

    bars = []

    for node in descendants:

        if not is_rectangle(node):
            continue

        box = get_bbox(node)
        center = get_center(node)

        if not box or not center:
            continue

        if box["height"] < 3 or box["width"] < 5:
            continue

        if not (
            plot_top <= center["y"] <= plot_bottom
        ):
            continue

        if (
            box["x"] < chart_box["x"]
            or box["x"] + box["width"]
            > chart_box["x"] + chart_box["width"]
        ):
            continue

        bars.append({
            "node": node,
            "box": box,
            "center": center,
        })

    # -----------------------------------------------------
    # Match each category with its bar
    # -----------------------------------------------------

    result = []

    for category in categories:

        matching_bars = [
            bar for bar in bars
            if abs(
                bar["center"]["x"] - category["x"]
            ) <= max(12, chart_box["width"] / 20)
        ]

        if not matching_bars:
            continue

        bar = max(
            matching_bars,
            key=lambda item: item["box"]["height"],
        )

        bar_top = bar["box"]["y"]

        ordered_ticks = sorted(
            ticks,
            key=lambda item: item["y"],
        )

        value = None

        if bar_top <= ordered_ticks[0]["y"]:

            value = ordered_ticks[0]["value"]

        elif bar_top >= ordered_ticks[-1]["y"]:

            value = ordered_ticks[-1]["value"]

        else:

            for upper, lower in zip(
                ordered_ticks,
                ordered_ticks[1:],
            ):

                if upper["y"] <= bar_top <= lower["y"]:

                    distance = lower["y"] - upper["y"]

                    if distance <= 0:
                        break

                    fraction = (
                        (bar_top - upper["y"]) / distance
                    )

                    value = (
                        upper["value"]
                        + fraction * (
                            lower["value"] - upper["value"]
                        )
                    )

                    break

        if value is None:
            continue

        result.append({
            "label": category["label"],
            "value": round(value, 1),
            "valueSource": "estimated_from_geometry",
            "isEstimated": True,
        })

    return result


# =========================================================
# 3. CONDITION PREVALENCE HEATMAP
# =========================================================

def extract_heatmap_data(component, source_nodes):
    """
    Extract heatmap cells by matching rectangle geometry
    with region and condition labels.

    Preserves Figma fill colors.
    Does not invent numerical percentages.
    """

    chart, descendants = _chart_nodes(
        component,
        source_nodes,
    )

    if chart is None:
        return []

    chart_box = get_bbox(chart)

    if not chart_box:
        return []

    text_nodes = _text_nodes(descendants)

    # -----------------------------------------------------
    # Identify region and condition labels by position.
    #
    # Region labels:
    # Short labels positioned across the heatmap columns.
    #
    # Condition labels:
    # Labels positioned on the left side of the heatmap.
    # -----------------------------------------------------

    region_nodes = []
    condition_nodes = []

    region_boundary = (
        chart_box["x"] + chart_box["width"] * 0.20
    )

    condition_boundary = (
        chart_box["x"] + chart_box["width"] * 0.25
    )

    for node in text_nodes:

        label = get_node_text(node)
        center = get_center(node)

        if not label or not center:
            continue

        # Ignore numeric axis labels and percentages.
        if re.fullmatch(r"[\d.,%+ -]+", label):
            continue

        if (
            len(label) <= 6
            and center["x"] >= region_boundary
        ):
            region_nodes.append(node)

        elif (
            center["x"] <= condition_boundary
            and len(label) > 2
        ):
            condition_nodes.append(node)

    regions = _unique_sorted_labels(
        region_nodes,
        axis="x",
    )

    conditions = _unique_sorted_labels(
        condition_nodes,
        axis="y",
    )

    # -----------------------------------------------------
    # Identify heatmap rectangles and their fill colors.
    # -----------------------------------------------------

    if not regions or not conditions:
        return []

    cells = []

    for node in descendants:

        if not is_rectangle(node):
            continue

        box = get_bbox(node)
        center = get_center(node)
        color = get_fill_color(node)

        if not box or not center or color is None:
            continue

        if box["width"] < 5 or box["height"] < 5:
            continue

        nearest_region = min(
            regions,
            key=lambda item: abs(
                item["x"] - center["x"]
            ),
        )

        nearest_condition = min(
            conditions,
            key=lambda item: abs(
                item["y"] - center["y"]
            ),
        )

        # Reject rectangles that are too far from the
        # region-column or condition-row center.
        if abs(
            nearest_region["x"] - center["x"]
        ) > 30:
            continue

        if abs(
            nearest_condition["y"] - center["y"]
        ) > 15:
            continue

        cells.append({
            "region": nearest_region["label"],
            "condition": nearest_condition["label"],
            "color": color,
            "position": {
                "x": round(center["x"], 2),
                "y": round(center["y"], 2),
            },
            "valueSource": "figma_fill_color",
        })

    # -----------------------------------------------------
    # Remove duplicate region-condition pairs.
    # -----------------------------------------------------

    unique_cells = {}

    for cell in cells:

        key = (
            cell["region"],
            cell["condition"],
        )

        if key not in unique_cells:
            unique_cells[key] = cell

    return list(unique_cells.values())


# =========================================================
# 4. MAIN CHART EXTRACTION DISPATCHER
# =========================================================

def extract_chart_data(
    prediction: Dict[str, Any],
    source_nodes,
    component: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Automatically select the extraction method based
    on the chart component name.
    """

    name = str(
        component.get("name")
        or prediction.get("name")
        or ""
    ).lower()

    # Condition prevalence heatmap
    if "heatmap" in name:

        return extract_heatmap_data(
            component,
            source_nodes,
        )

    # Age-band column chart
    if (
        "age band" in name
        or "prevalence by age" in name
    ):

        return extract_age_band_data(
            component,
            source_nodes,
        )

    # Preserve horizontal bar extraction.
    horizontal_data = extract_horizontal_bar_data(
        component,
        source_nodes,
    )

    if horizontal_data:
        return horizontal_data

    return []
