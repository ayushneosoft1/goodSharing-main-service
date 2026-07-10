# GoodSharing VPS Kind Cluster + HTTPS + Telepresence Runbook

This guide explains how to rebuild the GoodSharing backend setup from scratch on a VPS, expose it publicly at `https://goodsharing.cloud/graphql`, and run only one service locally with Telepresence while the other services keep running in Kubernetes.

Do not put real passwords, API keys, JWT secrets, database URLs, or third-party credentials in this document. Keep those in a password manager or Kubernetes secrets.

## 1. Mental Model

GoodSharing has three backend services:

- `goodSharing-main-service`: public GraphQL gateway.
- `goodSharing-user-service`: user/auth service.
- `goodSharing-posts-service`: posts service.

The public browser/API user calls:

```text
https://goodsharing.cloud/graphql
```

That request goes:

```text
Hostinger DNS -> VPS public IP -> kind control-plane port 443 -> nginx ingress -> main-service -> user-service/posts-service
```

When local development with Telepresence is active for posts-service:

```text
main-service in cluster -> posts-service Kubernetes Service -> Telepresence -> your local posts-service on Mac
```

Checkpoint: if you understand that only `main-service` is public and the other services are internal, proceed.

## 2. Hostinger DNS Setup

In Hostinger DNS for `goodsharing.cloud`, keep these records:

```text
Type   Name   Content          TTL
A      @      31.97.206.234    14400 or 300
CNAME  www    goodsharing.cloud 300
```

Remove old/wrong A records, for example any record pointing to `2.57.91.91`.

Do not use Hostinger parking/default DNS records for the root domain once your VPS is hosting the API.

Check from your laptop:

```bash
dig +short goodsharing.cloud
dig +short www.goodsharing.cloud
```

Expected:

```text
31.97.206.234
```

Checkpoint: if `dig +short goodsharing.cloud` returns only your VPS IP, proceed. If it still returns an old IP, wait for DNS propagation or remove the old record.

## 3. VPS Base Setup

SSH into the VPS:

```bash
ssh root@31.97.206.234
```

Install base packages:

```bash
apt update
apt install -y curl git ca-certificates gnupg lsb-release
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

Check:

```bash
docker ps
```

Expected: command works without Docker daemon errors.

Checkpoint: if Docker is running, proceed.

## 4. Install kubectl and kind on VPS

Install `kubectl`:

```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

Install `kind`:

```bash
curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x ./kind
mv ./kind /usr/local/bin/kind
```

Check:

```bash
kubectl version --client
kind version
```

Checkpoint: if both commands print versions, proceed.

## 5. Create kind Cluster with Public Ports

The important part: map VPS ports `80` and `443` into the kind control-plane container. This allows the internet to reach nginx ingress.

Create `kind-config.yaml` on the VPS:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: goodsharing-cluster
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
  - role: worker
```

Create cluster:

```bash
kind create cluster --config kind-config.yaml
```

Check:

```bash
kubectl get nodes -o wide
docker ps
```

Expected:

```text
goodsharing-cluster-control-plane   Ready
goodsharing-cluster-worker          Ready
```

Checkpoint: if nodes are Ready and Docker shows the kind containers, proceed.

## 6. Install nginx Ingress Correctly

Install nginx ingress for kind:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
```

Wait:

```bash
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s
```

Very important: the ingress controller must run on the control-plane node because only the control-plane container has host ports `80` and `443`.

Check:

```bash
kubectl -n ingress-nginx get pod -o wide
```

Expected node:

```text
goodsharing-cluster-control-plane
```

If it is running on the worker node, pin it:

```bash
kubectl -n ingress-nginx patch deployment ingress-nginx-controller \
  --type='json' \
  -p='[
    {"op":"add","path":"/spec/template/spec/nodeSelector/kubernetes.io~1hostname","value":"goodsharing-cluster-control-plane"}
  ]'
```

Check again:

```bash
kubectl -n ingress-nginx get pod -o wide
```

Checkpoint: if the ingress controller pod is Running on `goodsharing-cluster-control-plane`, proceed. If it is on worker, public domain will fail unless you use port-forward.

## 7. Create Namespace

Create namespace:

```bash
kubectl create namespace services
```

Check:

```bash
kubectl get ns services
```

Checkpoint: if namespace exists, proceed.

## 8. Clone Repositories on VPS

Example folder:

```bash
mkdir -p /root/projects/goodsharing
cd /root/projects/goodsharing
```

Clone only required backend repos:

```bash
git clone <main-service-repo-url> goodSharing-main-service
git clone <user-service-repo-url> goodSharing-user-service
git clone <posts-service-repo-url> goodSharing-posts-service
```

Ignore `goodSharing-external-apis-service` unless you specifically need it.

Check:

```bash
for d in goodSharing-main-service goodSharing-user-service goodSharing-posts-service; do
  git -C "$d" branch --show-current
  git -C "$d" log -1 --oneline
done
```

Expected: each repo is on `main`.

Checkpoint: if all three backend repos are on `main`, proceed.

## 9. Create Kubernetes Secrets

Create DB secrets from your real database URLs. Do not commit these values.

Example:

```bash
kubectl -n services create secret generic main-db-secret --from-literal=DB_URL='<main-db-url>'
kubectl -n services create secret generic user-db-secret --from-literal=DB_URL='<user-db-url>'
kubectl -n services create secret generic posts-db-secret --from-literal=DB_URL='<posts-db-url>'
```

Create internal service secret:

```bash
kubectl -n services create secret generic internal-service-secret \
  --from-literal=INTERNAL_SERVICE_SECRET='<shared-internal-secret>'
```

If using Aiven/Postgres CA certificates, create CA secrets too:

```bash
kubectl -n services create secret generic posts-db-ca --from-file=ca.pem=<path-to-ca.pem>
```

Check:

```bash
kubectl -n services get secrets
```

Checkpoint: if required secrets exist, proceed. Do not print secret values in terminal screenshots.

## 10. Deploy Redis

Create Redis deployment and service:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: services
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: services
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
```

Apply:

```bash
kubectl apply -f redis.yaml
```

Check:

```bash
kubectl -n services get pod,svc | grep redis
```

Checkpoint: if Redis pod is Running and service exists, proceed.

## 11. Build and Push Docker Images

Each service should use Node 20 if required by dependencies:

```dockerfile
FROM node:20-alpine
```

Build and push images:

```bash
docker build -t <dockerhub-user>/goodsharing-main-service:<tag> ./goodSharing-main-service
docker build -t <dockerhub-user>/goodsharing-user-service:<tag> ./goodSharing-user-service
docker build -t <dockerhub-user>/goodsharing-posts-service:<tag> ./goodSharing-posts-service

docker push <dockerhub-user>/goodsharing-main-service:<tag>
docker push <dockerhub-user>/goodsharing-user-service:<tag>
docker push <dockerhub-user>/goodsharing-posts-service:<tag>
```

Check:

```bash
docker images | grep goodsharing
```

Checkpoint: if images are pushed to Docker Hub or your registry, proceed.

## 12. Deploy Backend Services

Apply deployment and service YAMLs:

```bash
kubectl -n services apply -f goodSharing-main-service/
kubectl -n services apply -f goodSharing-user-service/
kubectl -n services apply -f goodSharing-posts-service/
```

Or apply exact files:

```bash
kubectl apply -f main-service-deployment.yaml
kubectl apply -f main-service-service.yaml
kubectl apply -f user-service-deployment.yaml
kubectl apply -f user-service-service.yaml
kubectl apply -f posts-service-deployment.yaml
kubectl apply -f posts-service-service.yaml
```

Check:

```bash
kubectl -n services get deploy,pod,svc -o wide
```

Expected:

```text
main-service    Running
user-service    Running
posts-service   Running
redis           Running
```

Checkpoint: if all pods are Running, proceed. If a pod is CrashLoopBackOff, check logs before moving forward.

## 13. Configure Service Environment Variables

Common required values:

Main service:

```text
USER_SERVICE_URL=http://user-service.services.svc.cluster.local:<port>/graphql
POSTS_SERVICE_URL=http://posts-service.services.svc.cluster.local:<port>/graphql
JWT_SECRET=<secret>
```

Posts service:

```text
DATABASE_URL from posts-db-secret
REDIS_HOST=redis
REDIS_PORT=6379
USER_SERVICE_URL=http://user-service.services.svc.cluster.local:<port>/graphql
INTERNAL_SERVICE_SECRET from internal-service-secret
```

User service:

```text
DATABASE_URL from user-db-secret
REDIS_HOST=redis
REDIS_PORT=6379
INTERNAL_SERVICE_SECRET from internal-service-secret
```

Check actual env:

```bash
kubectl -n services describe deploy posts-service
kubectl -n services describe deploy user-service
kubectl -n services describe deploy main-service
```

Checkpoint: if env values point to Kubernetes service DNS names, proceed.

## 14. Create HTTP Ingress

Create ingress for main-service only:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: main-service-ingress
  namespace: services
spec:
  ingressClassName: nginx
  rules:
    - host: goodsharing.cloud
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: main-service
                port:
                  number: 4000
```

Apply:

```bash
kubectl apply -f main-service-ingress.yaml
```

Check:

```bash
kubectl -n services get ingress
curl -i http://goodsharing.cloud/graphql
```

Expected: you should reach Apollo/GraphQL response, not Hostinger parking.

Checkpoint: if `http://goodsharing.cloud/graphql` works without port-forward, proceed. If it only works with port-forward, nginx ingress is probably not on the control-plane node or DNS points to the wrong IP.

## 15. Install cert-manager for HTTPS

Install cert-manager:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

Wait:

```bash
kubectl -n cert-manager get pods
```

Expected:

```text
cert-manager                 Running
cert-manager-cainjector      Running
cert-manager-webhook         Running
```

Checkpoint: if cert-manager pods are Running, proceed.

## 16. Create Let's Encrypt ClusterIssuer

Create `clusterissuer.yaml`:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    email: admin@goodsharing.cloud
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
```

Apply:

```bash
kubectl apply -f clusterissuer.yaml
```

Check:

```bash
kubectl get clusterissuer
```

Checkpoint: if `letsencrypt-prod` is Ready, proceed.

## 17. Enable HTTPS on Ingress

Patch or edit ingress:

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
    - hosts:
        - goodsharing.cloud
      secretName: goodsharing-cloud-tls
```

Check certificate:

```bash
kubectl -n services get certificate
kubectl -n services describe certificate goodsharing-cloud-tls
```

Check HTTPS:

```bash
curl -i https://goodsharing.cloud/graphql
```

Checkpoint: if HTTPS returns GraphQL response and browser does not show Hostinger parking, proceed.

## 18. cert-manager DNS Self-Check Problem

If DNS recently changed from an old IP to the VPS IP, cert-manager may still resolve the old IP inside the cluster.

Check from inside cluster:

```bash
kubectl -n services run dns-test --rm -it --image=busybox:1.36 -- nslookup goodsharing.cloud
```

Expected:

```text
31.97.206.234
```

If it still resolves to old IP, wait for DNS propagation. For temporary lab use, you can add a CoreDNS override:

```text
31.97.206.234 goodsharing.cloud www.goodsharing.cloud
```

Checkpoint: if in-cluster DNS resolves to VPS IP, Let's Encrypt HTTP-01 can work.

## 19. Debug Public GraphQL

Test gateway:

```bash
curl -sS -X POST https://goodsharing.cloud/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"query { __typename }"}'
```

Expected:

```json
{"data":{"__typename":"Query"}}
```

Test with token:

```bash
curl -sS -X POST https://goodsharing.cloud/graphql \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <jwt-token>' \
  --data '{"query":"query { getPostDetails(postId: 108) { id title category } }"}'
```

Checkpoint: if public HTTPS works with token, production gateway is healthy.

## 20. Copy VPS kubeconfig to Laptop

On laptop:

```bash
mkdir -p /tmp/goodsharing-telepresence
ssh root@31.97.206.234 'cat /root/.kube/config' > /tmp/goodsharing-telepresence/kubeconfig
```

Because the VPS kind API is local to the VPS, create SSH tunnel:

```bash
ssh -N -L 34593:127.0.0.1:34593 root@31.97.206.234
```

Keep this terminal open.

Check from another laptop terminal:

```bash
KUBECONFIG=/tmp/goodsharing-telepresence/kubeconfig kubectl get pods -n services
```

Checkpoint: if laptop can see VPS pods, proceed.

## 21. Make GoodSharing the Default Laptop Context

Back up your laptop kubeconfig first:

```bash
cp ~/.kube/config ~/.kube/config.backup.$(date +%Y%m%d-%H%M%S)
```

Merge:

```bash
KUBECONFIG="$HOME/.kube/config:/tmp/goodsharing-telepresence/kubeconfig" \
kubectl config view --flatten --raw > /tmp/goodsharing-merged-kubeconfig

cp /tmp/goodsharing-merged-kubeconfig ~/.kube/config
kubectl config use-context kind-goodsharing-cluster
```

Check:

```bash
kubectl config current-context
kubectl get pods -n services
```

Expected:

```text
kind-goodsharing-cluster
```

Checkpoint: if plain `kubectl get pods -n services` shows GoodSharing pods, proceed.

## 22. Install Telepresence Locally

On Mac:

```bash
brew install telepresenceio/telepresence/telepresence-oss
```

Check:

```bash
telepresence version
```

Checkpoint: if Telepresence prints version, proceed.

## 23. Install Telepresence Traffic Manager in Cluster

This is the part that must exist in the cluster. Without it, intercepts cannot work.

With `kubectl` context set to GoodSharing:

```bash
telepresence helm install --namespace services
```

Check:

```bash
kubectl -n services get pods | grep traffic-manager
```

Expected:

```text
traffic-manager-...   Running
```

Checkpoint: if traffic-manager is Running, proceed.

## 24. Connect Telepresence

If Docker is running locally:

```bash
telepresence connect --docker --namespace services
```

Check:

```bash
telepresence status
```

Expected:

```text
OSS Daemon ... Connected
OSS Traffic Manager: Connected
Kubernetes context: kind-goodsharing-cluster
Namespace: services
```

Checkpoint: if Telepresence status says connected to `kind-goodsharing-cluster`, proceed.

## 25. Local Dev Without Running All Services

For direct local posts-service testing, you do not need Telepresence intercept. You can use port-forwards:

```bash
kubectl -n services port-forward svc/redis 6380:6379
kubectl -n services port-forward svc/user-service 4001:4001
```

Create local env file:

```text
DATABASE_URL=<posts-db-url>
REDIS_HOST=127.0.0.1
REDIS_PORT=6380
USER_SERVICE_URL=http://127.0.0.1:4001/graphql
INTERNAL_SERVICE_SECRET=<same-secret-as-cluster>
```

Start posts-service locally:

```bash
cd goodSharing-posts-service
source /tmp/goodsharing-telepresence/posts-local.env
node index.js
```

Check:

```text
Posts Service running on http://0.0.0.0:4002/graphql
```

Checkpoint: if local posts-service starts on `4002`, proceed.

## 26. Correct Headers for Local Posts-Service

Local posts-service does not validate JWT tokens. The gateway validates JWT and injects `x-user`.

When calling local posts-service directly:

```text
http://localhost:4002/graphql
```

Use header:

```json
{
  "x-user": "{\"id\":\"159\",\"email\":\"tenjuly2@gmail.com\"}"
}
```

In Apollo Sandbox header table, use:

```text
x-user    {"id":"159","email":"tenjuly2@gmail.com"}
```

Do not add extra outer quotes in the visual header table. If you add outer quotes, `context.user.id` becomes undefined and DB insert fails with `user_id null`.

Checkpoint: if createPost inserts with the correct owner id, local auth simulation is correct.

## 27. Correct Headers for Public Gateway

When calling gateway:

```text
https://goodsharing.cloud/graphql
```

Use:

```text
Authorization: Bearer <jwt-token>
```

Do not use `x-user` from the browser/client against the public gateway in real usage. The gateway should own JWT validation.

Checkpoint: if gateway requests work with JWT, auth flow is correct.

## 28. Telepresence Intercept Notes

Telepresence connect and Telepresence intercept are different:

- `telepresence connect`: connects laptop networking to the cluster.
- `telepresence intercept`: routes a Kubernetes service's traffic to your local machine.

An intercept can affect live traffic. If you intercept `posts-service`, deployed `main-service` may send real production requests to your local laptop.

Basic command:

```bash
telepresence intercept posts-service --namespace services --port 4002:4002
```

Check:

```bash
telepresence list
telepresence status
```

Stop intercept:

```bash
telepresence leave posts-service
```

Checkpoint: if you are learning alone, intercept is fine. If other people use the API, warn them before intercepting.

## 29. Common Failure Modes

Problem: domain opens Hostinger parking page.

Cause:

- DNS points to wrong IP.
- Root A record missing.
- Browser cached old redirect.

Check:

```bash
dig +short goodsharing.cloud
curl -I http://goodsharing.cloud/graphql
```

Problem: API only works with port-forward.

Cause:

- nginx ingress controller is on worker node, but kind public ports are mapped to control-plane.

Check:

```bash
kubectl -n ingress-nginx get pod -o wide
```

Problem: HTTPS certificate not issuing.

Cause:

- DNS still resolving old IP.
- port 80 blocked.
- cert-manager cannot complete HTTP-01 challenge.

Check:

```bash
kubectl -n services describe certificate goodsharing-cloud-tls
kubectl -n services get challenge,order
```

Problem: local posts-service says Unauthorized.

Cause:

- Missing `x-user` header.
- Passing JWT to posts-service directly.

Fix:

```text
x-user: {"id":"159","email":"tenjuly2@gmail.com"}
```

Problem: DB says `user_id` null.

Cause:

- `x-user` is double-encoded as a string.

Fix:

Use raw JSON as header value in Apollo Sandbox table.

Problem: `telepresence connect` uses old context.

Check:

```bash
kubectl config current-context
```

Fix:

```bash
kubectl config use-context kind-goodsharing-cluster
```

Problem: `telepresence status` errors with missing `daemon.json`.

Cause:

- stale Telepresence daemon cache.

Fix:

```bash
telepresence quit
rm -rf ~/Library/Caches/telepresence/rootd \
       ~/Library/Caches/telepresence/userd \
       ~/Library/Caches/telepresence/sessions
telepresence status
```

## 30. Safe Rebuild Checklist

Before deleting/rebuilding the VPS, save:

- Git repos and latest branches.
- Docker image tags or Docker build commands.
- Kubernetes YAML files.
- Secret names and which values they require.
- Hostinger DNS screenshot or exported records.
- Kubeconfig backup if needed.
- This runbook.

After rebuild, verify in this order:

1. Docker works on VPS.
2. kind cluster nodes are Ready.
3. nginx ingress pod runs on control-plane.
4. DNS points to VPS IP.
5. `http://goodsharing.cloud/graphql` works without port-forward.
6. cert-manager pods are Running.
7. `https://goodsharing.cloud/graphql` works.
8. laptop `kubectl` context is `kind-goodsharing-cluster`.
9. Telepresence traffic-manager is Running.
10. `telepresence connect --docker --namespace services` works.
11. local posts-service works with `x-user` header.

If each checkpoint passes, the setup is healthy.
