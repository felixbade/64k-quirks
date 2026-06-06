import { kifs } from "./kifs/index.js";
import { tunnel } from "./tunnel/index.js";
import { grid } from "./grid/index.js";

export const SHADERS = { kifs, tunnel, grid };
export const SHADER_IDS = Object.keys(SHADERS);
