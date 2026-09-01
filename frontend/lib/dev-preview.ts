export function devPreviewsEnabled(
  value: string | undefined = process.env.NEXT_PUBLIC_ENABLE_DEV_PREVIEWS,
  environment: string | undefined = process.env.NODE_ENV,
): boolean {
  return environment !== "production" && value?.trim() === "true";
}

const productionToPreviewHref: Record<string, string> = {
  "/dashboard": "/dev/preview/dashboard",
  "/round1": "/dev/preview/round1?state=unlocked",
  "/round2": "/dev/preview/round2?state=unlocked",
  "/master": "/dev/preview/master?state=ready",
  "/round3": "/dev/preview/round3?state=submitted",
};

export function toDevPreviewHref(href: string): string {
  const pathname = href.startsWith("/") ? href.split(/[?#]/, 1)[0] : href;
  return productionToPreviewHref[pathname] ?? "/dev/preview";
}

export function resolvePreviewState<const TState extends string>(
  requestedState: string | string[] | undefined,
  knownStates: readonly TState[],
  fallback: TState,
): TState {
  const candidate = Array.isArray(requestedState) ? requestedState[0] : requestedState;
  return candidate !== undefined && knownStates.some((state) => state === candidate)
    ? (candidate as TState)
    : fallback;
}
