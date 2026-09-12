const store = {};
module.exports = { get: (k) => store[k], set: (k, v) => { store[k] = v; } };
