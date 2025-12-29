!macro customInstall
  DetailPrint "Installing Visual C++ Redistributable..."
  ExecWait '"$INSTDIR\resources\bin\VC_redist.x64.exe" /install /passive /norestart'
!macroend
