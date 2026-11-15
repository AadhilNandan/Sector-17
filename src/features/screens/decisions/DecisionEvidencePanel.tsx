/**
 * SECTOR 17 — Decision Evidence Inspection Panel
 * Audits supporting scientific and engineering evidence for candidate decisions.
 * Strictly distinguishes VERIFIED physical discoveries from FICTIONAL Relic-Omega scenario constructs.
 */

import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Info,
  Search,
} from 'lucide-react';
import { GamePanel } from '../../../components/ui/GamePanel';
import { formatMET } from '../../../simulation/operations/missionClock';
import type { DecisionEvidenceItem, EvidenceProvenance } from '../../../simulation/missionDecision/types';

interface DecisionEvidencePanelProps {
  evidenceList: readonly DecisionEvidenceItem[];
  selectedEvidenceIds?: readonly string[];
  title?: string;
}

export const DecisionEvidencePanel: React.FC<DecisionEvidencePanelProps> = ({
  evidenceList,
  selectedEvidenceIds,
  title = 'Supporting Evidence Inspection',
}) => {
  const [filterProvenance, setFilterProvenance] = useState<EvidenceProvenance | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Distinguish an empty selected evidence array (zero supporting evidence) from absent filter
  const relevantList = selectedEvidenceIds !== undefined
    ? evidenceList.filter((e) => selectedEvidenceIds.includes(e.id))
    : evidenceList;

  const filtered = relevantList.filter((e) => {
    if (filterProvenance !== 'ALL' && e.provenance !== filterProvenance) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        e.id.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.sourceType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getProvenanceBadge = (prov: EvidenceProvenance, isFictional: boolean) => {
    if (isFictional || prov === 'FICTIONAL') {
      return {
        label: 'FICTIONAL CONSTRUCT',
        pill: 'bg-[#A78BFA]/20 text-[#A78BFA] border-[#A78BFA]/40',
        icon: <Sparkles size={11} />,
      };
    }
    switch (prov) {
      case 'VERIFIED':
        return {
          label: 'VERIFIED SIMULATION',
          pill: 'bg-[#31C48D]/20 text-[#31C48D] border-[#31C48D]/40',
          icon: <CheckCircle2 size={11} />,
        };
      case 'SIMPLIFIED':
        return {
          label: 'SIMPLIFIED MODEL',
          pill: 'bg-[#35C6F4]/20 text-[#35C6F4] border-[#35C6F4]/40',
          icon: <Info size={11} />,
        };
      case 'UNVERIFIED':
      default:
        return {
          label: 'UNVERIFIED',
          pill: 'bg-[#F5A623]/20 text-[#F5A623] border-[#F5A623]/40',
          icon: <HelpCircle size={11} />,
        };
    }
  };

  return (
    <GamePanel
      title={title}
      subtitle="Multi-Source Avionics & Science Evidence Repository"
      className="border-white/10"
      headerAction={
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span className="text-[#A5B1C2]">Filter:</span>
          {(['ALL', 'VERIFIED', 'SIMPLIFIED', 'FICTIONAL'] as const).map((prov) => (
            <button
              key={prov}
              type="button"
              onClick={() => setFilterProvenance(prov)}
              className={`px-1.5 py-0.5 rounded uppercase font-semibold transition-all cursor-pointer ${
                filterProvenance === prov
                  ? 'bg-white/20 text-white'
                  : 'text-[#A5B1C2] hover:text-white'
              }`}
            >
              {prov}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-3 font-mono text-xs">
        {/* Search Bar */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-[#A5B1C2]" />
          <input
            type="text"
            placeholder="Search evidence by ID, summary, or source..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-[#F1F5FA] placeholder-[#6D7A8D] focus:outline-none focus:border-[#35C6F4]/50"
          />
        </div>

        {/* Evidence Items Scroll Container */}
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const provBadge = getProvenanceBadge(item.provenance, item.isFictionalConstruct);

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all ${
                    item.isFictionalConstruct
                      ? 'bg-[#A78BFA]/[0.04] border-[#A78BFA]/20 hover:border-[#A78BFA]/40'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/15'
                  }`}
                >
                  {/* Top Metadata Line */}
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#F1F5FA]">{item.id}</span>
                      <span className="px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-[9px] text-[#A5B1C2] uppercase">
                        {item.sourceType}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${provBadge.pill}`}>
                        {provBadge.icon}
                        <span>{provBadge.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Summary Prose */}
                  <p className="text-[11px] text-[#CBD5E1] leading-relaxed mb-2 font-sans">
                    {item.summary}
                  </p>

                  {/* Fictional Callout Warning */}
                  {item.isFictionalConstruct && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[#A78BFA]/15 border border-[#A78BFA]/30 text-[#A78BFA] text-[10px] mb-2 font-sans">
                      <AlertTriangle size={12} className="shrink-0 text-[#A78BFA]" />
                      <span>
                        <strong>FICTIONAL SCENARIO CONSTRUCT:</strong> This evidence originates from a narrative relic scenario. It is strictly disallowed from satisfying physical science objectives.
                      </span>
                    </div>
                  )}

                  {/* Quantitative Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1.5 border-t border-white/5 text-[10px] text-[#A5B1C2]">
                    <div>
                      <span>Acquired: </span>
                      <span className="text-[#35C6F4] font-medium">
                        {typeof item.timestampMET === 'number' && Number.isFinite(item.timestampMET) && item.timestampMET >= 0
                          ? formatMET(item.timestampMET)
                          : 'T+ 000d 00:00:00'}
                      </span>
                    </div>

                    {item.ingestionMET !== undefined && (
                      <div>
                        <span>Ingested: </span>
                        <span className="text-[#35C6F4] font-medium">
                          {typeof item.ingestionMET === 'number' && Number.isFinite(item.ingestionMET) && item.ingestionMET >= 0
                            ? formatMET(item.ingestionMET)
                            : 'T+ 000d 00:00:00'}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <span>Confidence: </span>
                      <span className="font-bold text-[#31C48D]">{(item.confidenceScore * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs font-mono text-[#6D7A8D] bg-white/[0.02] rounded-xl border border-white/5">
              <FileText size={20} className="mx-auto mb-2 opacity-50" />
              <div>
                {selectedEvidenceIds && selectedEvidenceIds.length === 0
                  ? 'NO DIRECT EVIDENCE REQUIRED FOR THIS DECISION'
                  : 'NO MATCHING EVIDENCE FOUND'}
              </div>
              <div className="text-[10px] mt-1">
                {selectedEvidenceIds && selectedEvidenceIds.length === 0
                  ? 'This operational response does not require supporting science products or anomaly detections.'
                  : 'Advance simulation time or ingest science data products to index new evidence.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </GamePanel>
  );
};
