import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type Step = { icon: ReactNode; label: string; to?: string; onClick?: () => void };

/**
 * ASL-first visual step navigation: large, color-coded, icon-led steps with
 * minimal text so the flow can be followed visually.
 */
export function StepFlow({ steps }: { steps: Step[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {steps.map((step, i) => {
        const inner = (
          <div className="flex h-full flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm transition-transform active:scale-95">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 [&_svg]:h-6 [&_svg]:w-6">
              {step.icon}
            </span>
            <span className="text-xs font-semibold leading-tight text-slate-700">{step.label}</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
              {i + 1}
            </span>
          </div>
        );
        return step.to ? (
          <Link key={i} to={step.to} className="contents">
            {inner}
          </Link>
        ) : (
          <button key={i} onClick={step.onClick} className="contents">
            {inner}
          </button>
        );
      })}
    </div>
  );
}
