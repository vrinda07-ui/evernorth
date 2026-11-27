
figma.showUI(__html__, { width: 320, height: 240 });

function serializeNode(node) {
  const result = {
    id: node.id,
    name: node.name,
    type: node.type
  };

  if ("visible" in node) result.visible = node.visible;
  if ("absoluteBoundingBox" in node) {
    result.absoluteBoundingBox = node.absoluteBoundingBox;
  }
  if ("relativeTransform" in node) {
    result.relativeTransform = node.relativeTransform;
  }
  if ("fills" in node) result.fills = node.fills;
  if ("strokes" in node) result.strokes = node.strokes;
  if ("characters" in node) result.characters = node.characters;
  if ("fontSize" in node) result.fontSize = node.fontSize;
  if ("layoutMode" in node) result.layoutMode = node.layoutMode;

  try {
    if ("componentProperties" in node) {
      result.componentProperties = node.componentProperties;
    }
  } catch (error) {
    console.warn("Skipping component properties:", error);
  }

  if ("children" in node) {
    result.children = node.children.map(serializeNode);
  }

  return result;
}

figma.ui.onmessage = async (message) => {
  if (message.type !== "send-design") return;

  try {
    figma.ui.postMessage({
      type: "status",
      text: "Extracting design..."
    });

    const page = serializeNode(figma.currentPage);

    const payload = {
      document: {
        id: "local-document",
        name: "Document",
        type: "DOCUMENT",
        children: [page]
      },
      source: "figma-plugin",
      pageName: figma.currentPage.name
    };

    figma.ui.postMessage({
      type: "status",
      text: "Sending to Python..."
    });

    const response = await fetch(
      "http://localhost:8765/ingest",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || result.detail || JSON.stringify(result)
      );
    }

    figma.ui.postMessage({
      type: "result",
      text: result.message || "Design received successfully!"
    });

  } catch (error) {
    figma.ui.postMessage({
      type: "result",
      text: "Failed: " + error.message
    });
  }
};
