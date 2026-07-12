import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchGooglePlaceReviews } from "@/modules/website/google-reviews/service";

/**
 * Service tests for the server-only Google Places integration
 * (modules/website/google-reviews/service.ts).
 *
 * `fetch` is stubbed so no network call ever happens. These prove the success
 * path returns the RAW Google payload, that EVERY failure mode is a clean
 * discriminated result (never a throw), missing config is SKIPPED (not ERROR),
 * and the API key never appears in the return value while the request carries the
 * key + field-mask headers and the right URL.
 */

const API_KEY = "test-google-key-DO-NOT-LEAK";
const PLACE_ID = "ChIJ_test_place";
const FIELD_MASK = "id,displayName,rating,userRatingCount,googleMapsUri,reviews";

const ORIGINAL_KEY = process.env.GOOGLE_PLACES_API_KEY;

/** A minimal Places API (New) response with one review. */
function placesResponse() {
  return {
    id: PLACE_ID,
    displayName: { text: "Test Place", languageCode: "en" },
    rating: 4.5,
    userRatingCount: 128,
    googleMapsUri: "https://maps.google.com/?cid=1",
    reviews: [
      {
        rating: 5,
        text: { text: "Excellent service", languageCode: "en" },
        authorAttribution: { displayName: "Jane Doe", photoUri: "https://example.com/jane.jpg" },
        publishTime: "2024-01-01T00:00:00Z",
      },
    ],
  };
}

beforeEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_KEY === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = ORIGINAL_KEY;
});

describe("fetchGooglePlaceReviews — success", () => {
  it("returns OK with the raw Google payload (caller normalizes)", async () => {
    const body = placesResponse();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));

    const result = await fetchGooglePlaceReviews(PLACE_ID);

    expect(result.status).toBe("OK");
    if (result.status !== "OK") return;
    expect(result.payload).toEqual(body); // raw, unnormalized
  });

  it("sends the API key + field mask headers and requests the right URL", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => placesResponse() }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchGooglePlaceReviews(PLACE_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://places.googleapis.com/v1/places/${encodeURIComponent(PLACE_ID)}`);
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe(API_KEY);
    expect(headers["X-Goog-FieldMask"]).toBe(FIELD_MASK);
  });
});

describe("fetchGooglePlaceReviews — clean outcomes (never throw)", () => {
  it("SKIPPED (no fetch) when the API key is missing", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGooglePlaceReviews(PLACE_ID);

    expect(result.status).toBe("SKIPPED");
    if (result.status === "SKIPPED") expect(result.reason).toMatch(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("SKIPPED (no fetch) for a blank place id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGooglePlaceReviews("   ");

    expect(result.status).toBe("SKIPPED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ERROR on a non-200 response (status only, no body leak)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: { message: "leaky google detail" } }) })),
    );

    const result = await fetchGooglePlaceReviews(PLACE_ID);

    expect(result.status).toBe("ERROR");
    if (result.status !== "ERROR") return;
    expect(result.error).toContain("403");
    expect(result.error).not.toContain("leaky google detail");
  });

  it("ERROR on unreadable JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Unexpected token");
        },
      })),
    );

    const result = await fetchGooglePlaceReviews(PLACE_ID);

    expect(result.status).toBe("ERROR");
    if (result.status === "ERROR") expect(result.error).toMatch(/unreadable/i);
  });

  it("ERROR on a network/fetch throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    const result = await fetchGooglePlaceReviews(PLACE_ID);

    expect(result.status).toBe("ERROR");
    if (result.status === "ERROR") expect(result.error).toMatch(/could not reach/i);
  });
});

describe("fetchGooglePlaceReviews — never leaks the API key", () => {
  it("omits the key from a successful result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => placesResponse() })));
    const result = await fetchGooglePlaceReviews(PLACE_ID);
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it("omits the key from an error result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "unauthorized" }) })));
    const result = await fetchGooglePlaceReviews(PLACE_ID);
    expect(result.status).toBe("ERROR");
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });
});
