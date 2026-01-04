"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon as ArrowPathIconSolid } from "@heroicons/react/24/solid";

// Types
import type { Section, Message, ConfirmModalConfig } from "@/types/admin";

// Hooks
import { useSync } from "@/hooks/admin/use-sync";
import { useThumbnails } from "@/hooks/admin/use-thumbnails";
import { useTranslation } from "@/hooks/admin/use-translation";

// UI Components
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SuccessCheck } from "@/components/ui/success-check";

// Admin Components
import { NavTabs } from "@/components/admin/nav-tabs";
import { MessageToast } from "@/components/admin/message-toast";
import { SyncSection } from "@/components/admin/sync-section";
import { ThumbnailsSection } from "@/components/admin/thumbnails-section";
import { TranslationSection } from "@/components/admin/translation-section";
import { MaintenanceSection } from "@/components/admin/maintenance-section";
import { HelpSection } from "@/components/admin/help-section";

export default function AdminPage() {
  const router = useRouter();

  // UI state
  const [activeSection, setActiveSection] = useState<Section>("sync");
  const [message, setMessage] = useState<Message | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [customTags, setCustomTags] = useState("");

  // Ref for success animation timeout
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup success animation timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    confirmVariant: "danger",
    onConfirm: () => {},
  });

  // Maintenance state
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Success animation helper
  const triggerSuccessAnimation = useCallback(() => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    setShowSuccessAnimation(true);
    successTimeoutRef.current = setTimeout(() => setShowSuccessAnimation(false), 1500);
  }, []);

  // Feature hooks
  const sync = useSync(setMessage, triggerSuccessAnimation);
  const thumbnails = useThumbnails(setMessage, triggerSuccessAnimation);
  const translation = useTranslation(setMessage, triggerSuccessAnimation);

  // Handlers
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to logout",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleRecalculateStats = async () => {
    setIsRecalculating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/stats", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to recalculate stats");
      }

      triggerSuccessAnimation();
      setMessage({ type: "success", text: "Statistics recalculated!" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to recalculate stats",
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const openConfirmModal = (config: Omit<ConfirmModalConfig, "isOpen">) => {
    setConfirmModal({ ...config, isOpen: true });
  };

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Loading state
  if (sync.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ArrowPathIconSolid className="mx-auto h-8 w-8 animate-spin text-zinc-500" />
          <p className="mt-3 text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Render active section
  const renderSection = () => {
    switch (activeSection) {
      case "sync":
        return (
          <SyncSection
            syncStatus={sync.syncStatus}
            isSyncing={sync.isSyncing}
            customTags={customTags}
            onCustomTagsChange={setCustomTags}
            onFullSync={() => sync.startSync()}
            onCustomSync={() => {
              const tags = customTags
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t.length > 0);
              if (tags.length === 0) {
                setMessage({ type: "error", text: "Please enter at least one tag" });
                return;
              }
              sync.startSync(tags);
            }}
            onCancelSync={sync.cancelSync}
            formatDate={formatDate}
          />
        );
      case "thumbnails":
        return (
          <ThumbnailsSection
            thumbStats={thumbnails.thumbStats}
            isGenerating={thumbnails.isGenerating}
            onGenerate={thumbnails.generateThumbnails}
            onResetFailed={thumbnails.resetFailed}
            onClearAll={thumbnails.clearAll}
            openConfirmModal={openConfirmModal}
          />
        );
      case "translation":
        return (
          <TranslationSection
            settings={translation.settings}
            estimate={translation.estimate}
            bulkProgress={translation.bulkProgress}
            apiKey={translation.apiKey}
            model={translation.model}
            customModel={translation.customModel}
            targetLang={translation.targetLang}
            onApiKeyChange={translation.setApiKey}
            onModelChange={translation.setModel}
            onCustomModelChange={translation.setCustomModel}
            onTargetLangChange={translation.setTargetLang}
            isSaving={translation.isSaving}
            isTranslating={translation.isTranslating}
            onSave={translation.saveSettings}
            onStartBulk={translation.startBulkTranslation}
            onCancelBulk={translation.cancelBulkTranslation}
            openConfirmModal={openConfirmModal}
          />
        );
      case "maintenance":
        return (
          <MaintenanceSection
            isRecalculating={isRecalculating}
            isSyncing={sync.isSyncing}
            onRecalculateStats={handleRecalculateStats}
          />
        );
      case "help":
        return <HelpSection />;
    }
  };

  return (
    <>
      <SuccessCheck show={showSuccessAnimation} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.confirmVariant}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin</h1>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
            {isLoggingOut ? "..." : "Sign Out"}
          </button>
        </div>

        {/* Tab Navigation */}
        <NavTabs activeSection={activeSection} onSectionChange={setActiveSection} />

        {/* Message Toast */}
        <MessageToast message={message} onDismiss={() => setMessage(null)} />

        {/* Content */}
        {renderSection()}
      </div>
    </>
  );
}
