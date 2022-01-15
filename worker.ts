import { Agent, linear } from "./index.js";

onmessage = ({ data: values, ports: [requester] }) => {
  const agent = new Agent(values as never, linear);
  while (agent.eliminateLinearSources(agent.getSources()));
  while (agent.eliminateLinearSinks(agent.getSinks()));
  const { port1, port2 } = new MessageChannel();
  port1.onmessage = ({ data: { method }, ports: [requester] }) => {
    switch (method) {
      case "from":
        requester.postMessage(agent.from);
        break;
      case "episode":
        requester.postMessage(agent.episode());
        break;
      default:
        throw new Error(`Unexpected method '${method as string}'`);
    }
  };
  requester.postMessage(undefined, [port2]);
};
