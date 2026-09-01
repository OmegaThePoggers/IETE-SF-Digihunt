import Link from "next/link";

type PreviewRoute = "dashboard" | "round1" | "round2" | "master" | "round3";

type PreviewToolbarProps = {
  activeRoute: PreviewRoute;
  activeFixture: string;
  states: readonly string[];
};

const routes: { id: PreviewRoute; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "round1", label: "Round 1" },
  { id: "round2", label: "Round 2" },
  { id: "master", label: "Master" },
  { id: "round3", label: "Round 3" },
];

export function PreviewToolbar({ activeRoute, activeFixture, states }: PreviewToolbarProps) {
  const routeHref = `/dev/preview/${activeRoute}`;

  return (
    <nav
      aria-label="Development preview"
      data-preview-toolbar="true"
      className="font-mono-data sticky top-0 z-50 border-b-2 border-primary bg-black px-4 py-3 text-xs text-white shadow-[0_4px_0_#c8ff00]"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3">
        <p className="font-bold tracking-[0.16em] text-primary uppercase">Dev preview</p>
        <div className="flex flex-wrap gap-3" aria-label="Preview routes">
          {routes.map((route) => (
            <Link
              key={route.id}
              href={`/dev/preview/${route.id}`}
              aria-current={activeRoute === route.id ? "page" : undefined}
              className="underline-offset-4 hover:text-primary hover:underline focus-visible:text-primary"
            >
              {route.label}
            </Link>
          ))}
        </div>
        <span className="hidden h-5 w-px bg-white/30 sm:block" aria-hidden="true" />
        <p>
          Active fixture: <strong className="text-primary">{activeFixture}</strong>
        </p>
        <div className="flex flex-wrap gap-3" aria-label="Fixture states">
          {states.map((state) => (
            <Link
              key={state}
              href={`${routeHref}?state=${encodeURIComponent(state)}`}
              aria-current={activeFixture === state ? "page" : undefined}
              className="underline underline-offset-4 aria-[current=page]:text-primary"
            >
              {state}
            </Link>
          ))}
          <Link href={routeHref} className="font-bold text-primary underline underline-offset-4">
            Reset
          </Link>
        </div>
      </div>
    </nav>
  );
}
