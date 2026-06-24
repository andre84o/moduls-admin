// Stub for the "server-only" marker package. The real package throws when
// imported outside a React Server Component bundle; under Node/vitest we just
// need it to be an inert module so server-side libs can be unit-tested.
export {};
