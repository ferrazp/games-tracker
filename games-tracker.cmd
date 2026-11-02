@echo off
rem Acceso directo de Games Tracker: menu para levantar/bajar Prod, QA y Dev.
title Games Tracker
cd /d "%~dp0"
node deploy\scripts\menu.mjs
