import { describe, expect, it } from "vitest";
import { liveExitFromDialogSurface } from "@/lib/live-exit";

describe("liveExitFromDialogSurface", () => {
  it("maps primary to see-the-verdict", () => {
    expect(liveExitFromDialogSurface("primary")).toEqual({ kind: "see-the-verdict" });
  });

  it("maps secondary to keep-listening", () => {
    expect(liveExitFromDialogSurface("secondary")).toEqual({ kind: "keep-listening" });
  });

  it("maps dismiss to keep-listening", () => {
    expect(liveExitFromDialogSurface("dismiss")).toEqual({ kind: "keep-listening" });
  });
});
