@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MAGXDXTR - Push website to GitHub

rem ------------------------------------------------------------
rem  Repo that holds THIS WEBSITE (create it first on github.com/new)
rem ------------------------------------------------------------
set "REPO=https://github.com/xypherbypass-ctrl/MAGXDXTR-ADMIN-PORTAL.git"
if defined PUSH_REPO set "REPO=%PUSH_REPO%"

echo ============================================================
echo    MAGXDXTR  -  push website source to GitHub
echo ============================================================
echo.

set "GIT=git"
where git >nul 2>nul && goto :git_ok
set "GIT="
if exist "%ProgramFiles%\Git\cmd\git.exe" set "GIT=%ProgramFiles%\Git\cmd\git.exe"
if not defined GIT if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" set "GIT=%ProgramFiles(x86)%\Git\cmd\git.exe"
if not defined GIT if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "GIT=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
if not defined GIT (
    echo ERROR: Git not found. Install Git first, then re-run.
    goto :end_fail
)

:git_ok
"%GIT%" --version >nul 2>nul || goto :fail_git

rem ---- identity (repo-local, so commits always work) ----
"%GIT%" config user.name "xypherbypass-ctrl" >nul 2>nul
"%GIT%" config user.email "xypherbypass-ctrl@users.noreply.github.com" >nul 2>nul

rem ---- init / remote ----
if not exist ".git" (
    echo Initializing repository...
    "%GIT%" init >nul
    "%GIT%" symbolic-ref HEAD refs/heads/main >nul 2>nul
    "%GIT%" remote add origin "%REPO%" >nul 2>nul
) else (
    "%GIT%" remote set-url origin "%REPO%" >nul 2>nul
)

rem ---- stage everything (node_modules / .next excluded by .gitignore) ----
"%GIT%" add -A
"%GIT%" diff --cached --quiet >nul 2>nul
if not errorlevel 1 (
    echo Nothing new to commit.
) else (
    echo Committing...
    "%GIT%" commit -m "Update portal %DATE% %TIME%" >nul
    if errorlevel 1 goto :fail_commit
)

rem ---- sync with remote then push ----
"%GIT%" fetch origin >nul 2>nul
"%GIT%" show-ref --verify --quiet refs/remotes/origin/main
if not errorlevel 1 (
    echo Syncing with remote...
    "%GIT%" pull --rebase --autostash origin main
)

echo.
echo Pushing to GitHub...
"%GIT%" push -u origin HEAD:main
if errorlevel 1 goto :fail_push

echo.
echo ============================================================
echo    DONE  -  website source pushed
echo ============================================================
echo    Repo : %REPO%
echo    Next : import it at vercel.com/new  ->  Deploy
echo.
if defined NOPAUSE (exit /b 0) else (pause & exit /b 0)

:fail_git
echo ERROR: Git is not working.
goto :end_fail

:fail_commit
echo ERROR: Commit failed (check git config user.name / user.email).
goto :end_fail

:fail_push
echo.
echo ERROR: Push failed.
echo    - Create the repo first: github.com/new  ->  MAGXDXTR-ADMIN-PORTAL
echo    - If asked for credentials: username + password = GitHub token
echo      (github.com/settings/tokens, scope: repo)
echo    - Then re-run this file.
goto :end_fail

:end_fail
echo.
if defined NOPAUSE (exit /b 1) else (pause & exit /b 1)