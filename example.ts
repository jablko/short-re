import type * as hast from "hast";
import ts from "typescript";
import type * as unist from "unist";
import type { VFile } from "vfile";

type Child<T> = T extends unist.Parent<infer U> ? U : never;
//type DescendantOrSelf<T> = T | DescendantOrSelf<Child<T>>;
type DescendantOrSelf<T> = T | Child<T>;

function visit(node: DescendantOrSelf<hast.Root> & Partial<hast.Element>) {
  if (node.tagName !== "textarea") {
    for (const child of node.children ?? []) visit(child as never);
  } else {
    node.children = [{ type: "text", value: ts.libs.join("\n") }];
  }
}

function transformer(tree: hast.Root, file: VFile) {
  visit(tree as never);
  // https://github.com/remarkjs/remark-html/blob/6ffd002311e0dd4d1bc548bdb816c1b966971c63/index.js#L56-L58
  file.extname &&= ".html";
}

export default () => transformer;
