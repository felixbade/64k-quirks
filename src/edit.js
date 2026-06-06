import { PFExplorer } from "../../parameter-flow/src/pfExplorer.ts";

function buildUnion(registry) {
  const variables = {};
  const handlers = {};

  for (const [id, mod] of Object.entries(registry)) {
    for (const [k, v] of Object.entries(mod.defaults)) {
      variables[`${id}.${k}`] = v;
    }
    for (const [name, fn] of Object.entries(mod.explorerHandlers)) {
      handlers[`${id}.${name}`] = (state, input) => {
        const local = {};
        const prefix = `${id}.`;
        for (const [k, v] of Object.entries(state)) {
          if (k.startsWith(prefix)) local[k.slice(prefix.length)] = v;
        }
        const delta = fn(local, input);
        const out = {};
        for (const [k, v] of Object.entries(delta)) {
          out[`${id}.${k}`] = v;
        }
        return out;
      };
    }
  }

  return { variables, handlers };
}

function stripPrefix(id, values) {
  const prefix = `${id}.`;
  const local = {};
  for (const [k, v] of Object.entries(values)) {
    if (k.startsWith(prefix)) local[k.slice(prefix.length)] = v;
  }
  return local;
}

export function createEditSession(registry, renderer, shaderIds) {
  let editMode = false;
  let explorer = null;
  let shaderIndex = 0;
  let keyHandler = null;

  function activeShaderId() {
    return shaderIds[shaderIndex];
  }

  function rotateShader(dir) {
    shaderIndex = (shaderIndex + dir + shaderIds.length) % shaderIds.length;
    const id = activeShaderId();
    renderer.setActive(id);
    console.log("edit shader:", id);
  }

  function syncShaderIndexTo(id) {
    const i = shaderIds.indexOf(id);
    if (i >= 0) shaderIndex = i;
  }

  function toggle(on) {
    if (on === editMode) return;
    editMode = on;
    if (editMode) {
      const { variables, handlers } = buildUnion(registry);
      explorer = new PFExplorer({
        duration: 0,
        clipboard: true,
        variables,
        handlers,
      });
      renderer.setActive(activeShaderId());
      keyHandler = (e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          rotateShader(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          rotateShader(1);
        }
      };
      window.addEventListener("keydown", keyHandler);
      console.log(
        "edit on — Left/Right: shader, Enter: lock, 1-9: handler, E/I: clipboard, Backspace: reset, m: exit",
      );
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
      if (keyHandler) {
        window.removeEventListener("keydown", keyHandler);
        keyHandler = null;
      }
      explorer?.destroy();
      explorer = null;
      console.log("edit off");
    }
  }

  return {
    isOn: () => editMode,
    toggle,
    rotateShader,
    syncShaderIndexTo,
    activeShaderId,
    getValuesForActiveShader() {
      if (!explorer) return null;
      return stripPrefix(activeShaderId(), explorer.getCurrentValues());
    },
    destroy() {
      toggle(false);
    },
  };
}
