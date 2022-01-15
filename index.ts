type Union = Concatenation[];
type Concatenation = Union[] | string;
type Edge = readonly [string, string];
type Policy = (this: Agent, choices: Edge[]) => Edge;

export class Agent {
  final;
  from: { [parent: string]: { [child: string]: Union } } = {};
  deterministic?: boolean;
  returns: { [path: string]: string } = {};
  path?: string;

  constructor(values: readonly string[], public policy: Policy) {
    this.final = [...values].sort();
    const bySuffix: { [suffix: string]: string[] } = {};
    for (const value of values) {
      if (values.some((other) => other !== value && other.startsWith(value)))
        continue;
      for (const i of Object.keys(value)) {
        const prefix = value.slice(0, i as never);
        const suffix = value.slice(i as never);
        (bySuffix[suffix] ||= []).push(prefix);
      }
    }
    const byParent: { [parent: string]: { [symbol: string]: string[][] } } = {};
    for (const [suffix, parent] of Object.entries(bySuffix)) {
      const bySymbol = (byParent[
        parent.sort() as unknown as keyof typeof byParent
      ] ||= {});
      const child = bySuffix[suffix.slice(1)] || this.final;
      (bySymbol[suffix[0]] ||= []).push(child);
    }
    const intersections = Object.fromEntries(
      Object.entries(byParent).map(([parent, bySymbol]) => [
        parent,
        Object.fromEntries(
          Object.entries(bySymbol).map(([symbol, [a, ...bs]]) => [
            symbol,
            a.filter((prefix) => bs.every((b) => b.includes(prefix))).sort(),
          ])
        ),
      ])
    );
    for (const parent of [
      ...Object.values(bySuffix),
      ...Object.values(intersections).flatMap((bySymbol) =>
        Object.values(bySymbol)
      ),
    ]) {
      if (parent.length === this.final.length) continue;
      this.from[parent as unknown as keyof Agent["from"]] ||=
        Object.fromEntries(
          [...Object.values(bySuffix), this.final]
            .filter(
              (child) =>
                child.length > parent.length &&
                parent.every((prefix) => child.includes(prefix))
            )
            .filter(
              (child, i, siblings) =>
                !siblings.some(
                  (sibling) =>
                    sibling.length < child.length &&
                    sibling.every((prefix) => child.includes(prefix))
                )
            )
            .map((child) => [child, [""]])
        );
    }
    for (const [parent, bySymbol] of Object.entries(intersections)) {
      const parentTo = (this.from[parent] ||= {});
      for (const [symbol, child] of Object.entries(bySymbol)) {
        (parentTo[child as unknown as keyof typeof parentTo] ||= []).push(
          symbol
        );
      }
    }
  }

  episode() {
    const saved: unknown = JSON.parse(JSON.stringify(this.from));
    this.path = "";
    while (Object.entries(this.from).length > 1) this.step();
    const startTo = this.from[""];
    this.from = saved as never;
    return (this.returns[this.path] = fromUnion(
      startTo[this.final as unknown as keyof typeof startTo]
    ));
  }

  step() {
    const sources = this.getSources();
    if (this.eliminateLinearSources(sources)) return;
    const sinks = this.getSinks();
    if (this.eliminateLinearSinks(sinks)) return;
    this.deterministic = false;
    const [q, p] = this.policy([
      ...sources.flatMap(([source, children]) =>
        children.map((child) => [source, child] as const)
      ),
      ...sinks.flatMap(([sink, parents]) =>
        parents
          .filter((parent) => !sources.some(([source]) => source === parent))
          .map((parent) => [parent, sink] as const)
      ),
    ]);
    if (sources.some(([source]) => source === q)) {
      const startTo = this.from[""];
      startTo[p] = union(
        startTo[p] || [],
        String(this.from[q][p]) ? [[startTo[q], this.from[q][p]]] : startTo[q]
      );
    } else {
      this.from[q][
        this.final as unknown as keyof Agent["from"][keyof Agent["from"]]
      ] = union(
        this.from[q][
          this.final as unknown as keyof Agent["from"][keyof Agent["from"]]
        ] || [],
        String(this.from[q][p])
          ? [
              [
                this.from[q][p],
                this.from[p][
                  this
                    .final as unknown as keyof Agent["from"][keyof Agent["from"]]
                ],
              ],
            ]
          : this.from[p][
              this.final as unknown as keyof Agent["from"][keyof Agent["from"]]
            ]
      );
    }
    delete this.from[q][p];
    this.path += `${q}/${p}/`;
  }

  getSources() {
    const startTo = this.from[""];
    return Object.keys(startTo)
      .filter(
        (source) =>
          !Object.entries(this.from).some(
            ([parent, parentTo]) => parent && source in parentTo
          )
      )
      .map((source) => [source, Object.keys(this.from[source])] as const);
  }

  eliminateLinearSources(sources: (readonly [string, string[]])[]) {
    const startTo = this.from[""];
    return sources.reduce((some, [source, children]) => {
      const { length: outdegree, 0: child } = children;
      if (outdegree > 1) return some;
      startTo[child] = union(
        startTo[child] || [],
        String(this.from[source][child])
          ? [[startTo[source], this.from[source][child]]]
          : startTo[source]
      );
      delete startTo[source];
      delete this.from[source];
      return true;
    }, false);
  }

  getSinks() {
    return Object.entries(this.from)
      .filter(([, sinkTo]) =>
        Object.keys(sinkTo).every((child) => child === String(this.final))
      )
      .map(
        ([sink]) =>
          [
            sink,
            Object.keys(this.from).filter(
              (parent) => sink in this.from[parent]
            ),
          ] as const
      );
  }

  eliminateLinearSinks(sinks: (readonly [string, string[]])[]) {
    return sinks.reduce((some, [sink, parents]) => {
      const { length: indegree, 0: parent } = parents;
      if (indegree > 1) return some;
      this.from[parent][
        this.final as unknown as keyof Agent["from"][keyof Agent["from"]]
      ] = union(
        this.from[parent][
          this.final as unknown as keyof Agent["from"][keyof Agent["from"]]
        ] || [],
        String(this.from[parent][sink])
          ? [
              [
                this.from[parent][sink],
                this.from[sink][
                  this
                    .final as unknown as keyof Agent["from"][keyof Agent["from"]]
                ],
              ],
            ]
          : this.from[sink][
              this.final as unknown as keyof Agent["from"][keyof Agent["from"]]
            ]
      );
      delete this.from[parent][sink];
      delete this.from[sink];
      return true;
    }, false);
  }
}

function union(a: Union, b: Union) {
  const aValues = a.flatMap((child) => constituteConcatenation(child));
  const bValues = b.flatMap((child) => constituteConcatenation(child));
  return aValues.length < bValues.length
    ? aValues.every((value) => bValues.includes(value))
      ? b
      : [...a, ...b]
    : bValues.every((value) => aValues.includes(value))
    ? a
    : [...a, ...b];
}

function constituteConcatenation(node: string): string;
function constituteConcatenation(node: Concatenation): string[];
function constituteConcatenation(node: Concatenation) {
  if (typeof node === "string") return node;
  const [a, ...bs] = node;
  const aValues = a.flatMap((child) => constituteConcatenation(child));
  return !bs.length
    ? aValues
    : aValues.flatMap((aValue) =>
        constituteConcatenation(bs).map((bValue) => aValue + bValue)
      );
}

export function fromUnion(node: Union): string {
  return `(?:${node.map((child) => fromConcatenation(child)).join("|")})`;
}

export function fromConcatenation(node: Concatenation) {
  if (typeof node === "string") return node.replace(/\./g, String.raw`\.`);
  return node.map((child) => fromUnion(child)).join("");
}

export const greedy: Policy = function (choices) {
  const margins = choices.map(([q, p]) => fromUnion(this.from[q][p]).length);
  const min = margins.reduce((cummin, margin) => Math.min(cummin, margin));
  const argmins = [...margins.keys()].filter((i) => margins[i] === min);
  return choices[argmins[Math.floor(Math.random() * argmins.length)]];
};

export const uniform: Policy = function (choices) {
  return choices[Math.floor(Math.random() * choices.length)];
};

export const linear: Policy = function (choices) {
  const estimates = choices.map(([q, p]) => {
    const choice = `${this.path!}${q}/${p}/`;
    return Object.entries(this.returns).reduce(
      (cummin, [experience, pattern]) =>
        !experience.startsWith(choice)
          ? cummin
          : Math.min(cummin, pattern.length),
      Infinity
    );
  });
  const [min, max] = estimates.reduce(
    ([cummin, cummax], estimate) =>
      estimate === Infinity
        ? [cummin, cummax]
        : [Math.min(cummin, estimate), Math.max(cummax, estimate)],
    [Infinity, 0]
  );
  let cumsum = 0;
  const cumsums = estimates.map(
    (estimate) =>
      (cumsum +=
        max - (estimate === Infinity ? Math.min(min, max) : estimate) + 1)
  );
  const x = Math.random() * cumsums[cumsums.length - 1];
  return choices[cumsums.findIndex((cumsum) => cumsum > x)];
};
