@echo off
echo =============================================
echo  Starting GrabResolve AI - Full System
echo =============================================

echo.
echo Starting AI Engine (Port 8000)...
cd ai-engine
start /B cmd /c "python main.py"
cd ..

timeout /t 3 /nobreak >nul

echo.
echo Starting Backend (Port 5000)...
cd backend
start /B cmd /c "node server.js"
cd ..

timeout /t 2 /nobreak >nul

echo.
echo Starting Frontend (Port 3000)...
cd frontend
start /B cmd /c "npm start"
cd ..

echo.
echo =============================================
echo  All services started!
echo =============================================
echo  AI Engine:  http://localhost:8000
echo  Backend:    http://localhost:5000
echo  Frontend:   http://localhost:3000
echo  API Docs:   http://localhost:8000/docs
echo =============================================
echo.
pause