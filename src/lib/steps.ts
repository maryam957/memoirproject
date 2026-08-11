/**
 * The onboarding sequence, in order.
 *
 * Onboarding collects, then authentication closes it. Five steps, one
 * question each, and only the name is genuinely required — the cost of
 * somebody abandoning here is far higher than the cost of a memoir that
 * starts out thin.
 */

export type Step = {
  slug: string;
  path: string;
  label: string;
  required: boolean;
};

export const STEPS: Step[] = [
  { slug: "about", path: "/onboarding/about", label: "Who", required: false },
  { slug: "name", path: "/onboarding/name", label: "Name", required: true },
  { slug: "life", path: "/onboarding/life", label: "Years", required: false },
  { slug: "line", path: "/onboarding/line", label: "Line", required: false },
  { slug: "cover", path: "/onboarding/cover", label: "Cover", required: false },
];

export const ACCOUNT_PATH = "/account";

export function stepIndex(slug: string): number {
  return STEPS.findIndex((step) => step.slug === slug);
}

export function nextPath(slug: string): string {
  const next = STEPS[stepIndex(slug) + 1];
  return next ? next.path : ACCOUNT_PATH;
}

export function previousPath(slug: string): string {
  const previous = STEPS[stepIndex(slug) - 1];
  return previous ? previous.path : "/";
}
