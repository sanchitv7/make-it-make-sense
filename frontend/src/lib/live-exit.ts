export type LiveExitChoice = { kind: "see-the-verdict" } | { kind: "keep-listening" };

export type LiveExitDialogSurface = "primary" | "secondary" | "dismiss";

export function liveExitFromDialogSurface(surface: LiveExitDialogSurface): LiveExitChoice {
  switch (surface) {
    case "primary":
      return { kind: "see-the-verdict" };
    case "secondary":
      return { kind: "keep-listening" };
    case "dismiss":
      return { kind: "keep-listening" };
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
  }
}
