# Deploy to Huawei CCE

Everything runs in namespace `hackaton`. The backend must stay at one replica (inline processing dispatcher), so its Deployment uses `Recreate`.

## 1. Build and push the images

Replace `<org>` with the SWR organization and `<tag>` with e.g. the git short SHA.

```sh
docker login swr.la-south-2.myhuaweicloud.com
docker build -f apps/backend/Dockerfile -t swr.la-south-2.myhuaweicloud.com/<org>/hackaton-backend:<tag> .
docker build -f deploy/ollama/Dockerfile -t swr.la-south-2.myhuaweicloud.com/<org>/hackaton-ollama:<tag> deploy/ollama
docker push swr.la-south-2.myhuaweicloud.com/<org>/hackaton-backend:<tag>
docker push swr.la-south-2.myhuaweicloud.com/<org>/hackaton-ollama:<tag>
```

The Ollama image bakes `qwen3-embedding:0.6b` in at build time (the build needs internet access).

## 2. Set the image names, tags and ELB

In `deploy/k8s/kustomization.yaml` and `deploy/k8s/migrate/kustomization.yaml`, replace `<org>` and `newTag` under `images:`. Or use the CLI:

```sh
cd deploy/k8s
kustomize edit set image swr.la-south-2.myhuaweicloud.com/<org>/hackaton-backend=swr.la-south-2.myhuaweicloud.com/<real-org>/hackaton-backend:<tag>
kustomize edit set image swr.la-south-2.myhuaweicloud.com/<org>/hackaton-ollama=swr.la-south-2.myhuaweicloud.com/<real-org>/hackaton-ollama:<tag>
```

Set `kubernetes.io/elb.id` in `deploy/k8s/ingress.yaml` to the existing ELB id.

## 3. Namespace, CA and secrets

```sh
kubectl apply -f deploy/k8s/namespace.yaml
kubectl -n hackaton create configmap rds-ca --from-file=ca.pem=$HOME/.config/hackaton/rds-ca.pem
kubectl -n hackaton create secret generic backend-secrets --from-env-file=backend-secrets.env
```

`backend-secrets.env` is an untracked file with `DB_PASSWORD`, `OBS_AK`, `OBS_SK` and `ORBIT_API_KEY` (see `deploy/k8s/secret.example.yaml`). Never commit it.

## 4. Migrate the database

```sh
kubectl kustomize deploy/k8s/migrate | kubectl apply -f -
kubectl -n hackaton wait --for=condition=complete job/migrate --timeout=120s
kubectl -n hackaton logs job/migrate
kubectl -n hackaton delete job migrate
```

Delete the Job before the next migration run, since a Job's pod template cannot be updated.

## 5. Apply and check

```sh
kubectl apply -k deploy/k8s
kubectl -n hackaton rollout status deploy/backend
kubectl -n hackaton rollout status deploy/ollama
kubectl -n hackaton get ingress backend
curl http://<elb-address>/api/health
```

## Ollama without a custom image

If the Ollama image cannot be built or pushed, use the stock image and pull the model on start (needs egress to the Ollama registry). Replace the image in `ollama.yaml` with `ollama/ollama:latest` and add `ollama-pull.patch.yaml` as a `patches:` entry in `deploy/k8s/kustomization.yaml`.
