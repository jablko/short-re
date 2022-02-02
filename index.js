export class Agent {
    constructor(values) {
        var _a, _b, _c, _d, _e, _f;
        this.from = {};
        this.returns = {};
        this.final = [...values].sort();
        const bySuffix = {};
        for (const value of values) {
            if (values.some((other) => other !== value && other.startsWith(value)))
                continue;
            for (const i of Object.keys(value)) {
                const prefix = value.slice(0, i);
                const suffix = value.slice(i);
                (bySuffix[suffix] || (bySuffix[suffix] = [])).push(prefix);
            }
        }
        const byParent = {};
        for (const [suffix, parent] of Object.entries(bySuffix)) {
            const bySymbol = (byParent[_a = parent.sort()] || (byParent[_a] = {}));
            const child = bySuffix[suffix.slice(1)] || this.final;
            (bySymbol[_b = suffix[0]] || (bySymbol[_b] = [])).push(child);
        }
        const intersections = Object.fromEntries(Object.entries(byParent).map(([parent, bySymbol]) => [
            parent,
            Object.fromEntries(Object.entries(bySymbol).map(([symbol, [a, ...bs]]) => [
                symbol,
                a.filter((prefix) => bs.every((b) => b.includes(prefix))).sort(),
            ])),
        ]));
        for (const parent of [
            ...Object.values(bySuffix),
            ...Object.values(intersections).flatMap((bySymbol) => Object.values(bySymbol)),
        ]) {
            if (parent.length === this.final.length)
                continue;
            (_c = this.from)[_d = parent] || (_c[_d] = Object.fromEntries([...Object.values(bySuffix), this.final]
                .filter((child) => child.length > parent.length &&
                parent.every((prefix) => child.includes(prefix)))
                .filter((child, i, siblings) => !siblings.some((sibling) => sibling.length < child.length &&
                sibling.every((prefix) => child.includes(prefix))))
                .map((child) => [child, [""]])));
        }
        for (const [parent, bySymbol] of Object.entries(intersections)) {
            const parentTo = ((_e = this.from)[parent] || (_e[parent] = {}));
            for (const [symbol, child] of Object.entries(bySymbol)) {
                (parentTo[_f = child] || (parentTo[_f] = [])).push(symbol);
            }
        }
        while (Object.entries(this.from).length > 1) {
            this.sources = getSources(this.from);
            if (eliminateLinearSources(this.sources, this.from))
                continue;
            this.sinks = getSinks(this.from, this.final);
            if (eliminateLinearSinks(this.sinks, this.from, this.final))
                continue;
            break;
        }
    }
    episode(policy) {
        const episode = new Episode(JSON.parse(JSON.stringify(this.from)), JSON.parse(JSON.stringify(this.sources)), JSON.parse(JSON.stringify(this.sinks)));
        while (Object.entries(episode.from).length > 1)
            episode.step(policy.call(episode, [
                ...episode.sources.flatMap(([source, children]) => children.map((child) => [source, child])),
                ...episode.sinks.flatMap(([sink, parents]) => parents
                    .filter((parent) => !episode.sources.some(([source]) => source === parent))
                    .map((parent) => [parent, sink])),
            ], this.returns), this.final);
        const startTo = episode.from[""];
        return (this.returns[episode.path] = fromUnion(startTo[this.final]));
    }
}
class Episode {
    constructor(from, sources, sinks) {
        this.from = from;
        this.sources = sources;
        this.sinks = sinks;
        this.path = "";
    }
    step([parent, child], final) {
        if (this.sources.some(([source]) => source === parent)) {
            const startTo = this.from[""];
            startTo[child] = union(startTo[child] || [], String(this.from[parent][child])
                ? [[startTo[parent], this.from[parent][child]]]
                : startTo[parent]);
        }
        else {
            this.from[parent][final] = union(this.from[parent][final] || [], String(this.from[parent][child])
                ? [
                    [
                        this.from[parent][child],
                        this.from[child][final],
                    ],
                ]
                : this.from[child][final]);
        }
        delete this.from[parent][child];
        this.path += `${parent}/${child}/`;
        while (Object.entries(this.from).length > 1) {
            this.sources = getSources(this.from);
            if (eliminateLinearSources(this.sources, this.from))
                continue;
            this.sinks = getSinks(this.from, final);
            if (eliminateLinearSinks(this.sinks, this.from, final))
                continue;
            break;
        }
    }
}
function getSources(from) {
    const startTo = from[""];
    return Object.keys(startTo)
        .filter((source) => !Object.entries(from).some(([parent, parentTo]) => parent && source in parentTo))
        .map((source) => [source, Object.keys(from[source])]);
}
function eliminateLinearSources(sources, from) {
    const startTo = from[""];
    return sources.reduce((some, [source, children]) => {
        const { length: outdegree, 0: child } = children;
        if (outdegree > 1)
            return some;
        startTo[child] = union(startTo[child] || [], String(from[source][child])
            ? [[startTo[source], from[source][child]]]
            : startTo[source]);
        delete startTo[source];
        delete from[source];
        return true;
    }, false);
}
function getSinks(from, final) {
    return Object.entries(from)
        .filter(([, sinkTo]) => Object.keys(sinkTo).every((child) => child === String(final)))
        .map(([sink]) => [
        sink,
        Object.keys(from).filter((parent) => sink in from[parent]),
    ]);
}
function eliminateLinearSinks(sinks, from, final) {
    return sinks.reduce((some, [sink, parents]) => {
        const { length: indegree, 0: parent } = parents;
        if (indegree > 1)
            return some;
        from[parent][final] =
            union(from[parent][final] || [], String(from[parent][sink])
                ? [
                    [
                        from[parent][sink],
                        from[sink][final],
                    ],
                ]
                : from[sink][final]);
        delete from[parent][sink];
        delete from[sink];
        return true;
    }, false);
}
function union(a, b) {
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
function constituteConcatenation(node) {
    if (typeof node === "string")
        return node;
    const [a, ...bs] = node;
    const aValues = a.flatMap((child) => constituteConcatenation(child));
    return !bs.length
        ? aValues
        : aValues.flatMap((aValue) => constituteConcatenation(bs).map((bValue) => aValue + bValue));
}
export function fromUnion(node) {
    return `(?:${node.map((child) => fromConcatenation(child)).join("|")})`;
}
export function fromConcatenation(node) {
    if (typeof node === "string")
        return node.replace(/\./g, String.raw `\.`);
    return node.map((child) => fromUnion(child)).join("");
}
export const greedy = function (choices) {
    const margins = choices.map(([parent, child]) => fromUnion(this.from[parent][child]).length);
    const min = margins.reduce((cummin, margin) => Math.min(cummin, margin));
    const argmins = [...margins.keys()].filter((i) => margins[i] === min);
    return choices[argmins[Math.floor(Math.random() * argmins.length)]];
};
export const uniform = function (choices) {
    return choices[Math.floor(Math.random() * choices.length)];
};
export const linear = function (choices, returns) {
    const estimates = choices.map(([parent, child]) => {
        const choice = `${this.path}${parent}/${child}/`;
        return Object.entries(returns).reduce((cummin, [experience, pattern]) => !experience.startsWith(choice)
            ? cummin
            : Math.min(cummin, pattern.length), Infinity);
    });
    const [min, max] = estimates.reduce(([cummin, cummax], estimate) => estimate === Infinity
        ? [cummin, cummax]
        : [Math.min(cummin, estimate), Math.max(cummax, estimate)], [Infinity, 0]);
    let cumsum = 0;
    const cumsums = estimates.map((estimate) => (cumsum +=
        max - (estimate === Infinity ? Math.min(min, max) : estimate) + 1));
    const x = Math.random() * cumsums[cumsums.length - 1];
    return choices[cumsums.findIndex((cumsum) => cumsum > x)];
};
