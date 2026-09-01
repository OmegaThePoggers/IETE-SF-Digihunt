import { notFound } from "next/navigation";

import { devPreviewsEnabled } from "@/lib/dev-preview";

export default function PreviewLayout({ children }: LayoutProps<"/dev/preview">) {
  if (!devPreviewsEnabled()) {
    notFound();
  }

  return children;
}
