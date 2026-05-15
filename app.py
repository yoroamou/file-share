import os
import io
import random
import string
import time
import threading
import base64
import zipfile
from flask import Flask, request, jsonify, send_file, render_template, abort
import qrcode

app = Flask(__name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# In-memory store: code -> { files: [{filename, path}], expires_at }
file_store = {}
store_lock = threading.Lock()

EXPIRY_SECONDS = 3600  # 1 hour


def generate_code():
    """Generate a unique 6-digit alphanumeric code."""
    chars = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(chars, k=6))
        with store_lock:
            if code not in file_store:
                return code


def cleanup_expired():
    """Background thread: delete expired entries and their files."""
    while True:
        time.sleep(60)
        now = time.time()
        with store_lock:
            expired = [c for c, v in file_store.items() if v['expires_at'] < now]
            for code in expired:
                for f in file_store[code]['files']:
                    try:
                        os.remove(f['path'])
                    except FileNotFoundError:
                        pass
                del file_store[code]


cleaner = threading.Thread(target=cleanup_expired, daemon=True)
cleaner.start()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload():
    uploaded_files = request.files.getlist('files')
    if not uploaded_files or all(f.filename == '' for f in uploaded_files):
        return jsonify({'error': 'No files provided'}), 400

    code = generate_code()
    code_dir = os.path.join(UPLOAD_FOLDER, code)
    os.makedirs(code_dir, exist_ok=True)

    saved = []
    for f in uploaded_files:
        if f.filename == '':
            continue
        safe_name = os.path.basename(f.filename)
        dest = os.path.join(code_dir, safe_name)
        # Handle duplicate filenames
        base, ext = os.path.splitext(safe_name)
        counter = 1
        while os.path.exists(dest):
            dest = os.path.join(code_dir, f"{base}_{counter}{ext}")
            counter += 1
        f.save(dest)
        saved.append({'filename': os.path.basename(dest), 'path': dest})

    if not saved:
        return jsonify({'error': 'No valid files uploaded'}), 400

    with store_lock:
        file_store[code] = {
            'files': saved,
            'expires_at': time.time() + EXPIRY_SECONDS
        }

    # Generate QR code pointing to the download URL
    download_url = request.host_url.rstrip('/') + f'/download?code={code}'
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(download_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#6C63FF", back_color="white")

    buf = io.BytesIO()
    # Access the underlying PIL Image to avoid qrcode's PyPNGImage stub conflict
    img.get_image().save(buf, format='PNG')
    buf.seek(0)
    qr_b64 = base64.b64encode(buf.read()).decode()

    filenames = [f['filename'] for f in saved]
    return jsonify({
        'code': code,
        'qr_code': f'data:image/png;base64,{qr_b64}',
        'files': filenames,
        'expires_in': EXPIRY_SECONDS
    })


@app.route('/download', methods=['GET'])
def download():
    code = request.args.get('code', '').strip().upper()
    if not code:
        abort(400)
    with store_lock:
        entry = file_store.get(code)
    if not entry:
        abort(404)
    if time.time() > entry['expires_at']:
        abort(410)  # Gone

    files = entry['files']

    if len(files) == 1:
        path = files[0]['path']
        filename = files[0]['filename']
        return send_file(path, as_attachment=True, download_name=filename)
    else:
        # Multiple files → zip them on the fly
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            for f in files:
                zf.write(f['path'], f['filename'])
        buf.seek(0)
        return send_file(
            buf,
            as_attachment=True,
            download_name=f'fileshare_{code}.zip',
            mimetype='application/zip'
        )


@app.route('/check', methods=['GET'])
def check():
    """Check if a code is valid without downloading."""
    code = request.args.get('code', '').strip().upper()
    with store_lock:
        entry = file_store.get(code)
    if not entry or time.time() > entry['expires_at']:
        return jsonify({'valid': False}), 404
    filenames = [f['filename'] for f in entry['files']]
    remaining = int(entry['expires_at'] - time.time())
    return jsonify({'valid': True, 'files': filenames, 'expires_in': remaining})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
