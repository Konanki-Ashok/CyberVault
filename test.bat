@echo off
title TrustVault - Security Test Suite
echo ========================================================
echo   Running TrustVault 19 Automated Security Tests...
echo ========================================================
cd backend
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --detectOpenHandles --forceExit
cd ..
pause
