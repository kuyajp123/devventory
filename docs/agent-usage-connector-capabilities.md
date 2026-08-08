# Agent Usage connector capability audit

Audited: 2026-08-08

Phase 8 ships complete manual tracking for every supported platform. No
automatic connector is enabled by this audit. A provider is marked **Partial**
only when an official machine-readable interface exists for a limited account
class but cannot safely or honestly support Devventory's general local-account
workflow.

## Decision matrix

| Provider | Classification | Account detection / identifier | Usage / reset sync | Multiple windows | Machine-readable, stable interface | Runtime and credential requirements | Free / paid limitations | Phase 8 decision |
|---|---|---|---|---|---|---|---|---|
| Codex | Manual | No supported local account-export command was found. Installed CLI `0.146.0` exposes login management, while its app server is explicitly experimental. | Official guidance exposes usage in the Codex Settings usage panel, not a supported quota export API or stable CLI command. | The product can show more than one limit, but no verified export contract was found. | No | Codex app/CLI; an automatic approach would otherwise need provider session data that Devventory must not read. | Usage and credits vary by ChatGPT plan/workspace role. | Manual fallback only. Do not inspect Codex auth/config storage or the experimental app-server protocol. |
| Claude Code | Manual | Installed CLI `2.1.223`; official CLI reference has no supported local identity/quota export command. | No stable structured quota/reset export was verified. Interactive or decorative terminal output is not a connector contract. | Not verified | No | Claude Code app/CLI; no provider credentials are requested. | Subscription and API-key behavior differ. | Manual fallback only. |
| Devin | Partial | Enterprise APIs identify consumption by organization/user, not a general local self-serve account detector. | Official daily-consumption API provides enterprise consumption but does not provide the complete self-serve daily/weekly remaining-and-reset model needed here. | Partial | Yes, enterprise API | Network plus an Enterprise Admin personal API key. | Enterprise-admin only for the documented endpoint; self-serve plans have different quota rules. | Not implemented. Devventory has no approved secure provider-credential lifecycle, and the API does not cover the general account workflow. |
| GitHub Copilot | Partial | GitHub APIs can identify users in authorized organization/enterprise reports; this is not automatic local account detection. | Official billing and Copilot usage APIs expose AI-credit/usage data, but scopes and semantics differ for personal billing versus organization/enterprise licenses and do not provide a universal reset-window contract. | Partial | Yes | Network plus a GitHub token with the required billing/metrics permissions. | Personal billing endpoints exclude org-managed licenses; metrics APIs require organization/enterprise roles. | Not implemented. Authentication, scope selection, and quota mapping need a separate secure connector design. |
| Cursor | Partial | No supported local CLI identity export was verified. | Official Admin API exposes team usage/spend events, not a general individual remaining/reset API. | No verified reset windows | Yes, for teams | Network plus a Cursor team Admin API key. | Team-admin only; individual usage remains dashboard/editor based. | Not implemented. It would exclude the common individual/free case and require credential storage. |
| Kiro | Manual | Installed desktop command `0.12.333` exposes editor-launch options, not a structured account export. | Official Kiro CLI documents interactive `/usage` and the IDE subscription dashboard, not a stable non-interactive structured quota command. | Not verified | No | Kiro IDE/interactive CLI. | Credit balances and add-ons vary by plan; free plans remain supported manually. | Manual fallback only. Do not parse interactive terminal panels or local auth storage. |
| Antigravity | Manual | Google documents the IDE and sign-in workflow, but no stable local account-export contract was found; no CLI was installed for a read-only check. | No supported structured usage/reset interface was verified in the official product documentation. | Not verified | No | Antigravity IDE and a Google account; Devventory does not inspect its private application state. | Product limits can vary independently of Gemini API quotas. | Manual fallback only. |
| Gemini CLI | Manual | Gemini CLI was not installed. Official command documentation exposes interactive session commands, not an account export suitable for Devventory. | `/stats model` can display session/model quota information interactively, but no stable non-interactive structured remaining/reset export was verified. | Partial display only | No supported connector contract | Interactive CLI; Devventory must not reuse Gemini OAuth or API keys. | OAuth, API-key, Vertex, and organization quota semantics differ. | Manual fallback only. Do not harvest Gemini CLI authentication or parse decorative `/stats` output. |
| Windsurf | Partial | No installed CLI or supported local account export was verified. | Official enterprise usage APIs expose billing/credit data using service keys; general individual reset synchronization was not verified. | Partial | Yes, enterprise API | Network plus a service key with billing-read permissions. | Enterprise-oriented API; individual plans use the product usage UI. | Not implemented. The interface does not safely cover the general local account workflow. |
| Other / Custom | Manual | User-supplied platform and full identifier. | User-supplied usage snapshot and reset. | Yes | Not applicable | None | Works offline on any plan. | Complete manual support. |

## Capability flags for this release

All built-in providers expose the same honest Phase 8 capability set:

```text
accountDetection: false
usageSync: false
resetSync: false
multipleQuotaWindows: true (manual)
```

No provider SDK, HTTP client, shell/process plugin, browser automation, or
credential store was added. The UI therefore does not offer an automatic
tracking mode or a misleading Synchronize action.

## Official sources

- Codex: [Codex rate card and usage-panel guidance](https://help.openai.com/en/articles/20001106-codex-rate-card), [using Codex with a ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
- Claude Code: [official CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage)
- Devin: [self-serve quota model](https://docs.devin.ai/admin/billing/self-serve), [enterprise daily-consumption API](https://docs.devin.ai/api-reference/v2/consumption/daily-consumption)
- GitHub Copilot: [billing usage API](https://docs.github.com/en/rest/billing/usage), [Copilot usage-metrics scope and permissions](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics)
- Cursor: [Admin API](https://docs.cursor.com/en/account/teams/admin-api), [individual and team usage model](https://docs.cursor.com/account/pricing)
- Kiro: [CLI terminal UI and `/usage`](https://kiro.dev/docs/cli/terminal-ui/), [billing and credit resets](https://kiro.dev/docs/billing/)
- Antigravity: [official IDE overview](https://antigravity.google/docs/ide-overview?app=antigravity), [official Google Codelab and sign-in requirements](https://codelabs.developers.google.com/getting-started-agy-ide)
- Gemini CLI: [official command reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md), [official FAQ and quota/auth distinctions](https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/faq.md)
- Windsurf: [plans and credit usage](https://docs.windsurf.com/windsurf/accounts/usage), [enterprise usage API](https://docs.windsurf.com/plugins/accounts/api-reference/get-usage-config)

The installed CLI check only ran `--version` and public `--help` output. It did
not read provider configuration, authentication files, environment variables,
cookies, tokens, or account data.
