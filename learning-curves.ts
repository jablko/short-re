import process from "process";
import { axisBottom, axisLeft } from "d3-axis";
import { scaleLinear, scaleOrdinal } from "d3-scale";
import { schemeTableau10 } from "d3-scale-chromatic";
import { select } from "d3-selection";
import { line } from "d3-shape";
import { JSDOM } from "jsdom";
import ts from "typescript";
import serialize from "w3c-xmlserializer";
import { Agent, greedy, linear, uniform } from "./index.js";

declare module "typescript" {
  const libs: string[];
}

const runs = 30;
const episodes = 100;
const data = [greedy, uniform, linear].map((policy) => {
  const [a, ...bs] = Array.from({ length: runs }, () => {
    const agent = new Agent(ts.libs, policy);
    let cummin = Infinity;
    return Array.from(
      { length: episodes },
      () => (cummin = Math.min(cummin, agent.episode().length))
    );
  });
  return a.map(
    (value, i) =>
      bs.reduce((cumsum, b) => cumsum + b[i], value) / (1 + bs.length)
  );
});

const width = 640;
const height = 240;
const margin = { top: 20, right: 30, bottom: 40, left: 100 };

const x = scaleLinear()
  .domain([0, episodes])
  .range([margin.left, width - margin.right]);
const y = scaleLinear()
  .domain(
    data.reduce(
      (cumextent, d) =>
        d.reduce(
          ([cummin, cummax], value) => [
            Math.min(cummin, value),
            Math.max(cummax, value),
          ],
          cumextent
        ),
      [Infinity, -Infinity]
    )
  )
  .range([height - margin.bottom, margin.top])
  .nice();
const l = line((d, i) => x(i), y);
const color = scaleOrdinal(schemeTableau10);

// https://github.com/d3/d3/wiki#supported-environments
const dom = new JSDOM();
const svg = select(dom.window.document.body)
  .append("svg")
  .attr("viewBox", [0, 0, width, height]);
const axes = svg.append("g");
const xAxis = axes
  .append("g")
  .attr("transform", `translate(0,${height - margin.bottom})`);
axisBottom(x)(xAxis);
xAxis
  .append("text")
  .attr("x", (width + margin.left - margin.right) / 2)
  .attr("y", margin.bottom)
  .attr("font-size", "small")
  .attr("fill", "currentColor")
  .text("Episodes");
const yAxis = axes.append("g").attr("transform", `translate(${margin.left},0)`);
axisLeft(y)(yAxis);
const yLabel = yAxis
  .append("foreignObject")
  .attr("x", -margin.left)
  .attr("y", margin.top)
  .attr("width", 60)
  .attr("height", height - margin.top - margin.bottom)
  .append("xhtml:div")
  .style("position", "relative")
  .style("top", "50%")
  .style("text-align", "center")
  .style("transform", "translate(0,-50%)");
yLabel.append("div").style("font-size", "small").text("Pattern length");
yLabel.append("div").text(`averaged over ${runs} runs`);
svg
  .append("g")
  .selectAll("path")
  .data(data)
  .join("path")
  .attr("d", (d) => l(d))
  .attr("fill", "none")
  .attr("stroke", color as never);
process.stdout.write(serialize(svg.node()!));
