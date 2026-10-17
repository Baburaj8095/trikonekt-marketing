/**
 * growthProductionGuard.js
 *
 * Centralized utility to detect whether the application is running in the
 * growth.vin production environment.
 *
 * Guarantees zero side-effects on staging (asiyapp.com, staging-growth.vin, localhost).
 */

export function isGrowthProduction() {
  if (typeof window === "undefined") return false;
  const host = (window.location.hostname || "").toLowerCase();

  // Staging environments are NEVER restricted
  if (host.includes("staging") || host.includes("asiyapp") || host === "localhost" || host === "127.0.0.1") {
    return false;
  }

  // Strictly matches production growth.vin and its direct subdomains
  return host === "growth.vin" || host.endsWith(".growth.vin");
}
