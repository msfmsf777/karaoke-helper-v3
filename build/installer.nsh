!include LogicLib.nsh

LangString KHelperVcRuntimeInstalling 1033 "Installing Microsoft Visual C++ Redistributable..."
LangString KHelperVcRuntimeInstalling 1028 "正在安裝 Microsoft Visual C++ 可轉散發套件..."
LangString KHelperVcRuntimeInstalling 2052 "正在安装 Microsoft Visual C++ 可再发行组件..."
LangString KHelperVcRuntimeInstalling 1041 "Microsoft Visual C++ 再頒布可能パッケージをインストールしています..."
LangString KHelperVcRuntimeInstalling 1042 "Microsoft Visual C++ 재배포 가능 패키지를 설치하는 중..."
LangString KHelperVcRuntimeInstalling 1057 "Menginstal Microsoft Visual C++ Redistributable..."
LangString KHelperVcRuntimeInstalling 1054 "กำลังติดตั้ง Microsoft Visual C++ Redistributable..."

LangString KHelperVcRuntimeInstalled 1033 "Microsoft Visual C++ Redistributable is already installed."
LangString KHelperVcRuntimeInstalled 1028 "Microsoft Visual C++ 可轉散發套件已安裝。"
LangString KHelperVcRuntimeInstalled 2052 "Microsoft Visual C++ 可再发行组件已安装。"
LangString KHelperVcRuntimeInstalled 1041 "Microsoft Visual C++ 再頒布可能パッケージは既にインストールされています。"
LangString KHelperVcRuntimeInstalled 1042 "Microsoft Visual C++ 재배포 가능 패키지가 이미 설치되어 있습니다."
LangString KHelperVcRuntimeInstalled 1057 "Microsoft Visual C++ Redistributable sudah terinstal."
LangString KHelperVcRuntimeInstalled 1054 "ติดตั้ง Microsoft Visual C++ Redistributable ไว้แล้ว"

LangString KHelperVcRuntimeFailed 1033 "Microsoft Visual C++ Redistributable installer exited with code $0."
LangString KHelperVcRuntimeFailed 1028 "Microsoft Visual C++ 可轉散發套件安裝程式結束，代碼 $0。"
LangString KHelperVcRuntimeFailed 2052 "Microsoft Visual C++ 可再发行组件安装程序已退出，代码 $0。"
LangString KHelperVcRuntimeFailed 1041 "Microsoft Visual C++ 再頒布可能パッケージのインストーラーがコード $0 で終了しました。"
LangString KHelperVcRuntimeFailed 1042 "Microsoft Visual C++ 재배포 가능 패키지 설치 프로그램이 코드 $0로 종료되었습니다."
LangString KHelperVcRuntimeFailed 1057 "Penginstal Microsoft Visual C++ Redistributable keluar dengan kode $0."
LangString KHelperVcRuntimeFailed 1054 "ตัวติดตั้ง Microsoft Visual C++ Redistributable จบการทำงานด้วยรหัส $0"

!macro customInstall
  SetRegView 64
  ClearErrors
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"

  ${If} ${Errors}
  ${OrIf} $0 != 1
    DetailPrint "$(KHelperVcRuntimeInstalling)"
    ExecWait '"$INSTDIR\resources\bin\VC_redist.x64.exe" /install /passive /norestart' $0
    ${If} $0 != 0
      DetailPrint "$(KHelperVcRuntimeFailed)"
    ${EndIf}
  ${Else}
    DetailPrint "$(KHelperVcRuntimeInstalled)"
  ${EndIf}

  SetRegView lastused
!macroend
