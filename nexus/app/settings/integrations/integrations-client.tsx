"use client";

import { useState } from "react";
import { Github, Slack, ExternalLink, CheckCircle2, Circle, Loader2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Badge }  from "@/components/ui/badge";
import { cn }     from "@/lib/utils";

interface Props { orgId: string }

interface IntegrationState {
  github: { enabled: boolean; webhookSecret: string; copied: boolean };
  slack:  { enabled: boolean; webhookUrl: string; botToken: string };
}

const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

export function IntegrationsClient({ orgId }: Props) {
  const [state, setState] = useState<IntegrationState>({
    github: { enabled: false, webhookSecret: "", copied: false },
    slack:  { enabled: false, webhookUrl: "", botToken: "" },
  });
  const [saving, setSaving] = useState<"github" | "slack" | null>(null);
  const [saved,  setSaved]  = useState<"github" | "slack" | null>(null);

  const githubWebhookUrl = `${APP_URL}/api/integrations/github`;
  const slashCommandUrl  = `${APP_URL}/api/integrations/slack`;

  async function handleSave(integration: "github" | "slack") {
    setSaving(integration);
    // TODO: persist to org settings via a server action
    await new Promise((r) => setTimeout(r, 600)); // simulate save
    setSaving(null);
    setSaved(integration);
    setTimeout(() => setSaved(null), 3000);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setState((prev) => ({ ...prev, github: { ...prev.github, copied: true } }));
      setTimeout(() => setState((prev) => ({ ...prev, github: { ...prev.github, copied: false } })), 2000);
    });
  }

  return (
    <div className="space-y-6" aria-label="Integrations settings">

      {/* ── GitHub ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Github className="h-5 w-5" aria-hidden="true" />
              GitHub
            </CardTitle>
            <Badge
              variant={state.github.enabled ? "default" : "secondary"}
              className={cn(state.github.enabled && "bg-emerald-500")}
            >
              {state.github.enabled ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" />Connected</>
              ) : (
                <><Circle className="h-3 w-3 mr-1" />Not connected</>
              )}
            </Badge>
          </div>
          <CardDescription>
            Receive GitHub webhook events and link commits/PRs to Nexus cards using{" "}
            <code className="text-xs bg-muted px-1 rounded">nexus-&lt;card-id&gt;</code> in commit messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input value={githubWebhookUrl} readOnly className="font-mono text-xs" />
              <Button
                variant="outline" size="sm"
                onClick={() => copyToClipboard(githubWebhookUrl)}
                aria-label="Copy webhook URL"
              >
                {state.github.copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this URL in your GitHub repo → Settings → Webhooks. Select{" "}
              <em>push</em> and <em>pull_request</em> events.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="github-secret">Webhook Secret</Label>
            <Input
              id="github-secret"
              type="password"
              placeholder="whsec_…"
              value={state.github.webhookSecret}
              onChange={(e) => setState((p) => ({ ...p, github: { ...p.github, webhookSecret: e.target.value } }))}
            />
            <p className="text-xs text-muted-foreground">
              Must match the <code className="bg-muted px-1 rounded text-xs">GITHUB_WEBHOOK_SECRET</code> env var on your server.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              disabled={saving === "github"}
              onClick={() => {
                setState((p) => ({ ...p, github: { ...p.github, enabled: true } }));
                handleSave("github");
              }}
            >
              {saving === "github" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {state.github.enabled ? "Update" : "Enable"} GitHub
            </Button>
            {saved === "github" && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Saved!</span>}
            <a
              href="https://docs.github.com/en/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto"
            >
              GitHub Webhook Docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ── Slack ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Slack className="h-5 w-5" aria-hidden="true" />
              Slack
            </CardTitle>
            <Badge
              variant={state.slack.enabled ? "default" : "secondary"}
              className={cn(state.slack.enabled && "bg-emerald-500")}
            >
              {state.slack.enabled ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" />Connected</>
              ) : (
                <><Circle className="h-3 w-3 mr-1" />Not connected</>
              )}
            </Badge>
          </div>
          <CardDescription>
            Use <code className="text-xs bg-muted px-1 rounded">/nexus &lt;query&gt;</code> in Slack to search
            cards. Configure this as a Slack slash command pointing to the URL below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Slash Command Request URL</Label>
            <div className="flex gap-2">
              <Input value={slashCommandUrl} readOnly className="font-mono text-xs" />
              <Button
                variant="outline" size="sm"
                onClick={() => navigator.clipboard.writeText(slashCommandUrl)}
                aria-label="Copy slash command URL"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Create a Slack App → Slash Commands → <code className="bg-muted px-1 rounded text-xs">/nexus</code> → set this as the Request URL.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slack-bot-token">Bot Token (optional)</Label>
            <Input
              id="slack-bot-token"
              type="password"
              placeholder="xoxb-…"
              value={state.slack.botToken}
              onChange={(e) => setState((p) => ({ ...p, slack: { ...p.slack, botToken: e.target.value } }))}
            />
            <p className="text-xs text-muted-foreground">
              Stored as <code className="bg-muted px-1 rounded text-xs">SLACK_BOT_TOKEN</code>. Required for
              proactive notifications.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              disabled={saving === "slack"}
              onClick={() => {
                setState((p) => ({ ...p, slack: { ...p.slack, enabled: true } }));
                handleSave("slack");
              }}
            >
              {saving === "slack" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {state.slack.enabled ? "Update" : "Enable"} Slack
            </Button>
            {saved === "slack" && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Saved!</span>}
            <a
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto"
            >
              Slack App Console <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
