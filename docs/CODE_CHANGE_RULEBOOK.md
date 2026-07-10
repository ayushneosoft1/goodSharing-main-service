# GoodSharing Code Change Rulebook

Last updated: 2026-07-10

This file contains rules to follow during upcoming code changes. The goal is to keep GoodSharing clean, scalable, and easy to debug as more services are added.

## 1. Keep Clear Service Ownership

Each service owns its own business area and database.

Current ownership:

- `main-service`: public GraphQL gateway and request routing.
- `user-service`: users, auth, JWT creation, user profile data, push tokens.
- `posts-service`: posts, categories, subscriptions, notifications related to posts.

Rule:

```text
One service must not directly connect to another service's database tables.
```

Correct:

```text
posts-service stores user_id in posts DB.
user-service stores user details in user DB.
gateway/user-service resolves user details when needed.
```

Wrong:

```text
posts-service directly queries users table from user-service database.
user-service directly queries posts table from posts-service database.
```

Why:

- Keeps services independently deployable.
- Avoids hidden coupling.
- Makes database schema changes safer.
- Keeps data ownership clear.

## 2. ORM Relationships vs Federation

Sequelize or ORM relationships are fine inside a single service when that service owns all related tables.

Example:

```text
admin-service owns:
- users
- user_docs
- user_wallpapers
- roles
- fcm_tokens
```

In that case, ORM relationships are allowed:

```js
User.hasMany(UserDocs);
User.hasOne(UserWallpaper);
User.belongsToMany(Role);
User.hasMany(FcmToken);
```

This is correct because all these tables belong to the same service/database boundary.

Rule:

```text
Same service and same database ownership -> ORM relationships are fine.
Different services or different database ownership -> do not use ORM relationships across them.
```

GoodSharing example:

```text
posts-service owns posts DB.
user-service owns users DB.
```

So `posts-service` should not create a Sequelize relationship with the `users` table from user-service DB.

Instead:

```text
Need owner details in API response -> use Apollo Federation.
Need user data for backend workflow -> use internal API call or event/queue.
```

Important:

```text
Federation is not a replacement for ORM relationships.
ORM relationships work inside a service boundary.
Federation works across service boundaries.
```

## 3. Use Federation for Response Composition

Use Apollo Federation when one API response needs fields owned by multiple services.

Example:

```graphql
query {
  getPostDetails(postId: 108) {
    id
    title
    category
    owner {
      id
      first_name
      email
    }
  }
}
```

Here:

- `posts-service` owns post fields: `id`, `title`, `category`.
- `user-service` owns user fields: `id`, `first_name`, `email`.
- `main-service` gateway stitches the final response.

Flow:

```text
client -> main-service gateway
gateway -> posts-service for post data
posts-service returns owner reference: { __typename: "User", id: user_id }
gateway -> user-service to resolve User fields
gateway -> client with combined response
```

Rule:

```text
Data display composition -> use Apollo Federation.
```

Why:

- Frontend gets one GraphQL response.
- Services keep separate databases.
- User data remains owned by user-service.
- Posts data remains owned by posts-service.

## 4. Use Internal Service Calls for Backend Workflows

Use internal service calls when one service needs another service for backend logic or an action.

Example:

```text
posts-service creates a post
posts-service needs push tokens for subscribed users
posts-service calls user-service getPushTokens
posts-service sends notifications
```

This is not just response stitching. This is backend workflow logic.

Current example:

```text
posts-service -> user-service
getPushTokens(userIds)
```

Rule:

```text
Backend workflow/action -> use internal service call or event/queue.
```

Why:

- Some operations need data to perform work, not only display it.
- Internal calls are acceptable when they represent a business workflow.

Important:

- Keep internal calls intentional.
- Do not let every service call every other service randomly.
- If the workflow becomes heavy or slow, move it to a queue/event system.

## 5. Federation vs Internal Calls

Use this decision rule:

```text
Data display composition -> Federation
Backend workflow/action -> Internal service call or event/queue
```

Examples:

Use Federation:

```text
Show post with owner details.
Show notification with related post details.
Show order with product details.
```

Use internal service call:

```text
posts-service asks user-service for push tokens.
payment-service asks user-service for billing email.
notification-service asks user-service for notification preferences.
```

Use event/queue:

```text
send push notification after post creation
send email after signup
process image after upload
generate report in background
```

## 6. Prefer Async Events for Slow Work

If a task can take time or can fail independently, do not block the main API request forever.

Examples:

- push notifications
- emails
- image processing
- report generation
- audit logging

Future direction:

```text
posts-service publishes PostCreated event
notification-service consumes event
notification-service sends push notifications
```

Possible tools:

- BullMQ with Redis
- Kafka
- Redpanda
- RabbitMQ
- NATS

Rule:

```text
Keep user-facing API requests fast. Move slow side effects to queue/event workers.
```

## 7. Gateway Owns Public Auth

Clients should send JWT to the gateway:

```text
Authorization: Bearer <token>
```

Gateway validates the JWT and forwards trusted user context to subgraphs:

```text
x-user: {"id":"159","email":"tenjuly2@gmail.com"}
```

Rule:

```text
Subgraph services should not duplicate JWT validation unless there is a strong reason.
```

Why:

- Auth logic stays centralized.
- Subgraphs stay focused on business logic.
- Token validation is consistent.

## 8. Local Direct Testing Rule

When calling local `posts-service` directly:

```text
http://localhost:4002/graphql
```

Use:

```text
x-user: {"id":"159","email":"tenjuly2@gmail.com"}
```

Do not use:

```text
Authorization: Bearer <token>
```

Reason:

```text
posts-service does not decode JWT directly.
```

When calling public gateway:

```text
https://goodsharing.cloud/graphql
```

Use:

```text
Authorization: Bearer <token>
```

## 9. Keep Secrets Out of Code

Never commit:

- JWT secrets
- database URLs
- passwords
- private keys
- third-party API keys
- real tokens

Use:

- `.env` locally
- Kubernetes secrets in cluster
- secret manager later

Rule:

```text
Docs can mention secret names, but not secret values.
```

## 10. Keep Changes Scoped

Before changing code, identify the owner service.

Examples:

- Signup bug -> `user-service`
- Post creation bug -> `posts-service`
- JWT forwarding bug -> `main-service`
- Mobile screen bug -> `goodSharing-mobileApp`

Rule:

```text
Change the smallest service/module that owns the behavior.
```

Avoid unrelated refactors during feature work.

## 11. Update Docs When Architecture Changes

Update docs when adding:

- new service
- new database
- new internal service call
- new queue/event flow
- new namespace
- new deployment strategy
- new public domain

Docs to update:

- `PROJECT_CONTEXT.md`
- `CURRENT_STATE.md`
- `FUTURE_ENHANCEMENTS.md`
- this `CODE_CHANGE_RULEBOOK.md` if rules change

Rule:

```text
If future AI chats need to know it, write it in docs.
```
