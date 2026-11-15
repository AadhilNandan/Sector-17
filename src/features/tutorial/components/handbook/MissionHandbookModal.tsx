/**
 * SECTOR 17 — Mission Handbook Modal Component
 * Phase 9.1.3 Production Implementation
 *
 * Full-screen aerospace technical reference manual providing searchable, categorized
 * chapters with equation breakdowns, scientific provenance labels, and NASA/JPL citations.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useTutorial } from '../../context/TutorialContext';
import { HANDBOOK_ARTICLES } from '../../data/handbookArticles';
import type { HandbookArticle } from '../../types';
import {
  BookOpen,
  Search,
  X,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Sparkles,
} from 'lucide-react';

export const MissionHandbookModal: React.FC = () => {
  const { state, closeHandbook } = useTutorial();
  const [selectedArticleId, setSelectedArticleId] = useState<string>(
    state.activeHandbookArticleId || HANDBOOK_ARTICLES[0].id
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Update selected article if opened with a specific article ID
  useEffect(() => {
    if (state.activeHandbookArticleId) {
      setSelectedArticleId(state.activeHandbookArticleId);
    }
  }, [state.activeHandbookArticleId]);

  // Escape key handler to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.handbookOpen) {
        closeHandbook();
      }
    };

    if (state.handbookOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.handbookOpen, closeHandbook]);

  // Filter articles by title, content, or key terms
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return HANDBOOK_ARTICLES;
    const q = searchQuery.toLowerCase();
    return HANDBOOK_ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.keyTerms.some((t) => t.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Current active article
  const currentArticle: HandbookArticle = useMemo(() => {
    const found = HANDBOOK_ARTICLES.find((a) => a.id === selectedArticleId);
    return found || filteredArticles[0] || HANDBOOK_ARTICLES[0];
  }, [selectedArticleId, filteredArticles]);

  if (!state.handbookOpen) {
    return null;
  }

  // Provenance Badge Helper
  const renderProvenanceBadge = (provenance: HandbookArticle['provenance']) => {
    switch (provenance) {
      case 'VERIFIED_PHYSICS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#0A1A12] text-[#6FAE7C] border border-[#6FAE7C]/40">
            <ShieldCheck size={11} />
            VERIFIED PHYSICAL PRINCIPLE
          </span>
        );
      case 'SIMPLIFIED_MODEL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#1A180A] text-[#E0A43A] border border-[#E0A43A]/40">
            <Cpu size={11} />
            SIMPLIFIED ENGINEERING MODEL
          </span>
        );
      case 'GAMEPLAY_ABSTRACTION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#18111A] text-[#B5733C] border border-[#B5733C]/40">
            <Sparkles size={11} />
            MISSION / GAMEPLAY ABSTRACTION
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mission Handbook"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#04060A]/85 backdrop-blur-md select-none font-sans text-[#E6E2D6]"
      data-testid="mission-handbook-modal"
    >
      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-5xl h-[90vh] bg-[#0D1116] border border-[#2B3642] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="px-5 py-3.5 bg-[#151B22] border-b border-[#2B3642] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <BookOpen size={18} className="text-[#7FB7D4]" />
            <h1 className="text-base font-semibold tracking-wide text-[#E6E2D6] font-mono">
              EXPEDITION-V // MISSION HANDBOOK & AEROSPACE REFERENCE
            </h1>
          </div>
          <button
            type="button"
            onClick={closeHandbook}
            aria-label="Close Handbook"
            className="p-1.5 rounded bg-[#1C242D] hover:bg-[#2B3642] text-[#A9B0B5] hover:text-[#E6E2D6] transition-colors cursor-pointer border border-[#2B3642]"
          >
            <X size={16} />
          </button>
        </header>

        {/* Search Bar */}
        <div className="px-5 py-2.5 bg-[#0D1116] border-b border-[#2B3642]/60 flex items-center gap-2 shrink-0">
          <Search size={14} className="text-[#6B757D]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 15 technical chapters, equations, or NASA citations..."
            className="w-full bg-transparent text-xs font-mono text-[#E6E2D6] placeholder-[#6B757D] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[#6B757D] hover:text-[#E6E2D6] text-xs font-mono"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Main Two-Column Layout */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Column: Chapters Navigation (35%) */}
          <aside
            aria-label="Chapter List"
            className="w-full md:w-80 h-48 md:h-full border-r border-[#2B3642] bg-[#07090C]/60 overflow-y-auto shrink-0 flex flex-col p-2 gap-1"
          >
            {filteredArticles.length === 0 ? (
              <div className="p-4 text-xs font-mono text-[#6B757D] text-center">
                No handbook chapters matching "{searchQuery}".
              </div>
            ) : (
              filteredArticles.map((art) => {
                const isSelected = art.id === currentArticle.id;
                return (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => setSelectedArticleId(art.id)}
                    className={`w-full p-2.5 rounded text-left transition-all cursor-pointer flex flex-col gap-1 border ${
                      isSelected
                        ? 'bg-[#1C242D] border-[#7FB7D4] text-[#E6E2D6]'
                        : 'bg-transparent hover:bg-[#151B22]/50 border-transparent text-[#A9B0B5]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-[#7FB7D4] font-semibold">
                        CH {String(art.chapterNumber).padStart(2, '0')} // {art.category}
                      </span>
                    </div>
                    <span className="text-xs font-medium line-clamp-1">
                      {art.title}
                    </span>
                  </button>
                );
              })
            )}
          </aside>

          {/* Right Column: Active Article Content (~65%) */}
          <main
            aria-label="Article Reader"
            className="flex-1 h-full overflow-y-auto p-5 sm:p-7 flex flex-col gap-5 bg-[#0D1116]"
          >
            {/* Article Heading */}
            <div className="flex flex-col gap-2 pb-4 border-b border-[#2B3642]/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#7FB7D4] tracking-wider uppercase">
                  CHAPTER {String(currentArticle.chapterNumber).padStart(2, '0')} · {currentArticle.category}
                </span>
                {renderProvenanceBadge(currentArticle.provenance)}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#E6E2D6]">
                {currentArticle.title}
              </h2>
              <p className="text-xs text-[#A9B0B5] font-mono leading-relaxed bg-[#151B22] p-3 rounded border border-[#2B3642]/60">
                {currentArticle.summary}
              </p>
            </div>

            {/* Main Text Content */}
            <div className="prose prose-invert max-w-none text-xs sm:text-sm text-[#E6E2D6]/90 leading-relaxed space-y-4">
              {currentArticle.content.split('\n\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>

            {/* Technical Equations Box (if defined) */}
            {currentArticle.equations && currentArticle.equations.length > 0 && (
              <div className="flex flex-col gap-3 p-4 rounded bg-[#07090C] border border-[#7FB7D4]/30">
                <h3 className="text-xs font-mono font-bold text-[#7FB7D4] tracking-wider uppercase">
                  TECHNICAL EQUATIONS & DERIVATIONS
                </h3>
                {currentArticle.equations.map((eq, idx) => (
                  <div key={idx} className="flex flex-col gap-2 font-mono text-xs">
                    <span className="text-[#A9B0B5] font-semibold">{eq.name}:</span>
                    <div className="p-2.5 rounded bg-[#151B22] text-[#E6E2D6] font-bold text-sm tracking-wider overflow-x-auto border border-[#2B3642]">
                      <code>{eq.formula}</code>
                    </div>
                    <p className="text-[11px] text-[#A9B0B5]">{eq.explanation}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] text-[#A9B0B5] pt-1">
                      {Object.entries(eq.variables).map(([key, desc]) => (
                        <div key={key} className="flex gap-1.5">
                          <strong className="text-[#7FB7D4] shrink-0">{key}:</strong>
                          <span>{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Practical Interpretation in SECTOR 17 */}
            <div className="flex flex-col gap-1.5 p-3.5 rounded bg-[#151B22]/60 border border-[#2B3642]">
              <span className="text-[10px] font-mono font-bold text-[#8FB8CC] uppercase tracking-wider">
                PRACTICAL INTERPRETATION IN SECTOR 17
              </span>
              <p className="text-xs text-[#A9B0B5] leading-relaxed">
                {currentArticle.practicalInterpretation}
              </p>
            </div>

            {/* Key Terms */}
            {currentArticle.keyTerms && currentArticle.keyTerms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-mono text-[#6B757D] uppercase mr-1">KEY TERMS:</span>
                {currentArticle.keyTerms.map((term) => (
                  <span
                    key={term}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1C242D] text-[#A9B0B5] border border-[#2B3642]"
                  >
                    {term}
                  </span>
                ))}
              </div>
            )}

            {/* NASA Reference Citation */}
            {currentArticle.nasaReference && (
              <div className="mt-2 p-3.5 rounded bg-[#07090C] border border-[#2B3642] flex flex-col gap-1.5 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#7FB7D4] uppercase tracking-wider font-bold">
                    OFFICIAL NASA REFERENCE CITATION
                  </span>
                  {currentArticle.nasaReference.url && (
                    <a
                      href={currentArticle.nasaReference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#7FB7D4] hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <span>NASA Source Link</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <span className="text-[#E6E2D6] font-semibold">
                  {currentArticle.nasaReference.title}
                </span>
                <span className="text-[#A9B0B5] text-[11px]">
                  {currentArticle.nasaReference.organization}
                </span>
                {currentArticle.nasaReference.description && (
                  <p className="text-[#6B757D] text-[10px] pt-1">
                    {currentArticle.nasaReference.description}
                  </p>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
