import type { PageServerLoad } from "./$types";

// Installations and actor are loaded by the layout.
// This page has no additional data needs.
export const load: PageServerLoad = async () => {
  return {};
};
