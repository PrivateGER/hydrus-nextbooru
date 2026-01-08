"use client";

import {
  CloudArrowDownIcon,
  LanguageIcon,
  PhotoIcon,
  QuestionMarkCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import type { Section, NavItem } from "@/types/admin";

export const NAV_ITEMS: NavItem[] = [
  { id: "sync", label: "Sync", icon: CloudArrowDownIcon, description: "Import files from Hydrus" },
  { id: "thumbnails", label: "Thumbnails", icon: PhotoIcon, description: "Generate preview images" },
  { id: "translation", label: "Translation", icon: LanguageIcon, description: "Configure AI translation" },
  { id: "maintenance", label: "Maintenance", icon: WrenchScrewdriverIcon, description: "Database utilities" },
  { id: "help", label: "Help", icon: QuestionMarkCircleIcon, description: "Documentation & tips" },
];

export interface NavTabsProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

export function NavTabs({ activeSection, onSectionChange }: NavTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-200/50 dark:bg-zinc-800/50 p-1">
      {NAV_ITEMS.map((item) => {
        const isActive = activeSection === item.id;
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
          >
            <item.icon className={`h-4 w-4 ${isActive ? "text-blue-600 dark:text-blue-400" : ""}`} />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
