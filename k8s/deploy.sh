#!/bin/bash
# ══════════════════════════════════════════════════════
#  deploy.sh — Deploy full observability stack to K8s
# ══════════════════════════════════════════════════════

set -e

NAMESPACE="your-namespace"   # ← CHANGE THIS to your services namespace
echo "🚀 Deploying observability stack..."

# 1. Create observability namespace
echo "📁 Creating observability namespace..."
kubectl apply -f k8s/namespace/namespace.yaml

# 2. Deploy Prometheus RBAC
echo "🔐 Applying Prometheus RBAC..."
kubectl apply -f k8s/prometheus/rbac.yaml

# 3. Deploy Prometheus config
echo "⚙️  Applying Prometheus config..."
kubectl apply -f k8s/prometheus/configmap.yaml

# 4. Deploy Prometheus
echo "📡 Deploying Prometheus..."
kubectl apply -f k8s/prometheus/deployment.yaml

# 5. Deploy Grafana
echo "📊 Deploying Grafana..."
kubectl apply -f k8s/grafana/deployment.yaml

# 6. Wait for pods to be ready
echo "⏳ Waiting for pods to be ready..."
kubectl rollout status deployment/prometheus -n observability
kubectl rollout status deployment/grafana -n observability

# 7. Patch your existing services with Prometheus annotations
echo "🏷️  Patching your services with Prometheus annotations..."
kubectl patch deployment authorization-service           -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment azure-db-provisioning-service   -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment clm-service                     -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment cpq-service                     -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment crm-service                     -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment iam-keycloak-provisioning-service -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment iam-keycloak-sync-service       -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment metabench-service               -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment notification-service            -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment platform-service                -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment pricing-service                 -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment revenue-management-service      -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment tenant-service                  -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'
kubectl patch deployment vector-db-provisioning-service  -n $NAMESPACE --patch '{"spec":{"template":{"metadata":{"annotations":{"prometheus.io/scrape":"true","prometheus.io/path":"/actuator/prometheus","prometheus.io/port":"8080"}}}}}'

echo ""
echo "✅ Done! Access your dashboards:"
echo ""
echo "   Grafana:"
echo "   kubectl port-forward svc/grafana 3000:3000 -n observability"
echo "   → http://localhost:3000  (admin/admin)"
echo ""
echo "   Prometheus:"
echo "   kubectl port-forward svc/prometheus 9090:9090 -n observability"
echo "   → http://localhost:9090"
echo ""
echo "   Check all targets are UP:"
echo "   http://localhost:9090/targets"
