import { kifs } from "./kifs/index.js";
import { tunnel } from "./tunnel/index.js";
import { grid } from "./grid/index.js";
import { plasma } from "./plasma/index.js";

export const SHADERS = { kifs, tunnel, grid, plasma };
export const SHADER_IDS = Object.keys(SHADERS);
