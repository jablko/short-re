import { Agent, linear } from "./index.js";
onmessage = ({ data: values, ports: [requester] }) => {
    const agent = new Agent(values);
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = ({ ports: [requester] }) => requester.postMessage(agent.episode(linear));
    requester.postMessage(agent.from, [port2]);
};
