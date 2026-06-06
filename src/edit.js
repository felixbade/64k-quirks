import { PFExplorer } from "../../parameter-flow/src/pfExplorer.ts";

function prefix(id, values) {
  const out = {};
  for (const [k, v] of Object.entries(values)) out[`${id}.${k}`] = v;
  return out;
}

function stripPrefix(id, values) {
  const prefix = `${id}.`;
  const local = {};
  for (const [k, v] of Object.entries(values)) {
    if (k.startsWith(prefix)) local[k.slice(prefix.length)] = v;
  }
  return local;
}

function buildDefaults(registry) {
  const out = {};
  for (const [id, mod] of Object.entries(registry)) {
    Object.assign(out, prefix(id, mod.defaults));
  }
  return out;
}

function buildShaderHandlers(id, mod) {
  const handlers = {};
  for (const [name, fn] of Object.entries(mod.explorerHandlers)) {
    handlers[`${id}.${name}`] = (state, input) =>
      prefix(id, fn(stripPrefix(id, state), input));
  }
  return handlers;
}

export function createEditSession(registry, getSample) {
  const defaults = buildDefaults(registry);
  const handlersByShader = {};
  for (const [id, mod] of Object.entries(registry)) {
    handlersByShader[id] = buildShaderHandlers(id, mod);
  }

  let activeShader = getSample().shaderId;

  const explorer = new PFExplorer({
    handlers: handlersByShader[activeShader] ?? {},
    getState: () => {
      const sampled = getSample();
      return { ...defaults, ...prefix(sampled.shaderId, sampled.values) };
    },
  });

  return {
    setActiveShader(shaderId) {
      if (shaderId === activeShader) return;
      activeShader = shaderId;
      explorer.setHandlers(handlersByShader[shaderId] ?? {});
    },
    getOverridesForShader(shaderId) {
      return stripPrefix(shaderId, explorer.getOverrides());
    },
    destroy() {
      explorer.destroy();
    },
  };
}
