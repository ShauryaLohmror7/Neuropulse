/** Source-cable reveal is a presentation effect, not firing or biological growth. */
export const ANATOMY_ENTRANCE_SECONDS = 2.6
export function anatomyEntrance(elapsed:number, skip:boolean) {
  return skip ? 1.1 : Math.min(1.1, Math.max(0,elapsed / ANATOMY_ENTRANCE_SECONDS) * 1.1)
}
