import { Card } from "@/components/ui/card";
import { InfoBox } from "@/components/ui/info-box";

export function HelpSection() {
  return (
    <div className="space-y-5">
      {/* Quick Start */}
      <Card>
        <h3 className="mb-4 font-medium text-zinc-200">Quick Start</h3>
        <div className="space-y-4">
          {[
            {
              step: 1,
              title: "Configure Hydrus",
              desc: "In Hydrus, go to Services → Manage Services → Client API. Enable it and create an access key with file and tag permissions.",
            },
            {
              step: 2,
              title: "Set environment variables",
              desc: "Add HYDRUS_API_URL, HYDRUS_API_KEY, and HYDRUS_FILES_PATH to your .env file.",
            },
            {
              step: 3,
              title: "Run your first sync",
              desc: "Click Start Sync to import metadata. Only file info is stored — actual files stay in Hydrus.",
            },
            {
              step: 4,
              title: "Generate thumbnails",
              desc: "Pre-generate thumbnails for faster browsing, or let them create automatically as you browse.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-3">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-400">
                {step}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">{title}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Environment Variables */}
      <Card>
        <h3 className="mb-3 font-medium text-zinc-200">Environment Variables</h3>

        <p className="mb-2 text-xs font-medium text-zinc-400">Required</p>
        <div className="mb-4 space-y-2 text-sm">
          {[
            { name: "DATABASE_URL", desc: "PostgreSQL connection string" },
            { name: "ADMIN_PASSWORD", desc: "Password for admin login" },
            { name: "HYDRUS_API_URL", desc: "Hydrus Client API endpoint (default port: 45869)" },
            { name: "HYDRUS_API_KEY", desc: "Access key from Hydrus Client API settings" },
            { name: "HYDRUS_FILES_PATH", desc: "Path to Hydrus client_files directory" },
          ].map(({ name, desc }) => (
            <div key={name} className="flex items-start gap-3 rounded-lg bg-zinc-700/30 p-2.5">
              <code className="shrink-0 text-xs font-medium text-blue-400">{name}</code>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>

        <p className="mb-2 text-xs font-medium text-zinc-400">Optional</p>
        <div className="space-y-2 text-sm">
          {[
            { name: "LOG_QUERIES", desc: "Log SQL queries with timing (true/false)" },
            { name: "LOG_LEVEL", desc: "Logging verbosity (debug, info, warn, error)" },
            { name: "TAG_BLACKLIST", desc: "Comma-separated tags to hide from display" },
            { name: "OPENROUTER_API_KEY", desc: "API key for translation (can also set in UI)" },
          ].map(({ name, desc }) => (
            <div key={name} className="flex items-start gap-3 rounded-lg bg-zinc-700/30 p-2.5">
              <code className="shrink-0 text-xs font-medium text-zinc-400">{name}</code>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Tag Syntax */}
      <Card>
        <h3 className="mb-3 font-medium text-zinc-200">Tag Syntax</h3>
        <p className="mb-3 text-xs text-zinc-400">
          Use Hydrus tag format when filtering syncs. Tags are case-insensitive.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { tag: "creator:artist name", desc: "Creator/artist namespace" },
            { tag: "system:inbox", desc: "Files in inbox" },
            { tag: "system:archive", desc: "Archived files" },
            { tag: "system:limit=1000", desc: "Limit to 1000 files" },
            { tag: "system:filetype=image/*", desc: "Filter by file type" },
          ].map(({ tag, desc }) => (
            <div key={tag} className="flex items-start gap-2 rounded bg-zinc-700/30 p-2">
              <code className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">{tag}</code>
              <span className="text-xs text-zinc-500">{desc}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <h3 className="mb-3 font-medium text-zinc-200">Troubleshooting</h3>
        <div className="space-y-4">
          {[
            {
              q: "Sync fails with connection error",
              a: "Make sure Hydrus is running and the Client API is enabled. Check that HYDRUS_API_URL is correct and the port matches.",
            },
            {
              q: "Images not loading",
              a: "Verify HYDRUS_FILES_PATH points to your Hydrus client_files directory. The path must be accessible from the server at all times!",
            },
            {
              q: "Thumbnails failing to generate",
              a: "Some file types (like PSD or rare formats) may not be supported. Check the Thumbnails tab for failed/unsupported counts.",
            },
            {
              q: "Tag counts seem wrong",
              a: "Run Recalculate Statistics in the Maintenance tab to rebuild all tag counts and homepage stats.",
            },
            {
              q: "Sync is slow",
              a: "Large libraries take time. Sync processes files in batches. Interrupting a partial sync will not interfere with operation, it can simply be restarted later. You can use tag filters to sync specific subsets.",
            },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="text-sm font-medium text-zinc-300">{q}</p>
              <p className="mt-1 text-xs text-zinc-500">{a}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Tips */}
      <InfoBox variant="note" title="Need more help?">
        Check the project README for detailed setup instructions, or open an issue on GitHub if you encounter problems.
      </InfoBox>
    </div>
  );
}
