@echo off
rem Builds the release into dist\:
rem   dist\Wiggle-My-Image-Animator\              the release folder (app + guide, readme, LICENSE, promo)
rem   dist\Wiggle-My-Image-Animator.zip           that folder zipped (the downloadable release)
rem   dist\Wiggle-My-Image-Animator_itch-web.zip  just the app with index.html at the top level,
rem                                               for itch.io's "played in the browser" upload
rem Needs Windows 10 or later (uses the built-in tar to make the zips).
setlocal
cd /d "%~dp0"
set NAME=Wiggle-My-Image-Animator
set OUT=dist\%NAME%
rem Windows' own tar (bsdtar) makes real zips; a GNU tar earlier on PATH would not.
set TAR="%SystemRoot%\System32\tar.exe"

if exist dist rmdir /s /q dist
mkdir "%OUT%" || goto :fail

for %%f in (index.html style.css app.js guide.md readme.md LICENSE) do (
  copy /y "%%f" "%OUT%\" >nul || goto :fail
)
xcopy /e /i /q /y lib "%OUT%\lib" >nul || goto :fail
xcopy /e /i /q /y promo "%OUT%\promo" >nul || goto :fail

%TAR% -a -c -f "dist\%NAME%.zip" -C dist "%NAME%" || goto :fail
%TAR% -a -c -f "dist\%NAME%_itch-web.zip" -C "%OUT%" index.html style.css app.js LICENSE lib || goto :fail

echo.
echo Done:
dir /b dist
exit /b 0

:fail
echo.
echo Build failed.
exit /b 1
