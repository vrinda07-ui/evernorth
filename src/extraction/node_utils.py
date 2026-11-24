from typing import Any, Dict, List, Optional


def normalize_nodes(source_nodes) -> List[Dict[str, Any]]:
    """Convert a node dictionary or list into a consistent list."""
    if isinstance(source_nodes, dict):
        return [
            node for node in source_nodes.values()
            if isinstance(node, dict)
        ]

    if isinstance(source_nodes, list):
        return [
            node for node in source_nodes
            if isinstance(node, dict)
        ]

    return []


def get_node_id(node: Dict[str, Any]) -> str:
    return str(node.get("id", ""))


def get_node_text(node: Dict[str, Any]) -> str:
    """Read text from a Figma TEXT node."""
    if not isinstance(node, dict):
        return ""

    return str(
        node.get("characters")
        or node.get("text")
        or ""
    ).strip()


def get_bbox(node: Dict[str, Any]) -> Optional[Dict[str, float]]:
    """Get a node's absolute bounding box."""

    if not isinstance(node, dict):
        return None

    bbox = node.get("absoluteBoundingBox")

    if isinstance(bbox, dict):
        source = bbox
    else:
        source = node

    try:
        x = float(source["x"])
        y = float(source["y"])
        width = float(source["width"])
        height = float(source["height"])
    except (KeyError, TypeError, ValueError):
        return None

    if width <= 0 or height <= 0:
        return None

    return {
        "x": x,
        "y": y,
        "width": width,
        "height": height,
    }


def get_center(node: Dict[str, Any]) -> Optional[Dict[str, float]]:
    bbox = get_bbox(node)

    if not bbox:
        return None

    return {
        "x": bbox["x"] + bbox["width"] / 2,
        "y": bbox["y"] + bbox["height"] / 2,
    }


def build_node_maps(source_nodes):
    """Build ID and parent-to-children lookup maps."""

    nodes = normalize_nodes(source_nodes)

    by_id = {}
    children = {}

    for node in nodes:
        node_id = get_node_id(node)

        if node_id:
            by_id[node_id] = node

        parent_id = node.get("parent_id")

        if parent_id is not None:
            children.setdefault(str(parent_id), []).append(node)

    return by_id, children


def get_descendants(
    node: Dict[str, Any],
    children_map: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> List[Dict[str, Any]]:
    """Return every descendant of a node, not just direct children."""

    result = []
    visited = set()

    # Prefer the original nested Figma children when available.
    if isinstance(node.get("children"), list):
        stack = list(node["children"])

        while stack:
            current = stack.pop()

            if not isinstance(current, dict):
                continue

            node_id = get_node_id(current)

            if node_id and node_id in visited:
                continue

            if node_id:
                visited.add(node_id)

            result.append(current)
            stack.extend(current.get("children", []))

        return result

    # Fallback for flattened node collections.
    if children_map is None:
        return result

    stack = list(children_map.get(get_node_id(node), []))

    while stack:
        current = stack.pop()
        node_id = get_node_id(current)

        if node_id and node_id in visited:
            continue

        if node_id:
            visited.add(node_id)

        result.append(current)
        stack.extend(
            children_map.get(node_id, [])
        )

    return result


def get_fill_color(node: Dict[str, Any]):
    """Read the first visible solid fill color."""

    fills = node.get("fills", [])

    if not isinstance(fills, list):
        return None

    for fill in fills:
        if not isinstance(fill, dict):
            continue

        if fill.get("visible") is False:
            continue

        if fill.get("type") != "SOLID":
            continue

        color = fill.get("color")

        if not isinstance(color, dict):
            continue

        try:
            return {
                "r": round(float(color["r"]), 4),
                "g": round(float(color["g"]), 4),
                "b": round(float(color["b"]), 4),
            }
        except (KeyError, TypeError, ValueError):
            continue

    return None


def is_rectangle(node: Dict[str, Any]) -> bool:
    return str(node.get("type", "")).upper() == "RECTANGLE"


def is_text_node(node: Dict[str, Any]) -> bool:
    return str(node.get("type", "")).upper() == "TEXT"


def sort_by_x(nodes):
    return sorted(
        nodes,
        key=lambda node: (
            get_center(node) or {"x": float("inf")}
        )["x"]
    )


def sort_by_y(nodes):
    return sorted(
        nodes,
        key=lambda node: (
            get_center(node) or {"y": float("inf")}
        )["y"]
    )