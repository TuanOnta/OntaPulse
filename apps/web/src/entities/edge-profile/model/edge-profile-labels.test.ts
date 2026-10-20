import { describe, expect, it } from "vitest";

import type { EdgeDetection } from "@/shared/types/domain";

import {
  confidenceText,
  layerLabel,
  signalText,
  sortDetections,
  supportedVendorsText,
  vendorLabel,
} from "./edge-profile-labels";

const detection = (vendor: string, layer: EdgeDetection["layer"]): EdgeDetection => ({
  vendor,
  layer,
  confidence: "MEDIUM",
  signals: [],
});

describe("edge profile labels", () => {
  it.each([
    ["CLOUDFLARE", "Cloudflare"],
    ["AWS_CLOUDFRONT", "Amazon CloudFront"],
    ["AWS_WAF", "AWS WAF"],
    ["VERCEL", "Vercel"],
    ["FASTLY", "Fastly"],
    ["DATADOME", "DataDome"],
    ["HUMAN_PERIMETERX", "HUMAN"],
    ["SOME_NEW_VENDOR", "some new vendor"],
  ])("names the vendor %s as %s", (key, label) => {
    expect(vendorLabel(key)).toBe(label);
  });

  it.each([
    ["CDN", "CDN"],
    ["WAF", "WAF"],
    ["ANTI_BOT", "Anti-bot"],
    ["EDGE_FUNCTION", "edge function"],
  ])("names the layer %s as %s", (key, label) => {
    expect(layerLabel(key)).toBe(label);
  });

  it("words the confidence and degrades for an unknown level", () => {
    expect(confidenceText("HIGH")).toBe("High confidence");
    expect(confidenceText("MEDIUM")).toBe("Medium confidence");
    expect(confidenceText("LOW")).toBe("Low confidence");
    expect(confidenceText("SURE")).toBe("sure confidence");
  });

  it("words a signal as its kind and name", () => {
    expect(signalText({ type: "HEADER_NAME", name: "cf-ray" })).toBe("Header: cf-ray");
    expect(signalText({ type: "COOKIE_NAME", name: "datadome" })).toBe("Cookie: datadome");
    expect(signalText({ type: "STATUS_MARKER", name: "cf-mitigated" })).toBe(
      "Challenge marker: cf-mitigated",
    );
    expect(signalText({ type: "NEW_KIND", name: "x" })).toBe("new kind: x");
  });

  it("orders layers CDN, WAF, anti-bot, then vendor name, without changing the input", () => {
    const input = [
      detection("DATADOME", "ANTI_BOT"),
      detection("AWS_WAF", "WAF"),
      detection("VERCEL", "CDN"),
      detection("CLOUDFLARE", "CDN"),
      detection("X", "EDGE_FUNCTION" as never),
    ];

    expect(sortDetections(input).map((item) => item.vendor)).toEqual([
      "CLOUDFLARE",
      "VERCEL",
      "AWS_WAF",
      "DATADOME",
      "X",
    ]);
    expect(input[0]?.vendor).toBe("DATADOME");
  });

  it("lists the vendors the client can name", () => {
    expect(supportedVendorsText()).toBe(
      "Cloudflare, Amazon CloudFront, AWS WAF, Vercel, Fastly, DataDome, and HUMAN",
    );
  });
});
