#!/usr/bin/env python3
"""
Python Script to email the Kubernetes & Containerization Report to baburajnk19@gmail.com
Usage:
    python scripts/send_k8s_report_email.py --sender "contact@trikonekt.com" --password "your_smtp_password"
"""

import sys
import os
import argparse
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_report(smtp_user, smtp_pass, recipient="baburajnk19@gmail.com"):
    subject = "Trikonekt: Complete Kubernetes & Containerization Migration Report"
    
    report_body = """
====================================================================
 TRIKONEKT: KUBERNETES & CONTAINERIZATION MIGRATION REPORT
 Target Recipient: baburajnk19@gmail.com
====================================================================

Dear Baburaj,

Below is the complete step-by-step implementation guide, code changes,
and educational cloud terminology curriculum for containerizing Trikonekt
and deploying it on Kubernetes (AWS EKS / K8s).

--------------------------------------------------------------------
1. CLOUD TERMINOLOGY CURRICULUM (EDUCATIONAL)
--------------------------------------------------------------------

• Docker Image: A read-only blueprint package containing your application
  code, system dependencies, and runtime environment.
  Example: trikonekt-backend:latest

• Container: A lightweight, isolated running instance of a Docker Image.

• Container Registry (AWS ECR): A secure cloud locker for storing and versioning
  your Docker Images before deploying to Kubernetes.

• Pod: The smallest deployable unit in Kubernetes. A Pod wraps one (or more)
  Docker containers.
  Example: trikonekt-backend-pod (Django WSGI server).

• Deployment (K8s): A Kubernetes manager that ensures a specified number
  of Pod replicas (e.g., 2 replicas) are always alive, healthy, and auto-healed.

• Service (K8s Service): An internal stable IP address/DNS name that load balances
  requests across a group of active Pods.

• Ingress Controller: The public-facing entry gateway that routes incoming internet
  traffic (growth.vin / api.growth.vin) to the appropriate Pod Services.

• ConfigMap & Secret: Kubernetes objects for injecting environment variables
  (ConfigMap) and encrypted keys/passwords (Secret) into Pods safely.

--------------------------------------------------------------------
2. CODE CHANGES & FILES CREATED IN WORKSPACE
--------------------------------------------------------------------

The following files have been created in your repository:

1. backend/Dockerfile
   - Multi-stage Python 3.11 container running Django with Gunicorn.

2. frontend/Dockerfile & frontend/nginx.conf
   - Multi-stage Node 18 + Nginx Alpine image for building and serving React UI.

3. tri-consumer/tri-consumer/backend/Dockerfile
   - Multi-stage Maven + JDK 17 Spring Boot Java container.

4. k8s/01-namespace.yaml
   - Kubernetes namespace definitions for trikonekt-prod and trikonekt-staging.

5. k8s/02-configmap-secrets.yaml
   - Configuration settings and secrets management for Kubernetes.

6. k8s/03-backend-deployment.yaml
   - Deployment (2 replicas) and ClusterIP Service for Django API.

7. k8s/04-worker-deployment.yaml
   - Background worker Deployment running python manage.py process_tasks.

8. k8s/05-frontend-deployment.yaml
   - Deployment (2 replicas) and ClusterIP Service for React Frontend.

9. k8s/06-ingress.yaml
   - Nginx Ingress routing growth.vin to Frontend Pods and api.growth.vin to Backend Pods.

--------------------------------------------------------------------
3. STEP-BY-STEP IMPLEMENTATION ROADMAP
--------------------------------------------------------------------

Step 1: Build Docker Images Locally / on CI:
  docker build -t trikonekt-backend ./backend
  docker build -t trikonekt-frontend ./frontend

Step 2: Push Images to AWS ECR:
  aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <aws-account-id>.dkr.ecr.ap-south-1.amazonaws.com
  docker tag trikonekt-backend:latest <aws-account-id>.dkr.ecr.ap-south-1.amazonaws.com/trikonekt-backend:latest
  docker push <aws-account-id>.dkr.ecr.ap-south-1.amazonaws.com/trikonekt-backend:latest

Step 3: Deploy to Kubernetes Cluster:
  kubectl apply -f k8s/

Step 4: Verify Deployment Status:
  kubectl get pods -n trikonekt-prod
  kubectl get ingress -n trikonekt-prod

--------------------------------------------------------------------
Report generated automatically by Antigravity AI Coding Assistant.
"""

    msg = MIMEMultipart()
    msg['From'] = smtp_user
    msg['To'] = recipient
    msg['Subject'] = subject
    msg.attach(MIMEText(report_body, 'plain'))

    try:
        print(f"Connecting to Zoho SMTP (smtp.zoho.com:587)...")
        server = smtplib.SMTP('smtp.zoho.com', 587)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        print(f"✅ Success! Report successfully emailed to {recipient}")
    except Exception as e:
        print(f"❌ Error sending email: {e}")
        print("\nNote: You can also read the complete report directly in your workspace artifact!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Send Kubernetes report to email")
    parser.add_argument("--sender", default="contact@trikonekt.com", help="SMTP user email")
    parser.add_argument("--password", required=False, help="SMTP password")
    args = parser.parse_args()

    if not args.password:
        print("Report summary ready! To dispatch email, provide your SMTP password:")
        print("  python scripts/send_k8s_report_email.py --sender contact@trikonekt.com --password <YOUR_PASSWORD>")
    else:
        send_report(args.sender, args.password)
