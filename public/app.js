function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

async function deriveKeyFromPassword(password, salt) {
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

async function createSecret() {
    const text = document.getElementById('message').value;
    const ttl = document.getElementById('ttl').value;
    const maxUses = document.getElementById('maxUses').value;
    const password = document.getElementById('passwordInput').value;
    const fileInput = document.getElementById('fileInput');
    const btn = document.getElementById('generateBtn');
    const spinner = document.getElementById('spinner');
    const btnText = document.getElementById('btnText');
    const progressBar = document.getElementById('progressBar');
    const progressContainer = document.getElementById('progressContainer');

    if (!text && fileInput.files.length === 0) {
        showToast(t("index.toast.noContent"), "error");
        return;
    }

    if (fileInput.files.length > 0 && fileInput.files[0].size > 10 * 1024 * 1024) {
        showToast(t("index.toast.fileTooLarge"), "error");
        return;
    }

    btn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.innerText = t("common.processing");
    progressContainer.style.display = 'block';
    progressBar.style.width = '10%';

    try {
        let key;
        let saltBase64 = null;

        if (password) {
            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            saltBase64 = arrayBufferToBase64(salt);

            key = await deriveKeyFromPassword(password, salt);
        } else {
            key = await window.crypto.subtle.generateKey(
                { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
            );
        }

        progressBar.style.width = '30%';

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        let encryptedFile = null;
        let fileName = null;
        let fileType = null;

        const encodedText = new TextEncoder().encode(text || " ");
        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, key, encodedText
        );

        progressBar.style.width = '50%';

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            fileName = file.name;
            fileType = file.type;

            const fileBuffer = await file.arrayBuffer();
            const encryptedFileBuffer = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv }, key, fileBuffer
            );
            encryptedFile = arrayBufferToBase64(encryptedFileBuffer);
        }

        progressBar.style.width = '70%';

        const exportedKey = await window.crypto.subtle.exportKey("raw", key);
        const keyBase64 = arrayBufferToBase64(exportedKey);

        const response = await fetch('/api/store', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                encryptedData: arrayBufferToBase64(encryptedContent),
                iv: arrayBufferToBase64(iv),
                ttl: parseInt(ttl),
                maxUses: parseInt(maxUses),
                encryptedFile,
                fileName,
                fileType,
                salt: saltBase64,
                authType: password ? 'password' : 'link'
            })
        });

        progressBar.style.width = '100%';

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || t("index.toast.serverError"));

        let url;
        if (password) {
            url = `${window.location.origin}/view#${data.id}`;
        } else {
            url = `${window.location.origin}/view#${data.id}:${keyBase64}`;
        }

        showModal(url);
        showToast(t("index.toast.linkGenerated"));

    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
    } finally {
        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.innerText = t("index.generateBtn");
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
        }, 2000);
    }
}

function showModal(url) {
    const modalOverlay = document.getElementById('linkModal');
    const linkText = document.getElementById('finalLink');

    linkText.innerText = url;
    generateQR(url);

    modalOverlay.style.display = 'flex';

    void modalOverlay.offsetWidth;
    modalOverlay.classList.add('show');
}

function closeModal() {
    const modalOverlay = document.getElementById('linkModal');
    modalOverlay.classList.remove('show');
    setTimeout(() => {
        modalOverlay.style.display = 'none';
    }, 300);
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

function copyLink() {
    const linkText = document.getElementById('finalLink').innerText;
    copyTextToClipboard(linkText).then(() => {
        showToast(t("index.toast.linkCopied"));
    }).catch(err => {
        showToast(t("index.toast.copyError"), "error");
    });
}

function sendEmail() {
    const linkText = document.getElementById('finalLink').innerText;
    const subject = t("index.email.subject");
    const body = t("index.email.body", { link: linkText });

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function generateQR(url) {
    const container = document.getElementById('qrCodeContainer');
    container.innerHTML = '';
    new QRCode(container, {
        text: url,
        width: 150,
        height: 150,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileName');

    if (!dropZone || !fileInput) {
        console.error("Critical elements not found!");
        return;
    }

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    document.getElementById('generateBtn').addEventListener('click', createSecret);
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('modalCopyBtn').addEventListener('click', copyLink);
    document.getElementById('emailBtn').addEventListener('click', sendEmail);

    document.getElementById('linkModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('linkModal')) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('linkModal');
            if (modal && modal.classList.contains('show')) {
                closeModal();
            }
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            fileNameDisplay.innerText = t("index.fileSelected", { fileName: fileInput.files[0].name });
        } else {
            fileNameDisplay.innerText = '';
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            if (fileInput.files.length > 0) {
                fileNameDisplay.innerText = t("index.fileSelected", { fileName: fileInput.files[0].name });
            }
        }
    });
});
