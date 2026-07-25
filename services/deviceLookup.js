// Resolves a raw Android "ro.product.model" code (e.g. "22041216I")
// into a human-readable marketing name (e.g. "Redmi K50i") using the
// publicly available, daily auto-updated Google Play certified device
// database maintained at:
// https://github.com/androidtrackers/certified-android-devices

const SOURCE_URL =
    "https://raw.githubusercontent.com/androidtrackers/certified-android-devices/master/by_model.json";

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let modelIndex = null;      // Map<original model code, {brand, name, device}>
let lowerModelIndex = null; // Map<lowercase model code, {brand, name, device}>
let lastFetchedAt = 0;
let fetchingPromise = null;

async function fetchDeviceDatabase() {

    const response = await fetch(SOURCE_URL);

    if (!response.ok) {

        throw new Error(`Device DB fetch failed: ${response.status}`);

    }

    const raw = await response.json();

    const nextModelIndex = new Map();
    const nextLowerModelIndex = new Map();

    for (const [modelCode, entries] of Object.entries(raw)) {

        if (!Array.isArray(entries) || !entries.length) continue;

        // Multiple devices can share a model code (rare) - keep the first.
        const entry = entries[0];

        const value = {

            brand: entry.brand || "",

            name: entry.name || "",

            device: entry.device || ""

        };

        nextModelIndex.set(modelCode, value);
        nextLowerModelIndex.set(modelCode.toLowerCase(), value);

    }

    modelIndex = nextModelIndex;
    lowerModelIndex = nextLowerModelIndex;
    lastFetchedAt = Date.now();

}

async function ensureLoaded() {

    const isStale = Date.now() - lastFetchedAt > REFRESH_INTERVAL_MS;

    if (modelIndex && !isStale) return;

    if (fetchingPromise) {

        await fetchingPromise;

        return;

    }

    fetchingPromise = fetchDeviceDatabase()

        .catch((error) => {

            console.error("Device DB refresh failed:", error.message);

            // Keep serving the stale cache (if any) rather than crashing.

        })

        .finally(() => {

            fetchingPromise = null;

        });

    await fetchingPromise;

}

// Returns { marketingName, brand } or null if unresolved / lookup unavailable.
async function resolveMarketingName(modelCode) {

    if (!modelCode) return null;

    try {

        await ensureLoaded();

    }

    catch (error) {

        console.error(error);

    }

    if (!modelIndex) return null;

    const hit =
        modelIndex.get(modelCode) ||
        lowerModelIndex.get(modelCode.toLowerCase());

    if (!hit || !hit.name) return null;

    return {

        marketingName: hit.name,

        brand: hit.brand

    };

}

module.exports = { resolveMarketingName };
