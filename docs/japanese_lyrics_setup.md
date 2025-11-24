# Japanese Lyrics Enrichment Setup

To enable Furigana and Romaji generation, you need to install the required Python packages into the bundled Python runtime.

## Prerequisites

- Ensure the application is closed.
- Open a terminal in the project root.

## Installation Steps

1.  Navigate to the project root.
2.  Run the following command to install dependencies into the bundled Python environment:

    ```powershell
    & "resources/python-runtime/python.exe" -m pip install -r resources/lyrics/requirements.txt
    ```

    Or if you are using the system python (dev mode):

    ```powershell
    pip install -r resources/lyrics/requirements.txt
    ```

    **Note:** The application uses the bundled runtime at `resources/python-runtime/python.exe` by default in production. In development, it might use the system python or the one in `resources/python-runtime` depending on your setup. The `electron/pythonRuntime.ts` logic prefers `resources/python-runtime/python.exe` if it exists.

## Verification

1.  Start the application.
2.  Play a Japanese song (ensure it has lyrics).
3.  Enter "Stream Mode" (Live Mode).
4.  Look for the "あ" (Furigana) and "a" (Romaji) buttons in the bottom-right of the lyrics area.
5.  Toggle them to see the enriched lyrics.

## Troubleshooting

-   **Buttons don't appear:** The lyrics might not be detected as Japanese. Ensure the lyrics contain Kana/Kanji.
-   **Enrichment fails:** Check the console logs for "Enrichment failed". It might be due to missing Python packages or an error in the Python script.
-   **Performance:** The first time you enable it for a song, there might be a slight delay. Subsequent toggles should be instant.
