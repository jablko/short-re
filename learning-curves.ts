import process from "process";
import { axisBottom, axisLeft } from "d3-axis";
import { Delaunay } from "d3-delaunay";
import { polygonArea, polygonCentroid } from "d3-polygon";
import { scaleLinear, scaleOrdinal } from "d3-scale";
import { schemeTableau10 } from "d3-scale-chromatic";
import { select } from "d3-selection";
import { line } from "d3-shape";
import { JSDOM } from "jsdom";
import ts from "typescript";
import serialize from "w3c-xmlserializer";
import { Agent, greedy, linear, uniform } from "./index.js";

const runs = 30;
const episodes = 100;
const data = [greedy, uniform, linear].map((policy) => {
  const [a, ...bs] = Array.from({ length: runs }, () => {
    const agent = new Agent(ts.libs, policy);
    while (agent.eliminateLinearSources(agent.getSources()));
    while (agent.eliminateLinearSinks(agent.getSinks()));
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
const labels = ["Greedy", "Uniform", "Linear"];

const width = 640;
const height = 240;
const margin = { top: 20, right: 30, bottom: 40, left: 100 };

const x = scaleLinear()
  .domain([1, episodes])
  .range([margin.left, width - margin.right]);
const y = scaleLinear()
  .domain(
    data.reduce(
      ([cummin, cummax], d) => [
        Math.min(cummin, d[d.length - 1]),
        Math.max(cummax, d[0]),
      ],
      [Infinity, -Infinity]
    )
  )
  .range([height - margin.bottom, margin.top])
  .nice();
const l = line((value, i) => x(i + 1), y);
const color = scaleOrdinal(schemeTableau10);

// https://github.com/d3/d3/wiki#supported-environments
const dom = new JSDOM();
const svg = select(dom.window.document.body)
  .append("svg")
  .attr("viewBox", [0, 0, width, height])
  .attr("font-family", "sans-serif");
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
yAxis(gy);
const yLabel = gy
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
  .attr("d", l)
  .attr("fill", "none")
  .attr("stroke", (d, i) => color(i as never));
const delaunay = new Delaunay(
  data.flatMap((d) => d.flatMap((value, i) => [x(i + 1), y(value)]))
);
const voronoi = delaunay.voronoi([
  margin.left,
  margin.top,
  width - margin.right,
  height - margin.bottom,
]);
svg
  .append("g")
  .attr("font-size", "small")
  .attr("font-weight", "bold")
  .selectAll("text")
  .data(
    data.map((d, i) =>
      d.reduce(
        (largest, value, j) => {
          const cell = voronoi.cellPolygon(i * episodes + j);
          const area = -polygonArea(cell as never);
          return area > largest.area
            ? { cell, area, x: x(j + 1), y: y(value) }
            : largest;
        },
        { area: -Infinity }
      )
    )
  )
  .join("text")
  .attr("fill", (d, i) => color(i as never))
  .text((d, i) => labels[i])
  .each(function (d) {
    const [cx, cy] = polygonCentroid((d as unknown as { cell: never }).cell);
    const angle = Math.atan2(
      cx - (d as unknown as { x: never }).x,
      (d as unknown as { y: never }).y - cy
    );
    switch (Math.round((angle / Math.PI) * 2 + 4) % 4) {
      case 0:
        (this as SVGTextElement).setAttribute(
          "x",
          (d as unknown as { x: never }).x
        );
        (this as SVGTextElement).setAttribute(
          "y",
          ((d as unknown as { y: never }).y - 6) as never
        );
        (this as SVGTextElement).setAttribute("text-anchor", "middle");
        break;
      case 1:
        (this as SVGTextElement).setAttribute(
          "x",
          ((d as unknown as { x: number }).x + 6) as never
        );
        (this as SVGTextElement).setAttribute(
          "y",
          (d as unknown as { y: never }).y
        );
        (this as SVGTextElement).setAttribute("dy", "0.35em");
        (this as SVGTextElement).setAttribute("text-anchor", "start");
        break;
      case 2:
        (this as SVGTextElement).setAttribute(
          "x",
          (d as unknown as { x: never }).x
        );
        (this as SVGTextElement).setAttribute(
          "y",
          ((d as unknown as { y: number }).y + 6) as never
        );
        (this as SVGTextElement).setAttribute("dy", "0.71em");
        (this as SVGTextElement).setAttribute("text-anchor", "middle");
        break;
      case 3:
        (this as SVGTextElement).setAttribute(
          "x",
          ((d as unknown as { x: never }).x - 6) as never
        );
        (this as SVGTextElement).setAttribute(
          "y",
          (d as unknown as { y: never }).y
        );
        (this as SVGTextElement).setAttribute("dy", "0.35em");
        (this as SVGTextElement).setAttribute("text-anchor", "end");
        break;
    }
  });
process.stdout.write(serialize(svg.node()!));
