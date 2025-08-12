#!/bin/bash

# MaxBreak Railway Deployment Script
echo "🚀 MaxBreak Railway Deployment"
echo "=============================="

# Navigate to Django directory
cd maxBreak

echo "📋 Current deployment files:"
ls -la Procfile runtime.txt requirements.txt

echo ""
echo "🔧 Setting Railway environment variables..."
railway variables set DJANGO_SETTINGS_MODULE=maxBreak.production
railway variables set DEBUG=False
railway variables set RAILWAY_ENVIRONMENT=production

echo ""
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "⏳ Waiting for deployment to complete..."
echo "Check the Railway dashboard for build logs"
echo ""
echo "After deployment succeeds, run:"
echo "railway run python manage.py railway_init --quick"