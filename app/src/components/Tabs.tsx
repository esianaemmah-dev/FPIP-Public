import { useNav } from '@/context/NavContext';

interface TabDef {
  id: string;
  label: string;
}

interface TabsProps {
  group: string;
  tabs: TabDef[];
  defaultTab?: string;
}

export function Tabs({ group, tabs, defaultTab }: TabsProps) {
  const { currentTab, openTab } = useNav();
  const active = currentTab(group) || defaultTab || tabs[0]?.id;
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab${t.id === active ? ' active' : ''}`}
          onClick={() => openTab(group, t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
