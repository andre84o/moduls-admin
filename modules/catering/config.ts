/**
 * Catering module — server-side configuration.
 *
 * The set of menus a visitor may select is validated SERVER-SIDE against this
 * whitelist so a tampered request can't inject an arbitrary value (see
 * modules/catering/actions.ts). In the generic multi-tenant base this list is a
 * module-owned constant rather than a client/config import — a client build can
 * later override the visible options, but the security whitelist stays here and
 * stays dependency-free of any client styling/config.
 */

/** Menu options the public catering form offers and the action accepts. */
export const CATERING_MENUS: readonly string[] = [
  "Meny 1 – 299 kr/person",
  "Meny 2 – 349 kr/person",
  "Meny 3 – 399 kr/person",
  "Meny 4 – 449 kr/person",
  "Skräddarsy egen meny – vi återkommer med pris",
];
