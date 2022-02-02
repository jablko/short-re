import ts from "typescript";
function visit(node) {
    var _a;
    if (node.tagName !== "textarea") {
        for (const child of (_a = node.children) !== null && _a !== void 0 ? _a : [])
            visit(child);
    }
    else {
        node.children = [{ type: "text", value: ts.libs.join("\n") }];
    }
}
function transformer(tree, file) {
    visit(tree);
    // https://github.com/remarkjs/remark-html/blob/6ffd002311e0dd4d1bc548bdb816c1b966971c63/index.js#L56-L58
    file.extname && (file.extname = ".html");
}
export default () => transformer;
