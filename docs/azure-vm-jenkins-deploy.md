# Azure VM + Jenkins + GitHub Webhook Deployment

This project is a good fit for a simple VM-based deployment:

`GitHub push -> GitHub webhook -> Jenkins on Azure VM -> npm ci -> lint -> build -> deploy dist/ on the same VM`

For this app, that lets you remove `ngrok` completely.

## Recommended shape

- Azure VM: Ubuntu 22.04 LTS
- Jenkins: runs on the VM
- Nginx: serves the built frontend and reverse-proxies Jenkins
- GitHub webhook: points directly to the Azure VM
- App hosting: static files from `/var/www/resume-analyzer-vanilla/current`

## Why this is better than ngrok

- The webhook target stays stable after VM creation
- Jenkins no longer depends on a temporary tunnel URL
- The built site is hosted directly on Azure
- Your existing GitHub -> Jenkins flow stays the same

## 1. Create the Azure VM

In Azure Portal:

1. Create a Linux VM, preferably Ubuntu 22.04 LTS.
2. Use a region allowed by your Azure student subscription.
3. Assign a public IP.
4. Allow inbound ports:
   - `22` for SSH
   - `80` for the site and webhook traffic
   - `443` later if you add HTTPS
5. Do not expose `8080` publicly if you use Nginx as the reverse proxy.

## 2. Install Jenkins, Node.js, and Nginx on the VM

SSH into the VM and install the tools you need. Follow the current Jenkins Linux installation guide from Jenkins documentation for the exact repository and package steps.

Also install:

- Node.js 22
- Nginx
- Git

## 3. Prepare the site directories

```bash
sudo mkdir -p /var/www/resume-analyzer-vanilla/releases
sudo chown -R jenkins:jenkins /var/www/resume-analyzer-vanilla
```

If the `jenkins` user/group differs on your VM, adjust that command.

## 4. Configure Jenkins to run behind `/jenkins`

If you want one public IP for both the app and Jenkins, use:

- App: `http://<azure-public-ip>/`
- Jenkins: `http://<azure-public-ip>/jenkins/`
- GitHub webhook URL: `http://<azure-public-ip>/jenkins/github-webhook/`

Set the Jenkins prefix so the reverse proxy path works correctly.

For a systemd-based Jenkins install, add:

```bash
Environment="JENKINS_PREFIX=/jenkins"
```

to the Jenkins service override, then reload and restart Jenkins.

## 5. Configure Nginx

This repo includes a sample config at:

- `deploy/nginx-resume-analyzer.conf`

Copy it into Nginx, enable it, test the config, and reload Nginx.

The config does two things:

- serves the deployed frontend from `/var/www/resume-analyzer-vanilla/current`
- proxies `/jenkins/` to local Jenkins on port `8080`

## 6. Keep your Jenkins job model the same

Continue using the same pipeline job pattern:

- SCM: your GitHub repository
- Branch: `*/main`
- Script path: `Jenkinsfile`
- Trigger: `GitHub hook trigger for GITScm polling`

The change is only the Jenkins host location: local machine -> Azure VM.

## 7. Add the deploy path in Jenkins

In Jenkins job configuration, add an environment variable:

- `DEPLOY_ROOT=/var/www/resume-analyzer-vanilla`

What happens after that:

1. Jenkins builds `dist/`
2. `scripts/deploy-static-site.sh` creates a timestamped release
3. Jenkins updates `/var/www/resume-analyzer-vanilla/current`
4. Nginx serves the new build immediately

## 8. Update the GitHub webhook

In GitHub repository settings:

- Payload URL: `http://<azure-public-ip>/jenkins/github-webhook/`
- Content type: `application/json`
- Event: `Just the push event`

This replaces the old `ngrok` URL.

## 9. Notes for a static Vite app

- This app does not need a backend service to stay running
- Jenkins only needs to build and copy static files
- Nginx serves the built site efficiently

## 10. Optional next improvements

- Add a domain name and HTTPS with Let's Encrypt
- Add a separate Jenkins subdomain instead of `/jenkins`
- Add a rollback script that repoints `current` to an older release
