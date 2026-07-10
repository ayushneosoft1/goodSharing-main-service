# GoodSharing Current State

Last updated: 2026-07-10

This file tracks the latest known working state and recent operational notes.

## Working Now

- `https://goodsharing.cloud/graphql` is active and working.
- Hostinger DNS points `goodsharing.cloud` to VPS IP `31.97.206.234`.
- Old Hostinger/wrong IP record `2.57.91.91` was removed.
- Kubernetes context on laptop is now `kind-goodsharing-cluster`.
- `kubectl get pods -n services` works from the laptop.
- Telepresence connects to the GoodSharing cluster.
- Telepresence traffic-manager is installed in the cluster.
- `posts-service` can be run locally without running `main-service` and `user-service` locally.
- Local `posts-service` direct GraphQL works at `http://localhost:4002/graphql`.
- `createPost` works locally when passing correct `x-user` header.

## Last Known Cluster State

Namespace: `services`

Expected running workloads:

- `main-service`
- `user-service`
- `posts-service`
- `redis`
- `traffic-manager`

Other cluster components:

- `ingress-nginx-controller`
- `cert-manager`

## Latest Deployment Notes

- `goodSharing-posts-service` Dockerfile was updated to use `node:20-alpine`.
- Posts service image was rebuilt and deployed after the Node 20 fix.
- Redis was added to the cluster for service dependencies.
- `INTERNAL_SERVICE_SECRET` was added as a Kubernetes secret and wired into services.
- nginx ingress was fixed by ensuring the controller runs on the kind control-plane node.
- HTTPS was added with cert-manager and Let's Encrypt.

## Local Testing Notes

For local posts-service direct calls:

```text
http://localhost:4002/graphql
```

Use header:

```text
x-user: {"id":"159","email":"tenjuly2@gmail.com"}
```

Do not use JWT directly against local posts-service. JWT belongs at the gateway.

For gateway calls:

```text
https://goodsharing.cloud/graphql
```

Use header:

```text
Authorization: Bearer <jwt-token>
```

## Known Gotchas

- If `telepresence connect` uses `kind-cka-cluster2`, it is using the wrong context.
- Correct context is `kind-goodsharing-cluster`.
- If Apollo Sandbox local direct posts-service call returns `Unauthorized`, the `x-user` header is missing.
- If DB error says `user_id` is null, the `x-user` header is probably double-encoded with extra quotes.
- If domain opens Hostinger parking page, DNS is wrong or stale.
- If public API only works with port-forward, ingress is not correctly receiving traffic from VPS ports `80/443`.

## Next Possible Improvements

- Add CI/CD for build and deploy.
- Add dedicated Kubernetes manifests folder.
- Add `.env.example` files for each service.
- Add health check endpoints.
- Add staging namespace before production usage grows.
- Add scripts for common local dev commands.
