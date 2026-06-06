import { kifs } from "./kifs/index.js";
import { tunnel } from "./tunnel/index.js";

export const SHADERS = { kifs, tunnel };
export const SHADER_IDS = Object.keys(SHADERS);
