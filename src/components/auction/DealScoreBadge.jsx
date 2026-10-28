import { useState } from 'react';
import { Sparkles, HelpCircle, X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { calculateDealScore } from '../../lib/dealScore';
import { cn } from '../../lib/utils';

export default function DealScoreBadge({ auction, comparables = [], compact = false }) {
  const [modalOpen, setModalOpen] = useState(false);
  const analysis = calculateDealScore(auction, comparables);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setModalOpen(true);
          }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-all hover:scale-105 shadow-2xs',
            analysis.color
          )}
          title="Click to view transparent Deal Score analysis"
        >
          <Sparkles className="h-3 w-3 shrink-0" />
          <span>Deal Score: {analysis.score}/100</span>
        </button>
      ) : (
        <div className={cn('rounded-2xl border p-4 shadow-xs', analysis.color)}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-2xs text-brand-600 font-bold">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">
                  CampusBid Deal Score
                </p>
                <h4 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                  <span>{analysis.score}/100</span>
                  <span className="text-xs font-medium text-surface-500">•</span>
                  <span className="text-xs font-semibold">{analysis.tier}</span>
                </h4>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 bg-white/80 hover:bg-white border border-surface-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
            >
              <Info className="h-3.5 w-3.5" />
              Breakdown
            </button>
          </div>

          <p className="text-xs text-surface-600 leading-relaxed">
            Calculated transparently using photo completeness, description detail, condition rating, and campus benchmarks.
          </p>
        </div>
      )}

      {/* Breakdown Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-surface-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-surface-100">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 font-extrabold text-xl shadow-2xs">
                  {analysis.score}
                </div>
                <div>
                  <h3 className="text-base font-bold text-surface-900">
                    Transparent Deal Score Breakdown
                  </h3>
                  <p className="text-xs text-surface-500">
                    Rating: <strong className="text-brand-600 font-semibold">{analysis.tier}</strong> ({analysis.score} / 100)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Factors list */}
            <div className="mt-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400">
                Score Contributions
              </h4>
              <div className="space-y-2">
                {analysis.factors.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-surface-50 border border-surface-150"
                  >
                    <div className="flex items-start gap-2.5">
                      {f.positive ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-surface-900">{f.label}</p>
                        <p className="text-[11px] text-surface-500 mt-0.5">{f.description}</p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-bold shrink-0',
                        f.positive ? 'text-emerald-600' : 'text-amber-600'
                      )}
                    >
                      {f.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Buyer checklist */}
            {analysis.missingChecks.length > 0 && (
              <div className="mt-5 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Recommended Buyer Checks
                </h4>
                <ul className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 space-y-1.5 text-xs text-amber-900">
                  {analysis.missingChecks.map((check, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-bold">•</span>
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Transparent Disclaimer */}
            <div className="mt-5 rounded-xl bg-surface-100 p-3 text-[11px] text-surface-500 flex items-start gap-2">
              <HelpCircle className="h-4 w-4 text-surface-400 shrink-0 mt-0.5" />
              <span>
                <strong>Disclaimer:</strong> The Deal Score is deterministic algorithmic guidance reflecting listing detail, verified student authenticity, and campus price benchmarks. It is not an appraisal or warranty. Always inspect items in person during campus handover.
              </span>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-full rounded-xl bg-surface-900 py-2.5 text-xs font-semibold text-white hover:bg-surface-800 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
