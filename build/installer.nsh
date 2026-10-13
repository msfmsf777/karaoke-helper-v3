!include LogicLib.nsh
!include nsDialogs.nsh
!include MUI2.nsh

!ifndef nsProcess::FindProcess
  !include "nsProcess.nsh"
!endif

!ifndef EM_SETREADONLY
  !define EM_SETREADONLY 0x00CF
!endif


; -------------------------------------------------------------
; Multi-Language Strings (1033=en, 1028=zh_TW, 2052=zh_CN, 1041=ja, 1042=ko, 1057=id, 1054=th)
; -------------------------------------------------------------

; VC++ Redistributable Messages
LangString KHelperVcRuntimeInstalling 1033 "Installing Microsoft Visual C++ Redistributable..."
LangString KHelperVcRuntimeInstalling 1028 "正在安裝 Microsoft Visual C++ 可轉散發套件..."
LangString KHelperVcRuntimeInstalling 2052 "正在安装 Microsoft Visual C++ 可再发行组件..."
LangString KHelperVcRuntimeInstalling 1041 "Microsoft Visual C++ 再頒布可能パッケージをインストールしています..."
LangString KHelperVcRuntimeInstalling 1042 "Microsoft Visual C++ 재배포 가능 패키지를 설치하는 중..."
LangString KHelperVcRuntimeInstalling 1057 "Menginstal Microsoft Visual C++ Redistributable..."
LangString KHelperVcRuntimeInstalling 1054 "กำลังติดตั้ง Microsoft Visual C++ Redistributable..."

LangString KHelperVcRuntimeInstalled 1033 "Microsoft Visual C++ Redistributable is ready."
LangString KHelperVcRuntimeInstalled 1028 "Microsoft Visual C++ 可轉散發套件已就緒。"
LangString KHelperVcRuntimeInstalled 2052 "Microsoft Visual C++ 可再发行组件已就绪。"
LangString KHelperVcRuntimeInstalled 1041 "Microsoft Visual C++ 再頒布可能パッケージは準備完了しています。"
LangString KHelperVcRuntimeInstalled 1042 "Microsoft Visual C++ 재배포 가능 패키지가 준비되었습니다."
LangString KHelperVcRuntimeInstalled 1057 "Microsoft Visual C++ Redistributable sudah siap."
LangString KHelperVcRuntimeInstalled 1054 "Microsoft Visual C++ Redistributable พร้อมใช้งานแล้ว"

LangString KHelperVcRuntimeFailed 1033 "Microsoft Visual C++ Redistributable installer exited with code $0."
LangString KHelperVcRuntimeFailed 1028 "Microsoft Visual C++ 可轉散發套件安裝程式結束，代碼 $0。"
LangString KHelperVcRuntimeFailed 2052 "Microsoft Visual C++ 可再发行组件安装程序已退出，代码 $0。"
LangString KHelperVcRuntimeFailed 1041 "Microsoft Visual C++ 再頒布可能パッケージのインストーラーがコード $0 で終了しました。"
LangString KHelperVcRuntimeFailed 1042 "Microsoft Visual C++ 재배포 가능 패키지 설치 프로그램이 코드 $0로 종료되었습니다."
LangString KHelperVcRuntimeFailed 1057 "Penginstal Microsoft Visual C++ Redistributable keluar dengan kode $0."
LangString KHelperVcRuntimeFailed 1054 "ตัวติดตั้ง Microsoft Visual C++ Redistributable จบการทำงานด้วยรหัส $0"

; Installation Progress Messages
LangString KHelperInstallingSubtext 1033 "Extracting application files and AI runtime. This may take 1-2 minutes..."
LangString KHelperInstallingSubtext 1028 "正在解壓縮應用程式與 AI 執行環境，這可能需要 1 到 2 分鐘..."
LangString KHelperInstallingSubtext 2052 "正在解压应用程序与 AI 运行环境，这可能需要 1 到 2 分钟..."
LangString KHelperInstallingSubtext 1041 "アプリ本体と AI 実行環境を展開しています。1〜2分程度かかる場合があります..."
LangString KHelperInstallingSubtext 1042 "애플리케이션 파일 및 AI 실행 환경을 압축 해제하는 중입니다. 1~2분 정도 걸릴 수 있습니다..."
LangString KHelperInstallingSubtext 1057 "Mengekstrak file aplikasi dan runtime AI. Ini mungkin memakan waktu 1-2 menit..."
LangString KHelperInstallingSubtext 1054 "กำลังแตกไฟล์โปรแกรมและสภาพแวดล้อมรันไทม์ AI ขั้นตอนนี้อาจใช้เวลาประมาณ 1-2 นาที..."

LangString KHelperInstallingExtractingText 1033 "Extracting core files and separation engine..."
LangString KHelperInstallingExtractingText 1028 "正在解壓縮核心檔案與人聲分離引擎..."
LangString KHelperInstallingExtractingText 2052 "正在解压核心文件与人声分离引擎..."
LangString KHelperInstallingExtractingText 1041 "コアファイルとボーカル分離エンジンを展開しています..."
LangString KHelperInstallingExtractingText 1042 "핵심 파일 및 보컬 분리 엔진 압축 해제 중..."
LangString KHelperInstallingExtractingText 1057 "Mengekstrak file inti dan mesin pemisahan..."
LangString KHelperInstallingExtractingText 1054 "กำลังแตกไฟล์หลักและเอนจินแยกเสียงร้อง..."

; Active Process Warning
LangString KHelperRunningPrompt 1033 "KHelper is currently running. Would you like to close it cleanly to continue uninstalling?"
LangString KHelperRunningPrompt 1028 "KHelper 目前正在執行中。是否要立即關閉應用程式以繼續解除安裝？"
LangString KHelperRunningPrompt 2052 "KHelper 当前正在运行。是否要立即关闭应用程序以继续卸载？"
LangString KHelperRunningPrompt 1041 "KHelper は現在実行中です。アンインストールを続行するためにアプリを終了しますか？"
LangString KHelperRunningPrompt 1042 "KHelper가 현재 실행 중입니다. 제거를 계속 진행하기 위해 앱을 종료하시겠습니까?"
LangString KHelperRunningPrompt 1057 "KHelper sedang berjalan. Apakah Anda ingin menutupnya untuk melanjutkan pencopotan pemasangan?"
LangString KHelperRunningPrompt 1054 "KHelper กำลังทำงานอยู่ คุณต้องการปิดโปรแกรมเพื่อดำเนินการถอนการติดตั้งต่อหรือไม่?"

; Data Selection Page
LangString KHelperUnDataSelectTitle 1033 "Choose Data to Keep or Remove"
LangString KHelperUnDataSelectTitle 1028 "選擇要保留或刪除的資料"
LangString KHelperUnDataSelectTitle 2052 "选择要保留或删除的数据"
LangString KHelperUnDataSelectTitle 1041 "保持または削除するデータを選択"
LangString KHelperUnDataSelectTitle 1042 "보관 또는 삭제할 데이터 선택"
LangString KHelperUnDataSelectTitle 1057 "Pilih Data untuk Disimpan atau Dihapus"
LangString KHelperUnDataSelectTitle 1054 "เลือกข้อมูลที่จะเก็บไว้หรือลบออก"

LangString KHelperUnDataSelectSubtitle 1033 "Select which components to remove. You can open any folder to review its contents."
LangString KHelperUnDataSelectSubtitle 1028 "選取要刪除的項目。您可以開啟資料夾檢視內容。"
LangString KHelperUnDataSelectSubtitle 2052 "选取要删除的项目。您可以打开文件夹查看内容。"
LangString KHelperUnDataSelectSubtitle 1041 "削除する項目を選択します。フォルダを開いて内容を確認できます。"
LangString KHelperUnDataSelectSubtitle 1042 "삭제할 항목을 선택하십시오. 폴더를 열어 내용을 확인할 수 있습니다."
LangString KHelperUnDataSelectSubtitle 1057 "Pilih item yang ingin dihapus. Anda dapat membuka folder untuk memeriksa isinya."
LangString KHelperUnDataSelectSubtitle 1054 "เลือกรายการที่จะลบ คุณสามารถเปิดโฟลเดอร์เพื่อตรวจสอบเนื้อหาได้"

LangString KHelperUnItemApp 1033 "Core Program Files (Required)"
LangString KHelperUnItemApp 1028 "主程式檔案（必選）"
LangString KHelperUnItemApp 2052 "主程序文件（必选）"
LangString KHelperUnItemApp 1041 "メインプログラムファイル（必須）"
LangString KHelperUnItemApp 1042 "핵심 프로그램 파일 (필수)"
LangString KHelperUnItemApp 1057 "File Program Utama (Wajib)"
LangString KHelperUnItemApp 1054 "ไฟล์โปรแกรมหลัก (จำเป็น)"

LangString KHelperUnItemSongs 1033 "Song Library & Audio Stems (Keep recommended)"
LangString KHelperUnItemSongs 1028 "歌曲庫與分離音軌（建議保留）"
LangString KHelperUnItemSongs 2052 "歌曲库与分离音轨（建议保留）"
LangString KHelperUnItemSongs 1041 "楽曲ライブラリと音源ステム（保持を推奨）"
LangString KHelperUnItemSongs 1042 "곡 보관함 및 분리 트랙 (보관 권장)"
LangString KHelperUnItemSongs 1057 "Pustaka Lagu & Stem Audio (Disarankan simpan)"
LangString KHelperUnItemSongs 1054 "คลังเพลงและแทร็กเสียง (แนะนำให้เก็บไว้)"

LangString KHelperUnItemModels 1033 "AI Separation Models (~1.5 GB)"
LangString KHelperUnItemModels 1028 "AI 人聲分離模型（約 1.5 GB）"
LangString KHelperUnItemModels 2052 "AI 人声分离模型（约 1.5 GB）"
LangString KHelperUnItemModels 1041 "AI ボーカル分離モデル（約 1.5 GB）"
LangString KHelperUnItemModels 1042 "AI 보컬 분리 모델 (약 1.5 GB)"
LangString KHelperUnItemModels 1057 "Model Pemisahan AI (~1.5 GB)"
LangString KHelperUnItemModels 1054 "โมเดลการแยกเสียง AI (~1.5 GB)"

LangString KHelperUnItemRuntime 1033 "AI Separation Runtime (~3-5 GB)"
LangString KHelperUnItemRuntime 1028 "AI 人聲分離執行環境（約 3-5 GB）"
LangString KHelperUnItemRuntime 2052 "AI 人声分离运行环境（约 3-5 GB）"
LangString KHelperUnItemRuntime 1041 "AI ボーカル分離実行環境（約 3-5 GB）"
LangString KHelperUnItemRuntime 1042 "AI 보컬 분리 실행 환경 (약 3-5 GB)"
LangString KHelperUnItemRuntime 1057 "Runtime Pemisahan AI (~3-5 GB)"
LangString KHelperUnItemRuntime 1054 "สภาพแวดล้อมรันไทม์ AI (~3-5 GB)"

LangString KHelperUnItemSettings 1033 "User Settings, Playlists & History"
LangString KHelperUnItemSettings 1028 "使用者設定、播放清單與歷史紀錄"
LangString KHelperUnItemSettings 2052 "用户设置、播放列表与历史记录"
LangString KHelperUnItemSettings 1041 "設定・プレイリスト・履歴"
LangString KHelperUnItemSettings 1042 "사용자 설정, 재생목록 및 기록"
LangString KHelperUnItemSettings 1057 "Setelan, Daftar Putar & Riwayat"
LangString KHelperUnItemSettings 1054 "การตั้งค่า เพลย์ลิสต์ และประวัติการใช้งาน"

LangString KHelperUnBtnOpenFolder 1033 "Open Folder"
LangString KHelperUnBtnOpenFolder 1028 "開啟資料夾"
LangString KHelperUnBtnOpenFolder 2052 "打开文件夹"
LangString KHelperUnBtnOpenFolder 1041 "フォルダを開く"
LangString KHelperUnBtnOpenFolder 1042 "폴더 열기"
LangString KHelperUnBtnOpenFolder 1057 "Buka Folder"
LangString KHelperUnBtnOpenFolder 1054 "เปิดโฟลเดอร์"

LangString KHelperUnTipKeep 1033 "Tip: Unchecked items will remain intact on your computer."
LangString KHelperUnTipKeep 1028 "提示：未勾選的項目將會完整保留在您的電腦中。"
LangString KHelperUnTipKeep 2052 "提示：未勾选的项目将会完整保留在您的电脑中。"
LangString KHelperUnTipKeep 1041 "ヒント: チェックされていない項目はPC上にそのまま保持されます。"
LangString KHelperUnTipKeep 1042 "팁: 선택하지 않은 항목은 컴퓨터에 그대로 보관됩니다."
LangString KHelperUnTipKeep 1057 "Tips: Item yang tidak dicentang akan tetap tersimpan di komputer Anda."
LangString KHelperUnTipKeep 1054 "คำแนะนำ: รายการที่ไม่ได้เลือกจะยังคงอยู่ในคอมพิวเตอร์ของคุณ"

; Review Page
LangString KHelperUnReviewTitle 1033 "Review Deletion Summary"
LangString KHelperUnReviewTitle 1028 "確認解除安裝與刪除項目"
LangString KHelperUnReviewTitle 2052 "确认卸载与删除项目"
LangString KHelperUnReviewTitle 1041 "削除サマリーの確認"
LangString KHelperUnReviewTitle 1042 "삭제 요약 검토"
LangString KHelperUnReviewTitle 1057 "Tinjau Ringkasan Penghapusan"
LangString KHelperUnReviewTitle 1054 "ตรวจสอบสรุปการลบ"

LangString KHelperUnReviewSubtitle 1033 "Review the items that will be permanently removed versus kept:"
LangString KHelperUnReviewSubtitle 1028 "請檢視即將永久刪除與保留的項目："
LangString KHelperUnReviewSubtitle 2052 "请查看即将永久删除与保留的项目："
LangString KHelperUnReviewSubtitle 1041 "完全に削除される項目と保持される項目を確認してください:"
LangString KHelperUnReviewSubtitle 1042 "영구적으로 삭제될 항목과 보관될 항목을 검토하십시오:"
LangString KHelperUnReviewSubtitle 1057 "Periksa item yang akan dihapus permanen dan yang disimpan:"
LangString KHelperUnReviewSubtitle 1054 "ตรวจสอบรายการที่จะถูกลบถาวรเปรียบเทียบกับรายการที่เก็บไว้:"

LangString KHelperUnReviewWarning 1033 "WARNING: Items marked for deletion CANNOT be recovered!"
LangString KHelperUnReviewWarning 1028 "警告：標記為刪除的資料一旦刪除將無法復原！"
LangString KHelperUnReviewWarning 2052 "警告：标记为删除的数据一旦删除将无法恢复！"
LangString KHelperUnReviewWarning 1041 "警告: 削除対象として選択されたデータは復元できません！"
LangString KHelperUnReviewWarning 1042 "경고: 삭제 대상으로 표시된 데이터는 복구할 수 없습니다!"
LangString KHelperUnReviewWarning 1057 "PERINGATAN: Item yang ditandai untuk dihapus TIDAK DAPAT dipulihkan!"
LangString KHelperUnReviewWarning 1054 "คำเตือน: ข้อมูลที่เลือกให้ลบจะไม่สามารถกู้คืนได้!"

LangString KHelperUnReviewDeleteSection 1033 "=== ITEMS TO BE PERMANENTLY DELETED ==="
LangString KHelperUnReviewDeleteSection 1028 "=== 即將永久刪除的項目 ==="
LangString KHelperUnReviewDeleteSection 2052 "=== 即将永久删除的项目 ==="
LangString KHelperUnReviewDeleteSection 1041 "=== 完全に削除される項目 ==="
LangString KHelperUnReviewDeleteSection 1042 "=== 영구적으로 삭제될 항목 ==="
LangString KHelperUnReviewDeleteSection 1057 "=== ITEM YANG AKAN DIHAPUS PERMANEN ==="
LangString KHelperUnReviewDeleteSection 1054 "=== รายการที่จะถูกลบอย่างถาวร ==="

LangString KHelperUnReviewKeepSection 1033 "=== ITEMS TO BE KEPT INTACT ==="
LangString KHelperUnReviewKeepSection 1028 "=== 將會完整保留的項目 ==="
LangString KHelperUnReviewKeepSection 2052 "=== 将会完整保留的项目 ==="
LangString KHelperUnReviewKeepSection 1041 "=== そのまま保持される項目 ==="
LangString KHelperUnReviewKeepSection 1042 "=== 그대로 보관될 항목 ==="
LangString KHelperUnReviewKeepSection 1057 "=== ITEM YANG TETAP DISIMPAN ==="
LangString KHelperUnReviewKeepSection 1054 "=== รายการที่จะถูกเก็บไว้ ==="

; -------------------------------------------------------------
; Installer Macros & Functions
; -------------------------------------------------------------

!macro customInit
  ; Let fresh-install users choose a supported language without interrupting in-app updates.
  ${IfNot} ${isUpdated}
    !insertmacro MUI_LANGDLL_DISPLAY
  ${EndIf}
!macroend

!ifndef BUILD_UNINSTALLER

Function KHelperInstFilesShow
  ${If} $mui.Header.SubText != 0
    SendMessage $mui.Header.SubText ${WM_SETTEXT} 0 "STR:$(KHelperInstallingSubtext)"
  ${EndIf}
  FindWindow $0 "#32770" "" $HWNDPARENT
  ${If} $0 != 0
    GetDlgItem $1 $0 1006
    ${If} $1 != 0
      SendMessage $1 ${WM_SETTEXT} 0 "STR:$(KHelperInstallingExtractingText)"
    ${EndIf}
  ${EndIf}
FunctionEnd

!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW KHelperInstFilesShow
!macroend

!endif

!macro customFinishPage
  Function KHelperLaunchInstalledApp
    ${If} ${isUpdated}
      StrCpy $1 "--updated"
    ${Else}
      StrCpy $1 ""
    ${EndIf}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  Function KHelperFinishPagePre
    ${If} ${isUpdated}
      Call KHelperLaunchInstalledApp
      Quit
    ${EndIf}
  FunctionEnd

  !define MUI_PAGE_CUSTOMFUNCTION_PRE KHelperFinishPagePre
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "KHelperLaunchInstalledApp"
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customInstall
  SetRegView 64
  ClearErrors
  ; Check if 64-bit VC runtime is installed and inspect build number
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ReadRegDWORD $1 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Bld"

  ; Install if missing or build is older than bundled runtime (14.44.35211)
  ${If} ${Errors}
  ${OrIf} $0 != 1
  ${OrIf} $1 < 35211
    FindWindow $2 "#32770" "" $HWNDPARENT
    ${If} $2 != 0
      GetDlgItem $3 $2 1006
      ${If} $3 != 0
        SendMessage $3 ${WM_SETTEXT} 0 "STR:$(KHelperVcRuntimeInstalling)"
      ${EndIf}
    ${EndIf}
    SetDetailsPrint textonly
    DetailPrint "$(KHelperVcRuntimeInstalling)"
    ExecWait '"$INSTDIR\resources\bin\VC_redist.x64.exe" /install /passive /norestart' $0
    ; 0 = Success, 3010 = Reboot required (success), 1638 = Newer version already installed (success)
    ${If} $0 != 0
    ${AndIf} $0 != 3010
    ${AndIf} $0 != 1638
      DetailPrint "$(KHelperVcRuntimeFailed)"
    ${Else}
      DetailPrint "$(KHelperVcRuntimeInstalled)"
    ${EndIf}
    FindWindow $2 "#32770" "" $HWNDPARENT
    ${If} $2 != 0
      GetDlgItem $3 $2 1006
      ${If} $3 != 0
        SendMessage $3 ${WM_SETTEXT} 0 "STR:$(KHelperVcRuntimeInstalled)"
      ${EndIf}
    ${EndIf}
  ${Else}
    DetailPrint "$(KHelperVcRuntimeInstalled)"
  ${EndIf}

  ; Delete temporary installer payload from permanent installation directory to save 25.6 MB
  Delete "$INSTDIR\resources\bin\VC_redist.x64.exe"

  SetRegView lastused
!macroend

; -------------------------------------------------------------
; Uninstaller Macros & Functions
; -------------------------------------------------------------

!ifdef BUILD_UNINSTALLER

!define NSD_CreateTextMultiline "nsDialogs::CreateControl EDIT ${DEFAULT_STYLES}|${WS_TABSTOP}|${WS_VSCROLL}|${ES_MULTILINE}|${ES_AUTOVSCROLL}|${ES_READONLY} ${WS_EX_WINDOWEDGE}|${WS_EX_CLIENTEDGE}"

; Global state variables for uninstaller data selection
Var unDeleteSongs
Var unDeleteModels
Var unDeleteRuntime
Var unDeleteSettings
Var unSongsDir
Var unModelsDir
Var unRuntimeDir
Var unSettingsDir
Var unDialog
Var unChkSongs
Var unChkModels
Var unChkRuntime
Var unChkSettings
Var unTxtReview

Var unStrNeedle
Var unStrHaystack
Var unStrContains1
Var unStrContains2
Var unStrContains3
Var unStrContains4
Var unStrReturn

Function un.StrContains
  Exch $unStrNeedle
  Exch 1
  Exch $unStrHaystack
    StrCpy $unStrReturn ""
    StrCpy $unStrContains1 -1
    StrLen $unStrContains2 $unStrNeedle
    StrLen $unStrContains4 $unStrHaystack
    loop:
      IntOp $unStrContains1 $unStrContains1 + 1
      StrCpy $unStrContains3 $unStrHaystack $unStrContains2 $unStrContains1
      StrCmp $unStrContains3 $unStrNeedle found
      StrCmp $unStrContains1 $unStrContains4 done
      Goto loop
    found:
      StrCpy $unStrReturn $unStrNeedle
      Goto done
    done:
   Pop $unStrNeedle
   Exch $unStrReturn
FunctionEnd

!macro _unStrContainsConstructor OUT NEEDLE HAYSTACK
  Push `${HAYSTACK}`
  Push `${NEEDLE}`
  Call un.StrContains
  Pop `${OUT}`
!macroend

!define un.StrContains '!insertmacro "_unStrContainsConstructor"'

Function un.ExtractJsonPath
  Exch $0 ; line
  Push $1 ; index
  Push $2 ; char
  Push $3 ; state: 0=before ':', 1=before opening '"', 2=inside value
  Push $4 ; result
  StrCpy $3 0
  StrCpy $4 ""
  StrCpy $1 0

  extractLoop:
    StrCpy $2 $0 1 $1
    StrCmp $2 "" extractEnd
    IntOp $1 $1 + 1

    ${If} $3 == 0
      ${If} $2 == ":"
        StrCpy $3 1
      ${EndIf}
    ${ElseIf} $3 == 1
      ${If} $2 == '"'
        StrCpy $3 2
      ${EndIf}
    ${ElseIf} $3 == 2
      ${If} $2 == '"'
        Goto extractEnd
      ${ElseIf} $2 == "\"
        StrCpy $2 $0 1 $1
        ${If} $2 == "\"
          IntOp $1 $1 + 1
        ${EndIf}
        StrCpy $4 "$4\"
      ${Else}
        StrCpy $4 "$4$2"
      ${EndIf}
    ${EndIf}
    Goto extractLoop

  extractEnd:
    StrCpy $0 $4
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Exch $0
FunctionEnd

Function un.OnOpenAppDir
  Pop $0
  ExecShell "open" "$INSTDIR"
FunctionEnd

Function un.OnOpenSongsDir
  Pop $0
  ${If} ${FileExists} "$unSongsDir\*.*"
    ExecShell "open" "$unSongsDir"
  ${Else}
    ExecShell "open" "$APPDATA\khelper-live"
  ${EndIf}
FunctionEnd

Function un.OnOpenModelsDir
  Pop $0
  ${If} ${FileExists} "$unModelsDir\*.*"
    ExecShell "open" "$unModelsDir"
  ${Else}
    ExecShell "open" "$APPDATA\khelper-live"
  ${EndIf}
FunctionEnd

Function un.OnOpenRuntimeDir
  Pop $0
  ${If} ${FileExists} "$unRuntimeDir\*.*"
    ExecShell "open" "$unRuntimeDir"
  ${Else}
    ExecShell "open" "$APPDATA\khelper-live"
  ${EndIf}
FunctionEnd

Function un.OnOpenSettingsDir
  Pop $0
  ExecShell "open" "$unSettingsDir"
FunctionEnd

Function un.PageDataSelection
  !insertmacro MUI_HEADER_TEXT "$(KHelperUnDataSelectTitle)" "$(KHelperUnDataSelectSubtitle)"
  nsDialogs::Create 1018
  Pop $unDialog
  ${If} $unDialog == error
    Abort
  ${EndIf}

  ; Item 1: App (required, checked, disabled)
  ${NSD_CreateCheckbox} 10u 4u 220u 12u "$(KHelperUnItemApp)"
  Pop $0
  ${NSD_Check} $0
  EnableWindow $0 0
  ${NSD_CreateButton} 235u 2u 55u 14u "$(KHelperUnBtnOpenFolder)"
  Pop $0
  ${NSD_OnClick} $0 un.OnOpenAppDir

  ; Item 2: Song Library (unchecked by default)
  ${NSD_CreateCheckbox} 10u 26u 220u 12u "$(KHelperUnItemSongs)"
  Pop $unChkSongs
  ${If} $unDeleteSongs == "1"
    ${NSD_Check} $unChkSongs
  ${EndIf}
  ${NSD_CreateButton} 235u 24u 55u 14u "$(KHelperUnBtnOpenFolder)"
  Pop $0
  ${NSD_OnClick} $0 un.OnOpenSongsDir

  ; Item 3: AI Models (unchecked by default)
  ${NSD_CreateCheckbox} 10u 48u 220u 12u "$(KHelperUnItemModels)"
  Pop $unChkModels
  ${If} $unDeleteModels == "1"
    ${NSD_Check} $unChkModels
  ${EndIf}
  ${NSD_CreateButton} 235u 46u 55u 14u "$(KHelperUnBtnOpenFolder)"
  Pop $0
  ${NSD_OnClick} $0 un.OnOpenModelsDir

  ; Item 4: AI Separation Runtime (unchecked by default)
  ${NSD_CreateCheckbox} 10u 70u 220u 12u "$(KHelperUnItemRuntime)"
  Pop $unChkRuntime
  ${If} $unDeleteRuntime == "1"
    ${NSD_Check} $unChkRuntime
  ${EndIf}
  ${NSD_CreateButton} 235u 68u 55u 14u "$(KHelperUnBtnOpenFolder)"
  Pop $0
  ${NSD_OnClick} $0 un.OnOpenRuntimeDir

  ; Item 5: Settings & Playlists (unchecked by default)
  ${NSD_CreateCheckbox} 10u 92u 220u 12u "$(KHelperUnItemSettings)"
  Pop $unChkSettings
  ${If} $unDeleteSettings == "1"
    ${NSD_Check} $unChkSettings
  ${EndIf}
  ${NSD_CreateButton} 235u 90u 55u 14u "$(KHelperUnBtnOpenFolder)"
  Pop $0
  ${NSD_OnClick} $0 un.OnOpenSettingsDir

  ; Tip label at bottom
  ${NSD_CreateLabel} 10u 118u 280u 16u "$(KHelperUnTipKeep)"
  Pop $0

  nsDialogs::Show
FunctionEnd

Function un.PageDataSelectionLeave
  ${NSD_GetState} $unChkSongs $unDeleteSongs
  ${NSD_GetState} $unChkModels $unDeleteModels
  ${NSD_GetState} $unChkRuntime $unDeleteRuntime
  ${NSD_GetState} $unChkSettings $unDeleteSettings
FunctionEnd

Function un.PageConfirmReview
  !insertmacro MUI_HEADER_TEXT "$(KHelperUnReviewTitle)" "$(KHelperUnReviewSubtitle)"
  nsDialogs::Create 1018
  Pop $unDialog
  ${If} $unDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 10u 2u 280u 14u "$(KHelperUnReviewWarning)"
  Pop $0

  ; Build review summary
  StrCpy $0 "$(KHelperUnReviewDeleteSection)$\r$\n"
  StrCpy $0 "$0 - $(KHelperUnItemApp): $INSTDIR$\r$\n"
  ${If} $unDeleteSongs == "1"
    StrCpy $0 "$0 - $(KHelperUnItemSongs): $unSongsDir$\r$\n"
  ${EndIf}
  ${If} $unDeleteModels == "1"
    StrCpy $0 "$0 - $(KHelperUnItemModels): $unModelsDir$\r$\n"
  ${EndIf}
  ${If} $unDeleteRuntime == "1"
    StrCpy $0 "$0 - $(KHelperUnItemRuntime): $unRuntimeDir$\r$\n"
  ${EndIf}
  ${If} $unDeleteSettings == "1"
    StrCpy $0 "$0 - $(KHelperUnItemSettings): $unSettingsDir$\r$\n"
  ${EndIf}

  StrCpy $0 "$0$\r$\n$(KHelperUnReviewKeepSection)$\r$\n"
  ${If} $unDeleteSongs != "1"
    StrCpy $0 "$0 - $(KHelperUnItemSongs): $unSongsDir$\r$\n"
  ${EndIf}
  ${If} $unDeleteModels != "1"
    StrCpy $0 "$0 - $(KHelperUnItemModels): $unModelsDir$\r$\n"
  ${EndIf}
  ${If} $unDeleteRuntime != "1"
    StrCpy $0 "$0 - $(KHelperUnItemRuntime): $unRuntimeDir$\r$\n"
  ${EndIf}
  ${If} $unDeleteSettings != "1"
    StrCpy $0 "$0 - $(KHelperUnItemSettings): $unSettingsDir$\r$\n"
  ${EndIf}

  ${NSD_CreateTextMultiline} 10u 18u 280u 115u "$0"
  Pop $unTxtReview
  SendMessage $unTxtReview ${EM_SETREADONLY} 1 0

  nsDialogs::Show
FunctionEnd

Function un.PageConfirmReviewLeave
FunctionEnd

!endif

!macro customUnInit
  ; 1. Check if application is running and offer clean termination
  ${nsProcess::FindProcess} "KHelperV3.exe" $0
  ${If} $0 == 0
    ${If} ${Cmd} `MessageBox MB_YESNO|MB_ICONEXCLAMATION "$(KHelperRunningPrompt)" IDYES`
      ${nsProcess::CloseProcess} "KHelperV3.exe" $0
      Sleep 1000
      ${nsProcess::FindProcess} "KHelperV3.exe" $0
      ${If} $0 == 0
        ${nsProcess::KillProcess} "KHelperV3.exe" $0
        Sleep 500
      ${EndIf}
    ${Else}
      Quit
    ${EndIf}
  ${EndIf}
  ${nsProcess::Unload}

  ; 2. Default target locations
  StrCpy $unSongsDir "$APPDATA\khelper-live\KHelperLive\songs"
  StrCpy $unRuntimeDir "$APPDATA\khelper-live\separation-runtime"
  StrCpy $unModelsDir "$APPDATA\khelper-live\models"
  StrCpy $unSettingsDir "$APPDATA\khelper-live"

  ; 3. Inspect settings.json for preferred language and custom paths
  IfFileExists "$APPDATA\khelper-live\settings.json" 0 settingsDone
  FileOpen $R0 "$APPDATA\khelper-live\settings.json" r
  ${If} $R0 != 0
    readLoop:
      FileRead $R0 $R1
      IfErrors readDone
      ${un.StrContains} $R2 '"language"' $R1
      ${If} $R2 != ""
        ${un.StrContains} $R2 '"zh-TW"' $R1
        ${If} $R2 != ""
          StrCpy $LANGUAGE 1028
        ${EndIf}
        ${un.StrContains} $R2 '"zh-CN"' $R1
        ${If} $R2 != ""
          StrCpy $LANGUAGE 2052
        ${EndIf}
        ${un.StrContains} $R2 '"ja"' $R1
        ${If} $R2 != ""
          StrCpy $LANGUAGE 1041
        ${EndIf}
        ${un.StrContains} $R2 '"ko"' $R1
        ${If} $R2 != ""
          StrCpy $LANGUAGE 1042
        ${EndIf}
        ${un.StrContains} $R2 '"id"' $R1
        ${If} $R2 != ""
          StrCpy $LANGUAGE 1057
        ${EndIf}
        ${un.StrContains} $R2 '"th"' $R1
        ${If} $R2 != ""
          StrCpy $LANGUAGE 1054
        ${EndIf}
        ${un.StrContains} $R2 '"en"' $R1
        ${If} $R2 != ""
          StrCpy $LANGUAGE 1033
        ${EndIf}
      ${EndIf}
      ${un.StrContains} $R2 '"customSongsPath"' $R1
      ${If} $R2 != ""
        Push $R1
        Call un.ExtractJsonPath
        Pop $R2
        ${If} $R2 != ""
          StrCpy $unSongsDir $R2
        ${EndIf}
      ${EndIf}
      ${un.StrContains} $R2 '"customRuntimePath"' $R1
      ${If} $R2 != ""
        Push $R1
        Call un.ExtractJsonPath
        Pop $R2
        ${If} $R2 != ""
          StrCpy $unRuntimeDir $R2
        ${EndIf}
      ${EndIf}
      Goto readLoop
    readDone:
      FileClose $R0
  ${EndIf}
  settingsDone:
!macroend

!macro customUnWelcomePage
  !insertmacro MUI_UNPAGE_WELCOME
  UninstPage custom un.PageDataSelection un.PageDataSelectionLeave
  UninstPage custom un.PageConfirmReview un.PageConfirmReviewLeave
!macroend

!macro customUnInstall
  ${If} $unDeleteSongs == "1"
    RMDir /r "$unSongsDir"
  ${EndIf}
  ${If} $unDeleteModels == "1"
    RMDir /r "$unModelsDir"
  ${EndIf}
  ${If} $unDeleteRuntime == "1"
    RMDir /r "$unRuntimeDir"
  ${EndIf}
  ${If} $unDeleteSettings == "1"
    RMDir /r "$unSettingsDir"
  ${EndIf}
!macroend
