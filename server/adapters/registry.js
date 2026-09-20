const FanMTLAdapter = require('./FanMTLAdapter');
const WuxiaBoxAdapter = require('./WuxiaBoxAdapter');
const WTRLabAdapter = require('./WTRLabAdapter');
const GenericAdapter = require('./GenericAdapter');

/**
 * Adapter Registry — Manages site adapter discovery and selection.
 * Adapters are checked in order; the first match wins.
 * Generic adapter is always last as the fallback.
 */
const adapters = [
  FanMTLAdapter,
  WuxiaBoxAdapter,
  WTRLabAdapter,
  GenericAdapter, // always last
];

/**
 * Detect which adapter matches the given URL
 * @param {string} url - The novel page URL
 * @returns {{ adapter: typeof import('./BaseAdapter'), info: { id: string, name: string, description: string, domains: string[] } }}
 */
function detectAdapter(url) {
  for (const AdapterClass of adapters) {
    if (AdapterClass.siteMatch(url)) {
      return {
        AdapterClass,
        info: {
          id: AdapterClass.siteId,
          name: AdapterClass.siteName,
          description: AdapterClass.siteDescription,
          domains: AdapterClass.domains,
        },
      };
    }
  }
  // Should never reach here because GenericAdapter always matches
  return {
    AdapterClass: GenericAdapter,
    info: {
      id: GenericAdapter.siteId,
      name: GenericAdapter.siteName,
      description: GenericAdapter.siteDescription,
      domains: GenericAdapter.domains,
    },
  };
}

/**
 * Get list of all registered adapters with metadata
 * @returns {Array<{id: string, name: string, description: string, domains: string[]}>}
 */
function listAdapters() {
  return adapters.map(A => ({
    id: A.siteId,
    name: A.siteName,
    description: A.siteDescription,
    domains: A.domains,
  }));
}

module.exports = { detectAdapter, listAdapters, adapters };
