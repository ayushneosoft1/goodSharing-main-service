# GoodSharing Project Context

Last updated: 2026-07-10

This file is the short project memory for future AI chats and teammates. Read this first before scanning repos.

## Repositories

- `goodSharing-main-service`: public GraphQL gateway. This is the public entrypoint for backend APIs.
- `goodSharing-user-service`: user/auth service.
- `goodSharing-posts-service`: posts, notifications, and subscriptions service.
- `goodSharing-mobileApp`: mobile app. Not deployed yet.
- `goodSharing-external-apis-service`: ignored for now.

## Public API

- Production GraphQL URL: `https://goodsharing.cloud/graphql`
- HTTP also worked earlier, but HTTPS is the intended public URL.
- Public clients should call the gateway, not user-service/posts-service directly.

## Infrastructure

- VPS provider: Hostinger.
- Domain provider/DNS panel: Hostinger.
- VPS public IP: `31.97.206.234`.
- Kubernetes: `kind` cluster running on the VPS.
- Kubernetes context name: `kind-goodsharing-cluster`.
- Kubernetes namespace for services: `services`.
- Public ingress: `ingress-nginx`.
- HTTPS: `cert-manager` with Let's Encrypt.
- Local service debugging: Telepresence.

## Current Cluster Components

- `main-service`
- `user-service`
- `posts-service`
- `redis`
- `ingress-nginx-controller`
- `cert-manager`
- `traffic-manager` for Telepresence

## Important Architecture Rules

- `main-service` is the public GraphQL gateway.
- `user-service` and `posts-service` are internal Kubernetes services.
- Browser/mobile clients send JWT using `Authorization: Bearer <token>` to the gateway.
- `posts-service` does not decode JWT directly.
- Gateway validates JWT and injects the authenticated user into the `x-user` header.
- Direct local testing of `posts-service` requires an `x-user` header.
- `x-user` header value should be raw JSON, for example:

```json
{"id":"159","email":"tenjuly2@gmail.com"}
```

- Do not wrap the `x-user` value in extra quotes in Apollo Sandbox.
- In the kind cluster, nginx ingress must run on the control-plane node because ports `80` and `443` are mapped to the control-plane container.
- If public API only works during `kubectl port-forward`, ingress/DNS is probably wrong.

## Hostinger DNS

Expected DNS records for `goodsharing.cloud`:

```text
Type   Name   Content          TTL
A      @      31.97.206.234    14400 or 300
CNAME  www    goodsharing.cloud 300
```

Old/wrong records such as `2.57.91.91` should not exist.

## Local Development Notes

For direct local posts-service testing:

- Run `posts-service` locally on port `4002`.
- Keep deployed `main-service` and `user-service` running in cluster.
- Use port-forward or Telepresence for cluster dependencies.
- Local direct URL: `http://localhost:4002/graphql`.
- Local direct auth header:

```text
x-user: {"id":"159","email":"tenjuly2@gmail.com"}
```

For deployed gateway testing:

- URL: `https://goodsharing.cloud/graphql`.
- Header:

```text
Authorization: Bearer <jwt-token>
```

## Telepresence Notes

- Telepresence is installed locally with Homebrew.
- Cluster-side Telepresence `traffic-manager` is installed in namespace `services`.
- Laptop default Kubernetes context was switched to `kind-goodsharing-cluster`.
- Connect command:

```bash
telepresence connect --docker --namespace services
```

- Check status:

```bash
telepresence status
```

## Key Runbook

Detailed rebuild guide:

- `GOODSHARING_VPS_KIND_TELEPRESENCE_GUIDE.md`

Read that file for full VPS rebuild, DNS, kind, ingress, cert-manager, HTTPS, and Telepresence steps.
