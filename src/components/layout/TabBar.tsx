import React from 'react';
import {
  FileSpreadsheet,
  UtensilsCrossed,
  Crown,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ActiveTab } from '../../types';
import { cn } from '../../utils/cn';

interface TabItem {
  id: ActiveTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAdmin?: boolean;
}

export const TabBar: React.FC = () => {
  const { activeTab, setActiveTab, isAdmin } = useApp();

  const allTabs: TabItem[] = [
    {
      id: 'reports',
      label: 'Financial Reports',
      shortLabel: 'Reports',
      icon: FileSpreadsheet,
    },
    {
      id: 'prasadam',
      label: 'Prasadam and Expenses',
      shortLabel: 'Prasadam and Expenses',
      icon: UtensilsCrossed,
    },
    {
      id: 'appearance_day',
      label: 'Prabhupada Appearance Day',
      shortLabel: 'Appearance Day',
      icon: Crown,
    },
    ...(isAdmin
      ? [
        {
          id: 'admin' as ActiveTab,
          label: 'Admin Control Center',
          shortLabel: 'Admin',
          icon: ShieldCheck,
        },
      ]
      : []),
  ];

  const handleTabClick = (tabId: ActiveTab) => {
    setActiveTab(tabId);
  };

  const isTabActive = (tabId: ActiveTab) => {
    if (activeTab === tabId) return true;
    if (tabId === 'appearance_day' && activeTab === 'janmashtami') return true;
    return false;
  };

  const gridColsClass = isAdmin ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <>
      {/* Desktop / Tablet Tab Bar */}
      <div className="hidden sm:block border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex space-x-1 sm:space-x-4">
            {allTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = isTabActive(tab.id);

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={cn(
                    'flex items-center gap-2 py-3.5 px-4 text-sm font-semibold border-b-2 transition-all relative',
                    isActive
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-amber-500' : 'text-slate-400')} />
                  <span>{tab.label}</span>
                  {tab.id === 'admin' && isAdmin && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Bottom Sticky Navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 safe-area-bottom pb-1">
        <div className={cn('grid h-16 items-center px-1', gridColsClass)}>
          {allTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = isTabActive(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  'flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative',
                  isActive
                    ? 'text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 font-medium hover:text-slate-800'
                )}
              >
                <div
                  className={cn(
                    'p-1 rounded-xl transition-all',
                    isActive ? 'bg-amber-500/15 scale-110' : ''
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                  {tab.shortLabel}
                </span>
                {tab.id === 'admin' && isAdmin && (
                  <span className="absolute top-2 right-4 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
