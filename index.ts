type Union = Concatenation[];
type Concatenation = Union[] | string;
type Edge = readonly [string, string];
type Policy = (
  this: Episode,
  choices: Edge[],
  returns: Agent["returns"]
) => Edge;

export class Agent {
  readonly final;
  readonly from: { [parent: string]: { [child: string]: Union } } = {};
  readonly sources;
  readonly sinks;
  readonly returns: { [path: string]: string } = {};

  constructor(values: readonly string[]) {
    this.final = [...values].sort();
    const bySuffix: { [suffix: string]: string[] } = {};
    for (const value of values) {
      if (values.some((other) => other !== value && other.startsWith(value)))
        continue;
      for (const i of Object.keys(value)) {
        const prefix = value.slice(0, i);
        const suffix = value.slice(i);
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
    while (Object.entries(this.from).length > 1) {
      this.sources = getSources(this.from);
      if (eliminateLinearSources(this.sources, this.from)) continue;
      this.sinks = getSinks(this.from, this.final);
      if (eliminateLinearSinks(this.sinks, this.from, this.final)) continue;
      break;
    }
  }

  episode(policy: Policy) {
    const episode = new Episode(
      JSON.parse(JSON.stringify(this.from)) as never,
      JSON.parse(JSON.stringify(this.sources)) as never,
      JSON.parse(JSON.stringify(this.sinks)) as never
    );
    while (Object.entries(episode.from).length > 1)
      episode.step(
        policy.call(
          episode,
          [
            ...episode.sources.flatMap(([source, children]) =>
              children.map((child) => [source, child] as const)
            ),
            ...episode.sinks.flatMap(([sink, parents]) =>
              parents
                .filter(
                  (parent) =>
                    !episode.sources.some(([source]) => source === parent)
                )
                .map((parent) => [parent, sink] as const)
            ),
          ],
          this.returns
        ),
        this.final
      );
    const startTo = episode.from[""];
    return (this.returns[episode.path] = fromUnion(
      startTo[this.final as unknown as keyof typeof startTo]
    ));
  }
}

class Episode {
  path = "";

  constructor(
    readonly from: Agent["from"],
    public sources: NonNullable<Agent["sources"]>,
    public sinks: NonNullable<Agent["sinks"]>
  ) {}

  step([parent, child]: Edge, final: Agent["final"]) {
    if (this.sources.some(([source]) => source === parent)) {
      const startTo = this.from[""];
      startTo[child] = union(
        startTo[child] || [],
        String(this.from[parent][child])
          ? [[startTo[parent], this.from[parent][child]]]
          : startTo[parent]
      );
    } else {
      this.from[parent][
        final as unknown as keyof Agent["from"][keyof Agent["from"]]
      ] = union(
        this.from[parent][
          final as unknown as keyof Agent["from"][keyof Agent["from"]]
        ] || [],
        String(this.from[parent][child])
          ? [
              [
                this.from[parent][child],
                this.from[child][
                  final as unknown as keyof Agent["from"][keyof Agent["from"]]
                ],
              ],
            ]
          : this.from[child][
              final as unknown as keyof Agent["from"][keyof Agent["from"]]
            ]
      );
    }
    delete this.from[parent][child];
    this.path += `${parent}/${child}/`;
    while (Object.entries(this.from).length > 1) {
      this.sources = getSources(this.from);
      if (eliminateLinearSources(this.sources, this.from)) continue;
      this.sinks = getSinks(this.from, final);
      if (eliminateLinearSinks(this.sinks, this.from, final)) continue;
      break;
    }
  }
}

function getSources(from: Agent["from"]) {
  const startTo = from[""];
  return Object.keys(startTo)
    .filter(
      (source) =>
        !Object.entries(from).some(
          ([parent, parentTo]) => parent && source in parentTo
        )
    )
    .map((source) => [source, Object.keys(from[source])] as const);
}

function eliminateLinearSources(
  sources: NonNullable<Agent["sources"]>,
  from: Agent["from"]
) {
  const startTo = from[""];
  return sources.reduce((some, [source, children]) => {
    const { length: outdegree, 0: child } = children;
    if (outdegree > 1) return some;
    startTo[child] = union(
      startTo[child] || [],
      String(from[source][child])
        ? [[startTo[source], from[source][child]]]
        : startTo[source]
    );
    delete startTo[source];
    delete from[source];
    return true;
  }, false);
}

function getSinks(from: Agent["from"], final: Agent["final"]) {
  return Object.entries(from)
    .filter(([, sinkTo]) =>
      Object.keys(sinkTo).every((child) => child === String(final))
    )
    .map(
      ([sink]) =>
        [
          sink,
          Object.keys(from).filter((parent) => sink in from[parent]),
        ] as const
    );
}

function eliminateLinearSinks(
  sinks: NonNullable<Agent["sinks"]>,
  from: Agent["from"],
  final: Agent["final"]
) {
  return sinks.reduce((some, [sink, parents]) => {
    const { length: indegree, 0: parent } = parents;
    if (indegree > 1) return some;
    from[parent][final as unknown as keyof Agent["from"][keyof Agent["from"]]] =
      union(
        from[parent][
          final as unknown as keyof Agent["from"][keyof Agent["from"]]
        ] || [],
        String(from[parent][sink])
          ? [
              [
                from[parent][sink],
                from[sink][
                  final as unknown as keyof Agent["from"][keyof Agent["from"]]
                ],
              ],
            ]
          : from[sink][
              final as unknown as keyof Agent["from"][keyof Agent["from"]]
            ]
      );
    delete from[parent][sink];
    delete from[sink];
    return true;
  }, false);
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
  const margins = choices.map(
    ([parent, child]) => fromUnion(this.from[parent][child]).length
  );
  const min = margins.reduce((cummin, margin) => Math.min(cummin, margin));
  const argmins = [...margins.keys()].filter((i) => margins[i] === min);
  return choices[argmins[Math.floor(Math.random() * argmins.length)]];
};

export const uniform: Policy = function (choices) {
  return choices[Math.floor(Math.random() * choices.length)];
};

export const linear: Policy = function (choices, returns) {
  const estimates = choices.map(([parent, child]) => {
    const choice = `${this.path}${parent}/${child}/`;
    return Object.entries(returns).reduce(
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
