const base64ToArrayBuffer = (base64) => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

let globalData = null;
let globalId = null;
let attempts = 0;
const MAX_ATTEMPTS = 3;

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    }
    return fallbackCopyText(text);
}

function fallbackCopyText(text) {
    return new Promise((resolve, reject) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                resolve();
            } else {
                reject(new Error('Copy command failed'));
            }
        } catch (err) {
            reject(err);
        } finally {
            textArea.remove();
        }
    });
}

function copyContent() {
    const text = document.getElementById('messageArea').innerText;
    copyTextToClipboard(text).then(() => {
        showToast(t("view.toast.contentCopied"));
    }).catch(() => {
        showToast(t("view.toast.copyError"), "error");
    });
}

async function deriveKeyFromPassword(password, saltBase64) {
    const salt = base64ToArrayBuffer(saltBase64);
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

async function decryptMessage() {
    const btn = document.getElementById('decryptBtn');
    const msgArea = document.getElementById('messageArea');

    try {
        btn.disabled = true;
        btn.innerText = t("common.processing");

        const hash = window.location.hash.substring(1);
        if (!hash) throw new Error(t("view.errors.invalidLink"));

        const parts = hash.split(':');
        globalId = parts[0];
        const keyInUrl = parts[1];

        const response = await fetch(`/api/retrieve/${globalId}`);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            if (response.status === 410) throw new Error(t("view.errors.messageDeleted"));
            throw new Error(errData.error || t("view.errors.decryptError"));
        }

        globalData = await response.json();

        if (globalData.authType === 'password') {
            const modal = document.getElementById('passwordModal');
            modal.style.display = 'flex';
            void modal.offsetWidth;
            modal.classList.add('show');
            btn.disabled = false;
            btn.innerText = t("view.decryptBtn");
            return;
        } else {
            if (!keyInUrl) throw new Error(t("view.errors.missingKey"));
            const key = await window.crypto.subtle.importKey(
                "raw", base64ToArrayBuffer(keyInUrl), "AES-GCM", true, ["decrypt"]
            );
            await performDecryption(key);
        }

    } catch (error) {
        handleError(error);
    }
}

async function handlePasswordSubmit() {
    const password = document.getElementById('unlockPassword').value;
    const attemptsDisplay = document.getElementById('attemptsDisplay');

    if (!password) {
        showToast(t("view.toast.passwordRequired"), "error");
        return;
    }

    try {
        const key = await deriveKeyFromPassword(password, globalData.salt);

        const { encryptedData, iv } = globalData;
        await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: base64ToArrayBuffer(iv) },
            key,
            base64ToArrayBuffer(encryptedData)
        );

        document.getElementById('passwordModal').style.display = 'none';
        await performDecryption(key);

    } catch (error) {
        attempts++;
        const remaining = MAX_ATTEMPTS - attempts;

        if (remaining <= 0) {
            globalData = null;
            document.getElementById('passwordModal').style.display = 'none';
            handleError(new Error(t("view.passwordModal.maxAttemptsExceeded")));
            return;
        }

        attemptsDisplay.innerText = t("view.passwordModal.incorrectAttempts", { remaining });
        showToast(t("view.toast.passwordIncorrect", { remaining }), "warning");
    }
}

async function performDecryption(key) {
    const { encryptedData, iv, encryptedFile, fileName, fileType } = globalData;
    const btn = document.getElementById('decryptBtn');
    const msgArea = document.getElementById('messageArea');

    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToArrayBuffer(iv) },
        key,
        base64ToArrayBuffer(encryptedData)
    );

    const text = new TextDecoder().decode(decrypted);

    msgArea.style.display = 'block';
    msgArea.innerText = text;
    btn.style.display = 'none';
    document.getElementById('copyBtn').style.display = 'inline-block';

    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = '';
    qrContainer.style.display = 'block';
    new QRCode(qrContainer, {
        text: window.location.href,
        width: 100,
        height: 100
    });

    if (encryptedFile) {
        try {
            const decryptedFile = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: base64ToArrayBuffer(iv) },
                key,
                base64ToArrayBuffer(encryptedFile)
            );

            const fileBlob = new Blob([decryptedFile], { type: fileType });
            const fileUrl = URL.createObjectURL(fileBlob);

            const fileArea = document.getElementById('fileArea');
            const nameDisplay = document.getElementById('fileNameDisplay');
            const downloadBtn = document.getElementById('downloadBtn');

            fileArea.style.display = 'block';
            nameDisplay.innerText = fileName;

            // Update file attached text safely with translation
            const fileAttachedText = document.getElementById('fileAttachedText');
            if (fileAttachedText) {
                const prefix = t("view.fileAttached", { fileName: '' }).replace(/<[^>]*>?/gm, '');
                fileAttachedText.innerHTML = `📎 <strong>${prefix.replace('📎', '').trim()}</strong> <span id="fileNameDisplay"></span>`;
                const display = document.getElementById('fileNameDisplay');
                if (display) display.textContent = fileName;
            }

            downloadBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = fileUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };

        } catch (e) {
            console.error(t("view.errors.fileDecryptError"), e);
            showToast(t("view.toast.fileDecryptError"), "error");
        }
    }
}

function handleError(error) {
    const msgArea = document.getElementById('messageArea');
    const btn = document.getElementById('decryptBtn');

    msgArea.style.display = 'block';
    msgArea.style.borderColor = 'var(--error)';
    msgArea.style.background = 'rgba(255, 77, 77, 0.05)';
    msgArea.textContent = '';
    const span = document.createElement('span');
    span.className = 'error';
    span.textContent = error.message;
    msgArea.appendChild(span);

    btn.innerText = t("view.errors.accessError");
    btn.style.backgroundColor = "var(--error)";
    btn.style.color = "white";
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('unlockBtn').addEventListener('click', handlePasswordSubmit);
    document.getElementById('decryptBtn').addEventListener('click', decryptMessage);
    document.getElementById('copyBtn').addEventListener('click', copyContent);

    const unlockPassword = document.getElementById('unlockPassword');
    if (unlockPassword) {
        unlockPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handlePasswordSubmit();
            }
        });
    }
});
