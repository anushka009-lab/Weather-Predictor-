@echo off
echo Starting Wireless Weather Station Server...
echo Please leave this window open! If you close it, the website will go offline.
echo.
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)
python main.py
pause
