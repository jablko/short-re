import { axisBottom, axisLeft } from "https://cdn.skypack.dev/d3-axis";
import { scaleLinear } from "https://cdn.skypack.dev/d3-scale";
import { schemeTableau10 } from "https://cdn.skypack.dev/d3-scale-chromatic";
import { select } from "https://cdn.skypack.dev/d3-selection";
import { line } from "https://cdn.skypack.dev/d3-shape";
import Viz from "https://cdn.skypack.dev/viz.js";
import { fromUnion } from "./index.js";
// import options from "https://cdn.skypack.dev/viz.js/lite.render.js";
// throws [Package Error] "fs" does not exist. (Imported by "viz.js").
// because Skypack converts dynamic -> static imports. Is this a bug in
// Skypack or Vis.js? ¯\_(ツ)_/¯
globalThis.Viz = Viz;
await import("https://unpkg.com/viz.js/lite.render.js");
const viz = new Viz(undefined);
const episodes = 100;
const width = 640;
const height = 240;
const margin = { top: 20, right: 30, bottom: 40, left: 100 };
const x = scaleLinear()
    .domain([1, episodes])
    .range([margin.left, width - margin.right]);
const y = scaleLinear().range([height - margin.bottom, margin.top]);
const l = line((value, i) => x(i + 1), y);
const [color] = schemeTableau10;
const svg = select("svg").attr("viewBox", [0, 0, width, height]);
const axes = svg.append("g");
const gx = axes
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`);
const xAxis = axisBottom(x);
xAxis(gx);
gx.append("text")
    .attr("x", (width + margin.left - margin.right) / 2)
    .attr("y", margin.bottom)
    .attr("font-size", "small")
    .attr("dominant-baseline", "ideographic")
    .attr("fill", "currentColor")
    .text("Episodes");
const gy = axes.append("g").attr("transform", `translate(${margin.left},0)`);
const yAxis = axisLeft(y);
gy.append("foreignObject")
    .attr("x", -margin.left)
    .attr("y", margin.top)
    .attr("width", 60)
    .attr("height", height - margin.top - margin.bottom)
    .append("xhtml:div")
    .style("position", "relative")
    .style("top", "50%")
    .style("text-align", "center")
    .style("transform", "translate(0,-50%)")
    .text("Pattern length");
const path = svg.append("path").attr("fill", "none").attr("stroke", color);
let abort;
const worker = new Worker("worker.js", { type: "module" });
const deterministic = document.getElementById("deterministic");
const patternOutput = document.getElementById("pattern");
const transitionsOutput = document.getElementById("transitions");
const [textarea] = document.getElementsByTagName("textarea");
textarea.addEventListener("input", run);
void run();
function run() {
    abort === null || abort === void 0 ? void 0 : abort();
    transitionsOutput.replaceChildren();
    patternOutput.replaceChildren();
    const debounce = setTimeout(async () => {
        const values = textarea.value.split("\n");
        try {
            const { data: from, ports: [agent], } = (await request(worker, values));
            const final = [...values].sort();
            const dot = `digraph { ${[
                ...[...Object.keys(from), String(final)].map((q) => `"${q}" [label="${q
                    .split(",")
                    .map((prefix) => String.raw `${prefix}\r`)
                    .join("")}"]`),
                ...Object.entries(from).flatMap(([parent, parentTo]) => Object.entries(parentTo).map(([child, parentToChild]) => `"${parent}" -> "${child}" [label="${String(parentToChild)
                    ? fromUnion(parentToChild).replaceAll("\\", String.raw `\\`)
                    : "&epsilon;"}"]`)),
            ].join(";")} }`;
            const transitions = await viz.renderSVGElement(dot);
            transitionsOutput.replaceChildren(transitions);
            if (Object.entries(from).length > 1) {
                deterministic.style.visibility = "hidden";
                svg.style("visibility", null);
                const cummins = [];
                for (let i = 0; i < episodes; i++) {
                    const { data: pattern } = (await request(agent, undefined));
                    if (pattern.length < (cummins[cummins.length - 1] || Infinity))
                        patternOutput.replaceChildren(pattern);
                    cummins.push(Math.min(cummins[cummins.length - 1] || Infinity, pattern.length));
                    y.domain([0, cummins[0]]).nice();
                    yAxis(gy);
                    path.attr("d", l(cummins));
                }
            }
            else {
                svg.style("visibility", "hidden");
                deterministic.style.visibility = "";
                const startTo = from[""];
                const pattern = fromUnion(startTo[final]);
                patternOutput.replaceChildren(pattern);
            }
        }
        catch (e) {
            if (e)
                throw e;
        }
    }, 500);
    abort = () => clearTimeout(debounce);
}
// https://github.com/whatwg/html/issues/6107
// https://advancedweb.hu/how-to-use-async-await-with-postmessage/
function request(responder, message) {
    return new Promise((resolve, reject) => {
        abort = reject;
        const { port1, port2 } = new MessageChannel();
        port1.onmessage = resolve;
        responder.postMessage(message, [port2]);
    });
}
