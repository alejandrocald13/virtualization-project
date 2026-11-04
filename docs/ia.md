# Use of AI

AI was used in this project, as allowed by the assignment. This file declares the tool and its purpose.

## Tool

| Tool | Provider | Used by |
|---|---|---|
| Claude Code (CLI, Claude Opus models) | Anthropic | Group 6 |

## Purpose

| Area | What the AI did |
|---|---|
| Planning | Helped break the assignment into phases and requirements, and compare design options (network, storage, registry, secrets) |
| Code and manifests | Drafted and reviewed the API, the web client, Dockerfiles, Kubernetes manifests, Helm values, Argo CD Applications and GitHub Actions workflows |
| Troubleshooting | Helped diagnose problems (memory exhaustion on the first server, `runAsNonRoot` errors, Grafana startup on NFS, dashboard queries) with read-only commands |
| Documentation | Drafted documentation such as `docs/access.md`, later reviewed by the group |

## Rules We Followed

- **Decisions were made by the group.** The AI proposed options; the group chose them.
- **Every commit was reviewed and pushed by a group member.** The AI did not commit or push.
- **Changes to the Proxmox host and the cluster were made by group members.** The AI only ran read-only commands.
- **No secret values were shown to the AI.** No passwords, tokens or kubeconfig contents. Credentials live only in Doppler.
- **AI output was reviewed and tested before it was committed**, and every member must be able to explain any file in the repository, as the assignment requires.
