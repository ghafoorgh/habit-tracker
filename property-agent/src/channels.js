// Registry of messaging channels. Each channel registers { ready(), send(contact, text) }.
const channels = {};

export function registerChannel(name, impl) {
  channels[name] = impl;
}

export function getChannel(name) {
  return channels[name];
}

export function channelStatus() {
  return Object.fromEntries(Object.entries(channels).map(([k, v]) => [k, v.status()]));
}
