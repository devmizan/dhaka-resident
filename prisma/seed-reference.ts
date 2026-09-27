/* Seeds only reference data (countries, cities, areas, categories, amenities) — safe to run in production. */
process.env.SEED_MODE = "reference";

await import("./seed");

export {};
