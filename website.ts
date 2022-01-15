import Viz from "https://cdn.skypack.dev/viz.js";

(globalThis as unknown as { Viz: unknown }).Viz = {};
const script = document.createElement("script");
script.onload = async () => {
  const viz = new Viz((globalThis as unknown as { Viz: never }).Viz);
  const graph = await viz.renderSVGElement("digraph { a -> b }");
  document.body.appendChild(graph);
};
script.src = "https://unpkg.com/viz.js/lite.render.js";
document.body.appendChild(script);
