@echo off
title Workforce Zebra Yerel Yazdirma Servisi
color 0A
echo ========================================================
echo   Workforce Portal - Yerel Zebra Yazdirma Ajani (Agent)
echo ========================================================
echo.
echo   Sunucu Baglantisi: 192.168.3.5 veya Localhost
echo   Hedef Yazici: MIDAS_BARKOD
echo   Dinlenen Port: 9199
echo.
echo   Bu pencere acik oldugu surece portaldan tek tikla
echo   HICBIR PENCERE ACILMADAN dogrudan ZPL etiketi basilir.
echo ========================================================
echo.
node "%~dp0agent.js"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [HATA] Node.js calistirilamadi! Lutfen Node.js yuklu oldugundan emin olun.
    pause
)
