# 📁 FileShare

> Instant, zero-signup file sharing with a 6-digit code and QR code.  
> Built with **Python / Flask** — runs on your local machine or any server.

---

## Table of Contents

- [Features](#-features)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Production Deployment](#-production-deployment)
- [API Reference](#-api-reference)
- [Configuration](#️-configuration)
- [Security Notes](#-security-notes)
- [Dependencies](#-dependencies)
- [License](#-license)

---

## ✨ Features

| | Feature |
|---|---|
| 🖱️ | **Drag & Drop Upload** — any file type, up to 20 files at once |
| 🔑 | **6-Digit Share Code** — unique alphanumeric code per upload |
| 📷 | **QR Code** — scannable link for instant mobile access |
| ⬇️ | **Instant Download** — enter the code or scan; no account needed |
| 🗜️ | **Auto-Zip** — multiple files are bundled into a `.zip` on download |
| ⏱️ | **Auto-Expiry** — all files are deleted automatically after 1 hour |
| 👁️ | **Live Preview** — file details appear as you type the code |
| 🚀 | **Production Ready** — ships with a `wsgi.py` entry point for Gunicorn |

---

## 🗂️ Project Structure

```
File-Share/
├── app.py                   # Flask backend — routes, QR generation, cleanup
├── wsgi.py                  # WSGI entry point for production (Gunicorn / uWSGI)
├── requirements.txt         # Pinned Python dependencies
├── templates/
│   └── index.html           # Single-page UI (Upload + Download tabs)
├── static/
│   ├── css/
│   │   └── style.css        # Monochrome dark design system & animations
│   └── js/
│       └── app.js           # Drag-drop, code boxes, XHR upload logic
├── uploads/                 # Temporary file storage (auto-created & cleaned)
├── venv/                    # Python virtual environment (not committed)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Python **3.8+**
- `pip` (comes with Python)

---

### Step 1 — Clone / enter the project directory

```bash
cd /path/to/File-Share
```

### Step 2 — Create and activate a virtual environment

```bash
# Create
python3 -m venv venv

# Activate (Linux / macOS)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate
```

### Step 3 — Install dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Run the development server

```bash
python app.py
```

### Step 5 — Open in browser

| Location | URL |
|----------|-----|
| Local machine | `http://127.0.0.1:5000` |
| Local network (other devices) | `http://<your-local-ip>:5000` |

> **Tip:** The local network URL lets phones on the same Wi-Fi scan the QR code and download files directly.

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serves the main UI |
| `POST` | `/upload` | Upload files; returns `code`, `qr_code` (base64 PNG), `files[]`, `expires_in` |
| `GET` | `/download?code=XXXXXX` | Download file, or auto-zip if multiple files |
| `GET` | `/check?code=XXXXXX` | Validate a code; returns file list & seconds until expiry |

### Example — Upload response

```json
{
  "code": "A3F9KZ",
  "qr_code": "data:image/png;base64,iVBOR...",
  "files": ["report.pdf", "photo.jpg"],
  "expires_in": 3600
}
```

### Example — Check response

```json
{
  "valid": true,
  "files": ["report.pdf", "photo.jpg"],
  "expires_in": 2943
}
```

---

## ⚙️ Configuration

### `app.py`

| Constant | Default | Description |
|----------|---------|-------------|
| `EXPIRY_SECONDS` | `3600` | File retention time in seconds (1 hour) |
| `UPLOAD_FOLDER` | `./uploads` | Directory for temporary storage |

### `static/js/app.js`

| Constant | Default | Description |
|----------|---------|-------------|
| `MAX_FILES` | `20` | Maximum files per upload session |
| `MAX_SIZE_MB` | `100` | Maximum size per file (MB) |

---

## 🛡️ Security Notes

> ⚠️ Always use a production WSGI server (Gunicorn / uWSGI) + Nginx in front when exposing to the internet.

Additional hardening recommendations:

- Set `UPLOAD_FOLDER` to a path **outside** the web root
- Add file-type allow-listing if you need to restrict uploads
- Add rate limiting (e.g. **Flask-Limiter**) to prevent abuse
- Enable HTTPS via **Let's Encrypt / Certbot** with your Nginx config
- Consider authentication if you want to restrict who can upload

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `Flask` | 3.1.3 | Web framework & routing |
| `Werkzeug` | 3.1.8 | WSGI utilities (used by Flask) |
| `gunicorn` | 23.0.0 | Production WSGI server |
| `qrcode` | 8.2 | QR code generation |
| `Pillow` | 12.2.0 | Image rendering for QR codes |
| `Jinja2` | 3.1.6 | HTML templating (used by Flask) |
| `click` | 8.3.3 | CLI utilities (used by Flask) |
| `itsdangerous` | 2.2.0 | Secure token signing (used by Flask) |
| `blinker` | 1.9.0 | Signal support (used by Flask) |
| `MarkupSafe` | 3.0.3 | Safe HTML escaping (used by Jinja2) |

Install all at once:

```bash
pip install -r requirements.txt
```

---

## 📄 License

MIT — free to use, modify, and distribute.
