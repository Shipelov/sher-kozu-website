import { describe, expect, it } from "vitest";

import {
  buildOAuthState,
  decodeOAuthState,
  encodeOAuthState,
  getPostAuthRedirectUrl,
} from "@shared/oauthState";

describe("oauth redirect state helpers", () => {
  it("builds a callback-aware state with normalized return path", () => {
    expect(buildOAuthState("https://sher-kozu.example", "admin/club?tab=bitrix")).toEqual({
      origin: "https://sher-kozu.example",
      redirectUri: "https://sher-kozu.example/api/oauth/callback",
      returnPath: "/admin/club?tab=bitrix",
    });
  });

  it("decodes previously encoded state and preserves redirect data", () => {
    const encoded = encodeOAuthState({
      origin: "https://farm.example",
      redirectUri: "https://farm.example/api/oauth/callback",
      returnPath: "/dashboard?from=login#club",
    });

    expect(decodeOAuthState(encoded)).toEqual({
      origin: "https://farm.example",
      redirectUri: "https://farm.example/api/oauth/callback",
      returnPath: "/dashboard?from=login#club",
    });
  });

  it("normalizes absolute return urls to same-site paths when decoding", () => {
    const encoded = encodeOAuthState({
      origin: "https://farm.example",
      redirectUri: "https://farm.example/api/oauth/callback",
      returnPath: "https://other.example/admin/club?tab=members#top",
    });

    expect(decodeOAuthState(encoded)).toEqual({
      origin: "https://farm.example",
      redirectUri: "https://farm.example/api/oauth/callback",
      returnPath: "/admin/club?tab=members#top",
    });
  });

  it("rejects malformed payloads without valid origin or redirect uri", () => {
    expect(decodeOAuthState("not-base64")).toBeNull();

    const encoded = Buffer.from(JSON.stringify({
      origin: "",
      redirectUri: null,
      returnPath: "/club",
    }), "utf-8").toString("base64url");

    expect(decodeOAuthState(encoded)).toBeNull();
  });

  it("builds the post-auth redirect url from origin and normalized path", () => {
    expect(getPostAuthRedirectUrl({
      origin: "https://farm.example",
      redirectUri: "https://farm.example/api/oauth/callback",
      returnPath: "club/feed?filter=new",
    })).toBe("https://farm.example/club/feed?filter=new");
  });
});
