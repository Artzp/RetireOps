# RetireOps Deployment Guide

Complete guide for deploying RetireOps to production supporting 1000+ concurrent users.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Production Deployment Options](#production-deployment-options)
4. [DigitalOcean Deployment](#digitalocean-deployment)
5. [AWS Deployment](#aws-deployment)
6. [Monitoring Setup](#monitoring-setup)
7. [Backup & Recovery](#backup--recovery)
8. [Scaling Guidelines](#scaling-guidelines)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- **Docker:** 24.0+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose:** 2.20+ (included with Docker Desktop)
- **Node.js:** 20+ (for local development)
- **pnpm:** 8+ (`npm install -g pnpm`)
- **Git:** Latest version
- **kubectl:** Latest (for Kubernetes deployments)

### Recommended Tools

- **k9s:** Kubernetes CLI UI ([Install](https://k9scli.io/))
- **Lens:** Kubernetes IDE ([Install](https://k8slens.dev/))
- **Postman/Insomnia:** API testing
- **pgAdmin:** PostgreSQL management

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/retireops.git
cd retireops
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Generate secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For NEXTAUTH_SECRET
openssl rand -hex 32     # For ENCRYPTION_KEY

# Edit .env with your values
nano .env
```

**Minimum required variables:**

```bash
DB_PASSWORD=your_secure_password_here
REDIS_PASSWORD=your_redis_password
JWT_SECRET=generated_secret_from_openssl
NEXTAUTH_SECRET=generated_secret_from_openssl
ENCRYPTION_KEY=generated_key_from_openssl
GRAFANA_PASSWORD=admin_password
```

### 3. Build and Start Services

```bash
# Build all Docker images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

### 4. Verify Installation

```bash
# Check web frontend
curl http://localhost:3000/api/health

# Check API
curl http://localhost:4000/health

# Check database
docker-compose exec postgres psql -U retireops -d retireops -c "SELECT version();"

# Check Redis
docker-compose exec redis redis-cli ping
```

### 5. Access Services

- **Web App:** http://localhost:3000
- **API:** http://localhost:4000
- **Grafana:** http://localhost:3001 (admin/your_password)
- **Prometheus:** http://localhost:9090
- **PostgreSQL:** localhost:5432

---

## Production Deployment Options

### Option 1: DigitalOcean (Recommended for MVP)

**Pros:**

- ✅ Simple setup
- ✅ Managed Kubernetes
- ✅ Cost-effective ($257/month)
- ✅ Good for 1000-5000 users

**Cons:**

- ❌ Limited to single region initially
- ❌ Less advanced features than AWS

### Option 2: AWS (Best for Scale)

**Pros:**

- ✅ Global reach
- ✅ Advanced features (RDS, ElastiCache, ECS/EKS)
- ✅ Battle-tested at scale
- ✅ Excellent monitoring/logging

**Cons:**

- ❌ More complex setup
- ❌ Higher cost ($878/month+)
- ❌ Steeper learning curve

### Option 3: Self-Hosted (VPS)

**Pros:**

- ✅ Full control
- ✅ Lowest cost
- ✅ No vendor lock-in

**Cons:**

- ❌ Manual scaling
- ❌ You manage everything
- ❌ Limited geographic distribution

---

## DigitalOcean Deployment

### Step 1: Create Kubernetes Cluster

```bash
# Install doctl CLI
brew install doctl  # macOS
# OR
snap install doctl  # Linux

# Authenticate
doctl auth init

# Create cluster (3 nodes, 8GB RAM each)
doctl kubernetes cluster create retireops-prod \
  --region nyc3 \
  --version latest \
  --node-pool "name=worker-pool;size=s-4vcpu-8gb;count=3;auto-scale=true;min-nodes=3;max-nodes=10"

# Get kubeconfig
doctl kubernetes cluster kubeconfig save retireops-prod
```

### Step 2: Create Managed Databases

```bash
# PostgreSQL
doctl databases create retireops-postgres \
  --engine pg \
  --version 16 \
  --region nyc3 \
  --size db-s-2vcpu-4gb \
  --num-nodes 1

# Redis
doctl databases create retireops-redis \
  --engine redis \
  --version 7 \
  --region nyc3 \
  --size db-s-1vcpu-2gb
```

### Step 3: Configure Secrets

```bash
# Create namespace
kubectl create namespace retireops

# Create secrets
kubectl create secret generic app-secrets \
  --namespace=retireops \
  --from-literal=db-password='your_db_password' \
  --from-literal=redis-password='your_redis_password' \
  --from-literal=jwt-secret='your_jwt_secret' \
  --from-literal=encryption-key='your_encryption_key'

# Create ConfigMap
kubectl create configmap app-config \
  --namespace=retireops \
  --from-literal=api-url='https://api.retireops.com'
```

### Step 4: Deploy Application

```bash
# Apply Kubernetes manifests
kubectl apply -f kubernetes/ --namespace=retireops

# Check deployment status
kubectl get pods --namespace=retireops
kubectl get services --namespace=retireops

# Watch rollout
kubectl rollout status deployment/retireops-web --namespace=retireops
```

### Step 5: Configure Load Balancer

```bash
# Create DigitalOcean Load Balancer
doctl compute load-balancer create \
  --name retireops-lb \
  --region nyc3 \
  --forwarding-rules entry_protocol:https,entry_port:443,target_protocol:http,target_port:80,certificate_id:YOUR_CERT_ID \
  --health-check protocol:http,port:80,path:/health,check_interval_seconds:10 \
  --droplet-ids $(doctl kubernetes cluster node-pool get retireops-prod worker-pool --format ID --no-header)
```

### Step 6: Configure DNS

```bash
# Add A record pointing to Load Balancer IP
# Example using doctl
doctl compute domain records create retireops.com \
  --record-type A \
  --record-name @ \
  --record-data YOUR_LB_IP
```

---

## AWS Deployment

### Step 1: Create EKS Cluster

```bash
# Install eksctl
brew install eksctl  # macOS

# Create cluster
eksctl create cluster \
  --name retireops-prod \
  --region us-east-1 \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 3 \
  --nodes-max 10 \
  --managed

# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name retireops-prod
```

### Step 2: Create RDS Database

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name retireops-subnet \
  --db-subnet-group-description "RetireOps DB Subnet" \
  --subnet-ids subnet-xxx subnet-yyy

# Create PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier retireops-postgres \
  --db-instance-class db.t3.large \
  --engine postgres \
  --engine-version 16.1 \
  --master-username retireops \
  --master-user-password 'YOUR_SECURE_PASSWORD' \
  --allocated-storage 100 \
  --storage-type gp3 \
  --db-subnet-group-name retireops-subnet \
  --vpc-security-group-ids sg-xxx \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --multi-az
```

### Step 3: Create ElastiCache Redis

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id retireops-redis \
  --cache-node-type cache.t3.medium \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --cache-subnet-group-name retireops-cache-subnet \
  --security-group-ids sg-xxx
```

### Step 4: Deploy to EKS

```bash
# Create namespace and secrets (same as DigitalOcean)
kubectl create namespace retireops

# Deploy
kubectl apply -f kubernetes/ --namespace=retireops
```

### Step 5: Configure ALB Ingress

```bash
# Install AWS Load Balancer Controller
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=retireops-prod

# Apply ingress
kubectl apply -f kubernetes/ingress-alb.yaml --namespace=retireops
```

---

## Monitoring Setup

### Access Grafana

```bash
# Port-forward Grafana locally
kubectl port-forward svc/grafana 3001:3000 --namespace=retireops

# Access at http://localhost:3001
# Username: admin
# Password: (from GRAFANA_PASSWORD in .env)
```

### Pre-built Dashboards

1. **System Overview**
   - CPU/Memory usage per service
   - Request rate and latency
   - Error rates

2. **Application Metrics**
   - Projection calculation time
   - Monte Carlo performance
   - Queue depth

3. **Database Metrics**
   - Connection pool usage
   - Query performance
   - Slow queries

4. **Business Metrics**
   - Active users
   - Projections created
   - API usage by endpoint

### Set Up Alerts

```yaml
# alerting-rules.yml
groups:
  - name: retireops
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: 'High error rate detected'

      - alert: HighResponseTime
        expr: http_request_duration_seconds{quantile="0.95"} > 2
        for: 5m
        annotations:
          summary: '95th percentile response time > 2s'

      - alert: DatabaseConnectionPoolExhausted
        expr: database_connection_pool_size{state="idle"} < 2
        for: 2m
        annotations:
          summary: 'Database connection pool nearly exhausted'

      - alert: RedisMemoryHigh
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 5m
        annotations:
          summary: 'Redis memory usage > 90%'
```

---

## Backup & Recovery

### Automated Backups

**PostgreSQL Backups (included in docker-compose):**

```bash
# Manual backup
docker-compose exec postgres pg_dump -U retireops -Fc retireops > backups/backup_$(date +%Y%m%d).dump

# Restore from backup
docker-compose exec -T postgres pg_restore -U retireops -d retireops < backups/backup_20250115.dump
```

**For Production (RDS/Managed):**

- ✅ Automated daily snapshots (retained 7-30 days)
- ✅ Point-in-time recovery (within backup window)
- ✅ Cross-region replication (optional)

### Disaster Recovery Plan

1. **Database Failure:**
   - Restore from latest snapshot (RTO: 30 minutes)
   - Verify data integrity
   - Update DNS if failover to replica

2. **Complete Region Failure:**
   - Deploy to backup region (us-west-2)
   - Restore database from cross-region backup
   - Update DNS to new region
   - RTO: 2-4 hours

3. **Data Corruption:**
   - Restore from point-in-time backup
   - Replay transactions from transaction logs
   - RTO: 1-2 hours

### Backup Verification

```bash
# Weekly backup test (automated)
#!/bin/bash
BACKUP_FILE="backups/test_restore_$(date +%Y%m%d).dump"

# Create backup
pg_dump -U retireops -Fc retireops > $BACKUP_FILE

# Create test database
createdb -U retireops retireops_test

# Restore to test database
pg_restore -U retireops -d retireops_test $BACKUP_FILE

# Run integrity checks
psql -U retireops -d retireops_test -c "SELECT COUNT(*) FROM users;"
psql -U retireops -d retireops_test -c "SELECT COUNT(*) FROM projections;"

# Cleanup
dropdb -U retireops retireops_test
rm $BACKUP_FILE

echo "Backup verification complete"
```

---

## Scaling Guidelines

### When to Scale

| Metric               | Threshold        | Action                                 |
| -------------------- | ---------------- | -------------------------------------- |
| CPU Usage            | > 70% for 5+ min | Add web/API replicas                   |
| Memory Usage         | > 80%            | Increase container limits              |
| Response Time (p95)  | > 2 seconds      | Add workers                            |
| Database Connections | > 80% of max     | Increase pool size or add read replica |
| Queue Depth          | > 100 jobs       | Add worker replicas                    |
| Active Users         | > 5,000          | Scale horizontally                     |

### Horizontal Scaling (Add More Containers)

```bash
# Scale web servers
kubectl scale deployment retireops-web --replicas=5 --namespace=retireops

# Scale API servers
kubectl scale deployment retireops-api --replicas=5 --namespace=retireops

# Scale workers
kubectl scale deployment retireops-worker --replicas=10 --namespace=retireops
```

### Vertical Scaling (Increase Resources)

```yaml
# Edit deployment
kubectl edit deployment retireops-web --namespace=retireops

# Update resources
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1024Mi"
    cpu: "1000m"
```

### Auto-Scaling

```yaml
# kubernetes/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: retireops-web-hpa
  namespace: retireops
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: retireops-web
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
```

---

## Troubleshooting

### Common Issues

#### 1. Containers Won't Start

```bash
# Check logs
docker-compose logs [service-name]

# Check container status
docker-compose ps

# Restart specific service
docker-compose restart [service-name]

# Rebuild and restart
docker-compose up -d --build [service-name]
```

#### 2. Database Connection Errors

```bash
# Verify database is running
docker-compose exec postgres pg_isready

# Check connection from API
docker-compose exec api node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()').then(console.log).catch(console.error)"

# Check connection pool
docker-compose logs api | grep "database"
```

#### 3. Redis Connection Errors

```bash
# Test Redis
docker-compose exec redis redis-cli ping

# Check Redis memory
docker-compose exec redis redis-cli info memory

# Clear cache if needed
docker-compose exec redis redis-cli FLUSHALL
```

#### 4. High Memory Usage

```bash
# Check memory usage per container
docker stats

# Identify memory leaks
docker-compose logs api | grep "heap"

# Restart high-memory service
docker-compose restart api
```

#### 5. Slow Queries

```bash
# Enable slow query logging
docker-compose exec postgres psql -U retireops -c "ALTER SYSTEM SET log_min_duration_statement = 1000;"

# Check slow queries
docker-compose exec postgres tail -f /var/lib/postgresql/data/log/postgresql-*.log | grep "duration"

# Analyze query plan
docker-compose exec postgres psql -U retireops -d retireops -c "EXPLAIN ANALYZE SELECT ..."
```

### Performance Debugging

```bash
# CPU profiling (Node.js)
docker-compose exec api node --prof app.js

# Memory profiling
docker-compose exec api node --inspect=0.0.0.0:9229 app.js
# Then use Chrome DevTools

# Check for memory leaks
docker-compose exec api node --expose-gc --max-old-space-size=512 app.js
```

### Emergency Procedures

#### Rolling Back Deployment

```bash
# Kubernetes
kubectl rollout undo deployment/retireops-web --namespace=retireops

# Docker Compose
docker-compose down
git checkout previous-version-tag
docker-compose up -d --build
```

#### Database Corruption

```bash
# Stop all services
docker-compose stop api worker

# Enter maintenance mode
docker-compose exec postgres psql -U retireops -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'retireops' AND pid <> pg_backend_pid();"

# Run VACUUM FULL
docker-compose exec postgres psql -U retireops -d retireops -c "VACUUM FULL ANALYZE;"

# Restart services
docker-compose start api worker
```

---

## Post-Deployment Checklist

- [ ] All services running and healthy
- [ ] Database migrations applied
- [ ] SSL certificates configured
- [ ] DNS records updated
- [ ] Monitoring dashboards accessible
- [ ] Alerts configured and tested
- [ ] Backups running successfully
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Documentation updated
- [ ] Team trained on operations
- [ ] Incident response plan documented

---

## Maintenance Schedule

### Daily

- ✅ Check service health
- ✅ Review error logs
- ✅ Monitor performance metrics

### Weekly

- ✅ Review slow queries
- ✅ Check backup integrity
- ✅ Update dependencies (security patches)
- ✅ Review capacity metrics

### Monthly

- ✅ Security audit
- ✅ Performance optimization review
- ✅ Cost optimization review
- ✅ Disaster recovery drill

### Quarterly

- ✅ Major dependency updates
- ✅ Architecture review
- ✅ Capacity planning
- ✅ Security penetration testing

---

## Support & Resources

- **Documentation:** https://docs.retireops.com
- **Status Page:** https://status.retireops.com
- **Community:** https://community.retireops.com
- **Issues:** https://github.com/your-org/retireops/issues

---

**Last Updated:** 2025-12-15
**Version:** 1.0.0
