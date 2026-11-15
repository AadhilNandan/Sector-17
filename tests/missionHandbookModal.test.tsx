// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { TutorialProvider, useTutorial } from '../src/features/tutorial/context/TutorialContext';
import { MissionHandbookModal } from '../src/features/tutorial/components/handbook/MissionHandbookModal';

describe('Phase 9.1.3: Mission Handbook Modal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const TestWrapper: React.FC<{ initialArticleId?: string }> = ({ initialArticleId }) => {
    const { openHandbook } = useTutorial();
    return (
      <div>
        <button type="button" onClick={() => openHandbook(initialArticleId)}>
          Open Handbook
        </button>
        <MissionHandbookModal />
      </div>
    );
  };

  it('1. renders null when handbook is closed', () => {
    const { container } = render(
      <TutorialProvider autoLoadPersistence={false}>
        <MissionHandbookModal />
      </TutorialProvider>
    );

    expect(container.firstChild).toBeNull();
  });

  it('2. opens modal and displays chapter list and active article', () => {
    render(
      <TutorialProvider autoLoadPersistence={false}>
        <TestWrapper initialArticleId="art-01-mission-briefing" />
      </TutorialProvider>
    );

    fireEvent.click(screen.getByText('Open Handbook'));

    expect(screen.getByTestId('mission-handbook-modal')).toBeDefined();
    expect(screen.getByText(/MISSION HANDBOOK & AEROSPACE REFERENCE/i)).toBeDefined();
    expect(screen.getAllByText('Mission Briefing & The Europa Survey').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/VERIFIED PHYSICAL PRINCIPLE/i)).toBeDefined();
  });

  it('3. filters chapters dynamically using the search input', () => {
    render(
      <TutorialProvider autoLoadPersistence={false}>
        <TestWrapper />
      </TutorialProvider>
    );

    fireEvent.click(screen.getByText('Open Handbook'));

    const searchInput = screen.getByPlaceholderText(/Search 15 technical chapters/i);
    expect(searchInput).toBeDefined();

    // Search for 'Tsiolkovsky'
    fireEvent.change(searchInput, { target: { value: 'Tsiolkovsky' } });

    // Rocket equation chapter should appear in chapter sidebar
    expect(screen.getByText(/Propulsion & The Tsiolkovsky Rocket Equation/i)).toBeDefined();
    // Non-matching chapters should be excluded from list
    expect(screen.queryByText(/Ground Probe Deployment: PROMETHEUS-IV/i)).toBeNull();
  });

  it('4. displays empty state notice when search query yields no matches', () => {
    render(
      <TutorialProvider autoLoadPersistence={false}>
        <TestWrapper />
      </TutorialProvider>
    );

    fireEvent.click(screen.getByText('Open Handbook'));

    const searchInput = screen.getByPlaceholderText(/Search 15 technical chapters/i);
    fireEvent.change(searchInput, { target: { value: 'XYZ_NONEXISTENT_QUERY_12345' } });

    expect(screen.getByText(/No handbook chapters matching "XYZ_NONEXISTENT_QUERY_12345"/i)).toBeDefined();
  });

  it('5. selects and displays different chapter upon clicking sidebar item', () => {
    render(
      <TutorialProvider autoLoadPersistence={false}>
        <TestWrapper initialArticleId="art-01-mission-briefing" />
      </TutorialProvider>
    );

    fireEvent.click(screen.getByText('Open Handbook'));

    // Click on Chapter 4: Electrical Power Subsystem
    const ch4Btn = screen.getByText(/Electrical Power Subsystem \(EPS\)/i);
    fireEvent.click(ch4Btn);

    // Main reader should display Chapter 04 title and content
    expect(screen.getByText(/CHAPTER 04 · ENGINEERING/i)).toBeDefined();
    expect(screen.getByText(/Solar Radiant Flux Inverse-Square Law|Solar Flux Inverse-Square Law/i)).toBeDefined();
  });

  it('6. closes modal when Escape key is pressed', () => {
    render(
      <TutorialProvider autoLoadPersistence={false}>
        <TestWrapper />
      </TutorialProvider>
    );

    fireEvent.click(screen.getByText('Open Handbook'));
    expect(screen.getByTestId('mission-handbook-modal')).toBeDefined();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('mission-handbook-modal')).toBeNull();
  });

  it('7. renders official NASA citations and external link attributes', () => {
    render(
      <TutorialProvider autoLoadPersistence={false}>
        <TestWrapper initialArticleId="art-10-dsn-communications" />
      </TutorialProvider>
    );

    fireEvent.click(screen.getByText('Open Handbook'));

    expect(screen.getByText(/OFFICIAL NASA REFERENCE CITATION/i)).toBeDefined();
    expect(screen.getByText('NASA Deep Space Network (DSN) Now')).toBeDefined();
    expect(screen.getByText('NASA / Jet Propulsion Laboratory')).toBeDefined();

    const link = screen.getByRole('link', { name: /NASA Source Link/i });
    expect(link.getAttribute('href')).toBe('https://eyes.nasa.gov/dsn/dsn.html');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
