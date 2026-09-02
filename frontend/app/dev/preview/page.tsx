import Link from "next/link";

const previews = [
  ["Dashboard", "/dev/preview/dashboard"],
  ["Round 1", "/dev/preview/round1"],
  ["Round 2", "/dev/preview/round2"],
  ["Round 3", "/dev/preview/round3"],
  ["Cipher Gate", "/dev/preview/gate/2"],
  ["Round 4", "/dev/preview/round4"],
] as const;

export default function PreviewIndexPage() {
  return (
    <main className="page-gutter mx-auto min-h-screen w-full max-w-5xl py-16">
      <p className="font-mono-data text-xs font-bold tracking-[0.2em] text-primary uppercase">
        Synthetic data only
      </p>
      <h1 className="mt-4 text-5xl font-bold uppercase sm:text-7xl">Development previews</h1>
      <p className="mt-5 max-w-2xl text-secondary">
        Choose a participant surface. Links remain visible before each phase preview is implemented.
      </p>
      <ul className="mt-12 grid border-t border-border sm:grid-cols-2">
        {previews.map(([label, href]) => (
          <li key={href} className="border-r border-b border-border">
            <Link className="block p-6 text-2xl font-bold uppercase hover:bg-primary hover:text-black" href={href}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
