# GoodSharing Future Enhancements

Last updated: 2026-07-10

This file tracks future improvements for GoodSharing. These are not urgent for the current working setup, but they are useful as the project grows.

## 1. Kubernetes Namespace Improvements

Current state:

- Most backend workloads run in namespace `services`.
- Redis also runs in `services`.
- Telepresence `traffic-manager` also runs in `services`.

Future improvement:

- Keep application services in `services`.
- Move shared infrastructure into separate namespaces.

Possible namespace layout:

```text
services          main-service, user-service, posts-service
data              redis, future databases/cache infra if self-hosted
observability     logs, metrics, dashboards
telepresence      traffic-manager
ingress-nginx     nginx ingress controller
cert-manager      cert-manager
```

Why:

- Cleaner ownership.
- Easier debugging.
- Easier permission/RBAC management.
- Less confusion as more services are added.

Priority: medium.

## 2. Persistent Redis

Current state:

- Redis is running in Kubernetes.
- If Redis pod restarts, in-memory cache data can be lost.

Future improvement:

- Add persistent volume for Redis if data must survive restarts.
- Decide what Redis stores:
  - temporary cache only
  - sessions
  - queues
  - notification state
  - rate limiting data

If Redis is only cache, losing data may be acceptable.

If Redis stores important queue/session data, use persistence.

Possible Redis persistence options:

- Redis AOF persistence.
- Redis RDB snapshots.
- PersistentVolumeClaim in Kubernetes.
- Managed Redis service later if budget allows.

Priority: medium, depending on how Redis is used.

## 3. Redis High Availability

Future improvement:

- Use Redis master/replica setup.
- Add Redis Sentinel or a Redis operator.
- Consider 3-node Redis failover setup.

Why:

- Better reliability.
- Redis can survive one pod/node failure.

Important note:

- For a single small VPS, Redis HA is mostly for learning. True HA needs multiple nodes/servers. If all replicas run on one VPS and the VPS goes down, Redis still goes down.

Priority: low now, useful later for learning.

## 4. Kafka-Based Notification System

Current state:

- Push notification logic exists inside backend services.

Future improvement:

- Introduce Kafka or another message broker for async events.

Example flow:

```text
posts-service creates post
posts-service publishes PostCreated event
notification-service consumes event
notification-service sends push notifications
```

Benefits:

- Services become less tightly coupled.
- Notification sending does not slow down createPost API.
- Failed notification jobs can be retried.
- Future services can subscribe to events.

Possible technologies:

- Kafka
- Redpanda
- RabbitMQ
- NATS
- BullMQ with Redis

Suggested path:

1. Start with BullMQ if Redis is already used and traffic is small.
2. Move to Kafka/Redpanda later when event streaming becomes important.

Priority: medium for push-notification scaling.

## 5. Dedicated Notification Service

Future improvement:

- Split notification/push logic into a separate service.

Possible service:

```text
goodSharing-notification-service
```

Responsibilities:

- store notifications
- send push notifications
- retry failed notifications
- manage notification templates
- consume events from Kafka/queue

Why:

- Keeps posts-service focused on posts.
- Makes notification failures easier to isolate.
- Easier to scale notification workers separately.

Priority: medium.

## 6. CI/CD Pipeline

Future improvement:

- Add GitHub Actions or another CI/CD system.

Pipeline should:

1. Run tests.
2. Build Docker image.
3. Push image to Docker Hub or registry.
4. Deploy to Kubernetes.
5. Verify rollout.

Example flow:

```text
push to main -> build image -> push image -> kubectl rollout restart/set image
```

Benefits:

- Less manual deployment.
- Fewer mistakes.
- Faster rebuild after VPS reset.

Priority: high.

## 7. Kubernetes Manifests Cleanup

Future improvement:

- Move all Kubernetes YAMLs into a clean folder structure.

Possible structure:

```text
k8s/
  namespaces/
  ingress/
  cert-manager/
  redis/
  main-service/
  user-service/
  posts-service/
  telepresence/
```

Later options:

- Kustomize
- Helm charts
- Argo CD

Priority: high as services increase.

## 8. Staging Environment

Future improvement:

- Add staging namespace before production.

Example:

```text
services-staging
services-prod
```

Benefits:

- Test deployments before production.
- Safer experiments.
- Better trainee practice environment.

Possible domains:

```text
api.goodsharing.cloud
staging-api.goodsharing.cloud
```

Priority: medium.

## 9. Observability

Future improvement:

- Add basic logs, metrics, and dashboards.

Possible tools:

- Prometheus
- Grafana
- Loki
- OpenTelemetry

Start simple:

- structured JSON logs
- request id
- error logs
- Kubernetes resource monitoring

Useful commands for now:

```bash
kubectl -n services logs deploy/main-service
kubectl -n services logs deploy/user-service
kubectl -n services logs deploy/posts-service
kubectl -n services top pods
```

Priority: medium.

## 10. Health Checks and Readiness Probes

Future improvement:

- Add health endpoints to each service.
- Add Kubernetes liveness/readiness probes.

Example endpoints:

```text
/health
/ready
```

Readiness should verify:

- service is booted
- database connection works
- required internal config exists

Why:

- Kubernetes can avoid sending traffic to broken pods.
- Rollouts become safer.

Priority: high.

## 11. Secrets Management

Current state:

- Kubernetes secrets are used.

Future improvement:

- Keep secrets out of Git.
- Add documented secret names and required keys.
- Consider sealed-secrets or external secret manager later.

Possible future tools:

- Sealed Secrets
- External Secrets Operator
- Doppler
- 1Password Secrets Automation
- HashiCorp Vault

Priority: medium.

## 12. Domain and API Structure

Current public API:

```text
https://goodsharing.cloud/graphql
```

Future improvement:

Use clearer subdomains:

```text
https://api.goodsharing.cloud/graphql
https://staging-api.goodsharing.cloud/graphql
https://www.goodsharing.cloud
```

Why:

- Root domain can later host a landing page.
- API domain stays dedicated.
- Staging and production become cleaner.

Priority: medium.

## 13. Mobile App Deployment

Important clarification:

The mobile app is not deployed to the Kubernetes cluster like backend services.

Backend services run in Kubernetes because they are servers.

The mobile app is built into installable app packages:

- Android: `.aab` or `.apk`
- iOS: `.ipa`

For Android:

- Build release app bundle.
- Upload to Google Play Console.
- Users install it from Play Store.

For iOS:

- Build with Apple developer tooling.
- Upload to App Store Connect.
- Users install it from App Store.

The mobile app should call:

```text
https://goodsharing.cloud/graphql
```

or later:

```text
https://api.goodsharing.cloud/graphql
```

What may be deployed separately:

- If the mobile app has a web admin panel, that web panel can be deployed.
- If using Expo updates, some JS bundles may be hosted by Expo/EAS.
- If using Firebase for push notifications, Firebase config must be set up.

But the mobile app itself does not run as a pod in Kubernetes.

Priority: high when ready for users.

## 14. Play Store Readiness

Before Play Store:

- Create Google Play Console account.
- Prepare app name, icon, screenshots, description.
- Configure package name/application id.
- Generate signing key or use Play App Signing.
- Build Android App Bundle `.aab`.
- Add privacy policy.
- Add data safety form.
- Test with internal testing track.

Backend readiness before mobile release:

- HTTPS must work.
- API should be stable.
- Auth flow should be tested.
- Push notifications should be tested.
- Error handling should be friendly.

Priority: high before public app release.

## 15. Database Migrations

Future improvement:

- Use a proper migration tool.

Options:

- node-pg-migrate
- Prisma migrations
- Knex migrations
- Flyway

Why:

- Schema changes become repeatable.
- Rebuilds become safer.
- Trainees can apply DB changes reliably.

Priority: high.

## 16. Testing Strategy

Future improvement:

- Add tests at multiple levels.

Suggested minimum:

- resolver unit tests
- database integration tests
- GraphQL API smoke tests
- deployment smoke tests

Example smoke test:

```graphql
query {
  __typename
}
```

Priority: medium.

## 17. API Versioning and Backward Compatibility

Future improvement:

- Be careful when changing GraphQL schema used by mobile app.
- Avoid breaking mobile clients already released to Play Store.

Useful habits:

- Add fields instead of renaming.
- Deprecate old fields before removing.
- Keep mobile app release versions in mind.

Priority: medium after app is public.

## 18. Backup and Disaster Recovery

Future improvement:

- Document how to rebuild VPS from scratch.
- Backup database regularly.
- Backup Kubernetes manifests.
- Keep Docker images tagged.
- Keep important docs in Git.

Already started:

- `GOODSHARING_VPS_KIND_TELEPRESENCE_GUIDE.md`
- `PROJECT_CONTEXT.md`
- `CURRENT_STATE.md`

Priority: high.

## 19. Security Improvements

Future improvement:

- Do not SSH as root for normal operations.
- Add a non-root deploy user.
- Use SSH keys instead of password login.
- Configure firewall.
- Keep JWT secrets strong.
- Rotate leaked tokens/secrets.
- Add rate limiting.
- Restrict CORS properly.

Priority: high before real users.

## 20. Suggested Roadmap

Short term:

1. Add `.env.example` for each backend service.
2. Add health/readiness endpoints.
3. Clean Kubernetes manifests.
4. Add basic CI/CD for one service.
5. Add database migration tool.

Medium term:

1. Add staging namespace.
2. Split notification service.
3. Add queue for push notifications.
4. Add logs/metrics dashboard.
5. Prepare mobile app release flow.

Long term:

1. Use managed database/Redis if budget allows.
2. Add Redis HA or managed Redis.
3. Add Kafka/Redpanda for event streaming.
4. Add GitOps with Argo CD.
5. Move from single VPS to multi-node or managed Kubernetes when needed.
