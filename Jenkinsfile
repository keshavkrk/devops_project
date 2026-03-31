pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    timestamps()
  }

  environment {
    CI = 'true'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm ci'
          } else {
            bat 'npm ci'
          }
        }
      }
    }

    stage('Lint') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm run lint'
          } else {
            bat 'npm run lint'
          }
        }
      }
    }

    stage('Build') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm run build'
          } else {
            bat 'npm run build'
          }
        }
      }
    }

    stage('Deploy to Azure VM') {
      when {
        expression {
          return isUnix() && env.DEPLOY_ROOT?.trim()
        }
      }

      steps {
        sh 'bash scripts/deploy-static-site.sh'
      }
    }
  }

  post {
    success {
      archiveArtifacts artifacts: 'dist/**', fingerprint: true
      script {
        if (isUnix() && env.DEPLOY_ROOT?.trim()) {
          echo "Deployment target updated at ${env.DEPLOY_ROOT}/current"
        }
      }
    }
    always {
      echo "Pipeline finished: ${currentBuild.currentResult}"
    }
  }
}
