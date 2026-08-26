@echo off
echo Dastur serveri ishga tushirilmoqda...
start http://localhost:8000
python -m http.server 8000
