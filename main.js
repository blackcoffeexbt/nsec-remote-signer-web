import { bytesToHex } from '@noble/hashes/utils';
import * as NostrTools from 'nostr-tools';

// Make necessary functions available to the global scope
window.connectESP32 = connectESP32;
window.sendData = sendData;
window.resetConfiguration = resetConfiguration;
window.updateDerivedKeys = updateDerivedKeys;
window.togglePasswordVisibility = togglePasswordVisibility;
window.handleModalConfirm = handleModalConfirm;
window.closeAlertModal = closeAlertModal;

let port;
let writer;
let reader;

async function connectESP32() {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        writer = port.writable.getWriter();
        reader = port.readable.getReader();
        document.getElementById("status").innerText = "Connected to device.";
        // Hide the connection overlay
        document.getElementById("connectionOverlay").classList.add("hidden");

        // Show loading spinner
        document.getElementById("loadingSpinner").classList.remove("hidden");

        // Wait for 1 second to show the loading animation
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Hide loading spinner and load configuration
        document.getElementById("loadingSpinner").classList.add("hidden");
        await loadConfig();
    } catch (error) {
        console.error("Error connecting to device:", error);
        document.getElementById("status").innerText = "Failed to connect. Try refreshing the page and connecting again.";
    }
}

// Add these new modal-related functions
let modalResolve = null;

function showConfirmationModal(title, message) {
    document.getElementById('confirmationMessageTitle').innerHTML = title;
    document.getElementById('confirmationMessageContent').innerHTML = message;
    document.getElementById('confirmationModal').classList.remove('hidden');
    return new Promise(resolve => {
        modalResolve = resolve;
    });
}

function handleModalConfirm(confirmed) {
    document.getElementById('confirmationModal').classList.add('hidden');
    if (modalResolve) {
        modalResolve(confirmed);
        modalResolve = null;
    }
}

function showAlertModal(message) {
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertModal').classList.remove('hidden');
}

function closeAlertModal() {
    document.getElementById('alertModal').classList.add('hidden');
}

async function sendData() {
    if (!writer) {
        document.getElementById("status").innerText = "Device not connected. Try refreshing the page and connecting again.";
        return;
    }

    const confirmed = await showConfirmationModal(
        "Upload Configuration",
        "Are you sure you want to upload these configuration values? This will overwrite any existing values you have saved to your device"
    );

    if (!confirmed) return;

    const config = {
        ssid: document.getElementById("wifiSsid").value,
        password: document.getElementById("wifiPassword").value,
        relay_uri: document.getElementById("relayUri").value,
        private_key: document.getElementById("hexPrivateKey").value,
        public_key: document.getElementById("hexPublicKey").value
    };

    const jsonData = JSON.stringify(config);
    console.log(jsonData);

    try {
        await writer.write(new TextEncoder().encode(jsonData + "\n"));
        document.getElementById("status").innerText = "Configuration updated successfully!";
    } catch (error) {
        console.error("Error sending configuration:", error);
        document.getElementById("status").innerText = "Error sending configuration. Try refreshing the page and connecting again.";
    }
}

async function loadConfig() {
    console.log("Loading configuration...");
    if (!reader) {
        document.getElementById("status").innerText = "Device not connected. Try refreshing the page and connecting again.";
        return;
    }

    try {
        console.log("Sending command to request configuration...");
        await writer.write(new TextEncoder().encode("get_config\n"));

        // Read response until we get a complete JSON string
        let jsonStr = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            jsonStr += new TextDecoder().decode(value);

            // Try to parse the accumulated string as JSON
            if (isValidJson(jsonStr)) {
                const config = JSON.parse(jsonStr);
                console.log("Configuration received:", config);
                // Populate form fields
                document.getElementById("wifiSsid").value = config.ssid || '';
                document.getElementById("wifiPassword").value = config.password || '';
                document.getElementById("relayUri").value = config.relay_uri || '';
                const pk = new Uint8Array(config.private_key.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                const nsec = NostrTools.nip19.nsecEncode(pk);
                document.getElementById("nsec").value = nsec || '';
                document.getElementById("hexPrivateKey").value = config.private_key || '';

                // derive the public key
                const pubkey = NostrTools.getPublicKey(pk);
                document.getElementById("hexPublicKey").value = pubkey;
                // and the npub
                const npub = NostrTools.nip19.npubEncode(pubkey);
                document.getElementById("npub").value = npub || '';

                document.getElementById("status").innerText = "Configuration loaded.";
                break;
            }
        }
    } catch (error) {
        console.error("Error loading configuration:", error);
        document.getElementById("status").innerText = "Error loading configuration. Try refreshing the page and connecting again.";
    }
}

function isValidJson(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

// Replace the updateHexPrivateKey function with this new one
async function updateDerivedKeys(nsec) {
    try {
        if (!nsec.startsWith('nsec')) {
            document.getElementById('hexPrivateKey').value = '';
            document.getElementById('npub').value = '';
            document.getElementById('hexPublicKey').value = '';
            return;
        }

        const { type, data } = NostrTools.nip19.decode(nsec);
        console.log(type, data);
        if (type === 'nsec') {
            // Update hex private key
            const hexPrivateKey = bytesToHex(data);
            document.getElementById('hexPrivateKey').value = hexPrivateKey;

            // Derive public key and npub
            const pubkey = NostrTools.getPublicKey(hexPrivateKey);
            const npub = NostrTools.nip19.npubEncode(pubkey);

            document.getElementById('npub').value = npub;
            document.getElementById('hexPublicKey').value = pubkey;
        } else {
            document.getElementById('hexPrivateKey').value = '';
            document.getElementById('npub').value = '';
            document.getElementById('hexPublicKey').value = '';
        }
    } catch (error) {
        document.getElementById('hexPrivateKey').value = '';
        document.getElementById('npub').value = '';
        document.getElementById('hexPublicKey').value = '';
        console.error('Error converting nsec to hex:', error);
    }
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(inputId + 'ToggleIcon');

    if (input.type === 'password') {
        input.type = 'text';
        icon.setAttribute('d', 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21');
    } else {
        input.type = 'password';
        icon.setAttribute('d', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z');
    }
}

async function resetConfiguration() {
    if (!writer) {
        document.getElementById("status").innerText = "Device not connected. Try refreshing the page and connecting again.";
        return;
    }

    const confirmed = await showConfirmationModal(
        "WARNING",
        "This will erase all configuration data from your device. Are you sure you want to continue?"
    );

    if (!confirmed) return;

    try {
        await writer.write(new TextEncoder().encode("reset_config\n"));
        document.getElementById("status").innerText = "Configuration reset successfully!";

        // Clear all form fields
        document.getElementById("wifiSsid").value = '';
        document.getElementById("wifiPassword").value = '';
        document.getElementById("relayUri").value = '';
        document.getElementById("nsec").value = '';
        document.getElementById("hexPrivateKey").value = '';
        document.getElementById("npub").value = '';
        document.getElementById("hexPublicKey").value = '';

        showAlertModal("Configuration has been successfully reset!");
    } catch (error) {
        console.error("Error resetting configuration:", error);
        document.getElementById("status").innerText = "Error resetting configuration. Try refreshing the page and connecting again.";
    }
}

// Make NostrTools available globally
window.NostrTools = NostrTools; 