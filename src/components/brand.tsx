import { Layers2 } from "lucide-react";

export function Mark() {
  return <Layers2 size={22} strokeWidth={1.6} aria-hidden="true" />;
}

export function Brand() {
  return (
    <a href="/" className="brand" aria-label="substuff home">
      <Mark />
      <span>substuff</span>
    </a>
  );
}
