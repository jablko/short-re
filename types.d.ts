declare module "typescript" {
  const libs: string[];
}

// https://docs.skypack.dev/skypack-cdn/code/javascript#using-skypack-urls-in-typescript
declare module "https://cdn.skypack.dev/d3-axis" {
  export * from "d3-axis";
}

declare module "https://cdn.skypack.dev/d3-scale" {
  export * from "d3-scale";
}

declare module "https://cdn.skypack.dev/d3-scale-chromatic" {
  export * from "d3-scale-chromatic";
}

declare module "https://cdn.skypack.dev/d3-selection" {
  export * from "d3-selection";
}

declare module "https://cdn.skypack.dev/d3-shape" {
  export * from "d3-shape";
}

declare module "https://cdn.skypack.dev/viz.js" {
  export { default } from "viz.js";
}

declare module "https://unpkg.com/viz.js/lite.render.js";

interface ObjectConstructor {
  keys(o: string): `${number}`[];
}

interface String {
  slice(start?: number | `${number}`, end?: number | `${number}`): string;
}

interface Element {
  setAttribute(qualifiedName: string, value: { toString(): string }): void;
}

interface MessagePort<T = unknown> {
  postMessage(message: T, transfer: Transferable[]): void;
}

interface Worker<T = unknown> {
  postMessage(message: T, transfer: Transferable[]): void;
}
