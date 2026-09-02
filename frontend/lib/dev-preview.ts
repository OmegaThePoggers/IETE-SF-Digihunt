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
  "/round3": "/dev/preview/round3?state=active",
  "/gate/2": "/dev/preview/gate/2?state=ready",
  "/gate/3": "/dev/preview/gate/3?state=ready",
  "/gate/4": "/dev/preview/gate/4?state=ready",
  "/round4": "/dev/preview/round4?state=submitted",
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
