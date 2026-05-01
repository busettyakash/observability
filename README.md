# 📊 Observability Stack

A production-ready observability stack with **Prometheus**, **Grafana**, **Loki**, **Promtail**, **Alertmanager**, **Node Exporter**, and **cAdvisor** — all wired up with Docker Compose.

---

## 🗂️ Stack Overview

| Service         | Purpose                          | Port   |
|-----------------|----------------------------------|--------|
| Grafana         | Dashboards & visualisation       | 3000   |
| Prometheus      | Metrics collection & storage     | 9090   |
| Alertmanager    | Alert routing & silencing        | 9093   |
| Loki            | Log aggregation                  | 3100   |
| Promtail        | Log shipper → Loki               | 9080   |
| Node Exporter   | Host (CPU/RAM/disk) metrics      | 9100   |
| cAdvisor        | Docker container metrics         | 8080   |

---

## 🚀 Quick Start

### 1. Prerequisites
- Docker ≥ 24
- Docker Compose ≥ 2.x

### 2. Clone & Configure
```bash
git clone <your-repo>
cd observability-stack

# Edit credentials (optional but recommended for production)
nano .env
```

### 3. Start the Stack
```bash
docker compose up -d
```

### 4. Verify All Services
```bash
docker compose ps
```

### 5. Access UIs
| Service      | URL                          | Default Credentials |
|--------------|------------------------------|---------------------|
| Grafana      | http://localhost:3000        | admin / admin       |
| Prometheus   | http://localhost:9090        | —                   |
| Alertmanager | http://localhost:9093        | —                   |
| cAdvisor     | http://localhost:8080        | —                   |

---

## 📁 Directory Structure

```
observability-stack/
├── docker-compose.yml
├── .env                          # Credentials (never commit!)
├── prometheus/
│   ├── prometheus.yml            # Scrape config
│   └── alerts.yml                # Alert rules
├── alertmanager/
│   └── alertmanager.yml          # Alert routing (email/Slack)
├── loki/
│   └── loki.yml                  # Loki config
├── promtail/
│   └── promtail.yml              # Log scraping config
└── grafana/
    ├── dashboards/
    │   └── host-metrics.json     # Pre-built host dashboard
    └── provisioning/
        ├── datasources/
        │   └── datasources.yml   # Auto-wires Prometheus + Loki
        └── dashboards/
            └── dashboards.yml    # Auto-loads dashboards
```

---

## ➕ Adding Your Own Application

### 1. Expose a `/metrics` endpoint in your app (Prometheus format)

### 2. Add it to `prometheus/prometheus.yml`:
```yaml
- job_name: "my-app"
  static_configs:
    - targets: ["my-app:8000"]   # service name from docker-compose
```

### 3. Add it to `docker-compose.yml`:
```yaml
my-app:
  image: my-org/my-app:latest
  networks:
    - observability
```

### 4. Reload Prometheus (no restart needed):
```bash
curl -X POST http://localhost:9090/-/reload
```

---

## 🔔 Setting Up Alerts

Edit `alertmanager/alertmanager.yml` to configure notification channels:

**Email:**
```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@example.com'
  smtp_auth_username: 'alerts@example.com'
  smtp_auth_password: 'your-app-password'
```

**Slack:**
```yaml
- name: critical
  slack_configs:
    - api_url: 'https://hooks.slack.com/services/T.../B.../...'
      channel: '#alerts'
```

---

## 🛑 Useful Commands

```bash
# Start stack
docker compose up -d

# Stop stack
docker compose down

# Stop and delete all data volumes
docker compose down -v

# View logs for a specific service
docker compose logs -f prometheus

# Restart a single service
docker compose restart grafana

# Hot-reload Prometheus config
curl -X POST http://localhost:9090/-/reload
```

---

## 🔒 Production Checklist

- [ ] Change `GF_ADMIN_PASSWORD` in `.env`
- [ ] Enable HTTPS on Grafana (reverse proxy with nginx/traefik)
- [ ] Configure real alert receivers (email/Slack/PagerDuty)
- [ ] Adjust Prometheus retention (`--storage.tsdb.retention.time`)
- [ ] Restrict ports — don't expose 9090/9093 publicly
- [ ] Add authentication to Prometheus (`web.yml` basic auth)

---

## 📦 Updating Images

Edit version tags in `docker-compose.yml`, then:
```bash
docker compose pull
docker compose up -d
```
