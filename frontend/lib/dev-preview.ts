export function devPreviewsEnabled(
  value: string | undefined = process.env.NEXT_PUBLIC_ENABLE_DEV_PREVIEWS,
): boolean {
  return value === "true";
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
