// Jest 27's jsdom environment doesn't expose Node's structuredClone.
const v8 = require('v8');

if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (value) => v8.deserialize(v8.serialize(value));
}
