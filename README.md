# Sprint: Khushboo Khan's portfolio chatbot

Sprint is an AI assistant that answers questions about Khushboo Khan's projects, tools, experience and education. It uses the OpenRouter API.

- **Backend:** Python 3.11.9, Flask
- **Frontend:** HTML, CSS, JavaScript (no build step)
- **Editor:** Visual Studio Code

```
khushboo-chatbot/
├── app.py                 Flask server, OpenRouter call, streaming
├── data/portfolio.json    Everything Sprint knows (edit this)
├── static/
│   ├── index.html
│   ├── css/style.css      Theme colors are variables at the top
│   └── js/script.js
├── requirements.txt
├── .env.example
└── .vscode/launch.json    Press F5 to run
```

## Setup in VS Code (Windows)

1. Install **Python 3.11.9** from python.org and tick "Add python.exe to PATH".
2. Open the `khushboo-chatbot` folder in VS Code (File > Open Folder).
3. Install the **Python** extension by Microsoft.
4. Open a terminal in VS Code (Ctrl + `) and run:

   ```powershell
   py -3.11 -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

   If PowerShell blocks the activate script, run
   `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, then try again.
   On macOS or Linux use `python3.11 -m venv .venv` and `source .venv/bin/activate`.

5. Press **Ctrl+Shift+P**, choose **Python: Select Interpreter**, and pick the one inside `.venv`.
6. Get a free key at https://openrouter.ai/keys.
7. Copy `.env.example` to `.env` and paste your key:

   ```
   OPENROUTER_API_KEY=sk-or-...
   ```

8. Press **F5** (or run `python app.py`) and open http://127.0.0.1:5000.

## Customizing

| What | Where |
| --- | --- |
| Bio, projects, skills, experience, education | `data/portfolio.json` |
| Real email and LinkedIn link | `contact` in `data/portfolio.json` |
| Suggested questions on the welcome screen | `chatbot.suggestions` in `data/portfolio.json` |
| Bot name | `chatbot.name` in `data/portfolio.json` |
| Colors and fonts | variables at the top of `static/css/style.css` |
| AI model | `OPENROUTER_MODEL` in `.env` |

Restart the server after editing `portfolio.json` or `.env`.

**Contact details:** your portfolio still shows `youremail@example.com` and a generic LinkedIn link. Sprint ignores placeholders, so it will not give visitors fake contact details. Replace them in `portfolio.json` and Sprint will start sharing them.

**Models:** browse https://openrouter.ai/models. Models ending in `:free` cost nothing, but free models change and can be rate limited. If you see a "model is not available" message, pick another model id.

## How it works

1. The browser sends the recent conversation to `/api/chat`.
2. Flask adds a system prompt built from `portfolio.json` and calls OpenRouter with streaming on.
3. Tokens are passed back to the browser as they arrive, so replies appear word by word.

The API key lives only in `.env` on the server. It is never sent to the browser. The server also limits message length, trims history to the last 10 messages, and rate limits each IP to 20 requests a minute.

## Troubleshooting

| Message | Fix |
| --- | --- |
| No API key found | Create `.env` (not `.env.example`) and restart |
| API key was rejected | Re-copy the key from OpenRouter |
| Out of credits | Add credits or use a `:free` model |
| Model is not available | Change `OPENROUTER_MODEL` |
| Model is busy | Free models get rate limited. Wait and retry |

Check http://127.0.0.1:5000/api/health to confirm the server sees your key and model.

## Deploying

Do not host this on Netlify. Netlify serves static files only, and this project needs a Python server. Render, Railway or PythonAnywhere work. Set `OPENROUTER_API_KEY` as an environment variable there, use `pip install -r requirements.txt` as the build command, and run it with `gunicorn app:app` (add `gunicorn` to `requirements.txt`). To place it on your portfolio, link to the deployed URL or embed it in an iframe.
