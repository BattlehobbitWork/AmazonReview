@echo off
set PATH=C:\Users\hobbi\AppData\Local\Programs\Python\Python312;C:\Users\hobbi\AppData\Local\Programs\Python\Python312\Scripts;%PATH%
cd /d "%~dp0"
uvicorn app.main:app --reload --port 8000
