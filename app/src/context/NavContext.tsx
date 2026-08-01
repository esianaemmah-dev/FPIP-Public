// NavContext: cross-cutting UI navigation state — active tabs per group,
// sidebar collapse, scroll-to-card, and agent selection. All React state
// (Phase 1 requirement: no vanilla-DOM nav).

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';

interface NavContextValue {
  scrollToId: (id: string) => void;
  openTab: (group: string, tab: string) => void;
  currentTab: (group: string) => string | undefined;
  selectAgent: (agentId?: string) => void;
  selectedAgent: string;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<Record<string, string>>({});
  const [selectedAgent, setSelectedAgent] = useState('executive');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('flash-highlight');
    void el.offsetWidth; // reflow to restart the animation
    el.classList.add('flash-highlight');
  }, []);

  const openTab = useCallback(
    (group: string, tab: string) => setTabs((t) => ({ ...t, [group]: tab })),
    [],
  );

  const currentTab = useCallback((group: string) => tabs[group], [tabs]);

  /** Opens the unified FPIP Assistant (specialists route by intent under the hood). */
  const selectAgent = useCallback(
    (_agentId?: string) => {
      setSelectedAgent('assistant');
      navigate('/copilot');
    },
    [navigate],
  );

  const toggleSidebar = useCallback(() => setSidebarCollapsed((c) => !c), []);

  const value = useMemo<NavContextValue>(
    () => ({
      scrollToId,
      openTab,
      currentTab,
      selectAgent,
      selectedAgent,
      sidebarCollapsed,
      toggleSidebar,
      setSidebarCollapsed,
    }),
    [scrollToId, openTab, currentTab, selectAgent, selectedAgent, sidebarCollapsed, toggleSidebar],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within a NavProvider');
  return ctx;
}
