import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { APP_TITLE, documentTitle, useDocumentTitle } from "./use-document-title";

describe("documentTitle", () => {
  it("puts the screen first and trims it", () => {
    expect(documentTitle("  Acme  ")).toBe("Acme · OntaPulse");
  });

  it("falls back to the app name for an empty title", () => {
    expect(documentTitle("")).toBe(APP_TITLE);
    expect(documentTitle(null)).toBe(APP_TITLE);
    expect(documentTitle(undefined)).toBe(APP_TITLE);
  });

  it("keeps markup as plain text", () => {
    expect(documentTitle("<b>x</b>")).toBe("<b>x</b> · OntaPulse");
  });
});

describe("useDocumentTitle", () => {
  it("sets the title, follows changes, and restores the app name on unmount", () => {
    const { rerender, unmount } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: "Workspace" },
    });
    expect(document.title).toBe("Workspace · OntaPulse");

    rerender({ title: "Acme" });
    expect(document.title).toBe("Acme · OntaPulse");

    unmount();
    expect(document.title).toBe(APP_TITLE);
  });
});
