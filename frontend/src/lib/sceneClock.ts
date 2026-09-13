// The renderer owns time. React scheduling and GPU ignition read this same clock.
let sceneTime = 0
export function setSceneTime(value: number) { sceneTime = value }
export function getSceneTime() { return sceneTime }
