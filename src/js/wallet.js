'use strict';

import {state, showMessage, handleError, updateWalletUI} from './common.js';
import {initConfig, getProviderUrl} from './config.js';

export function setupWalletConnectors() {
    setupButton('connectMetamaskButton', async () => {
        try {
            const {config, ABI} = await initConfig();
            connectWithMetamask(config.contract.address, ABI);
        } catch (error) {
            handleError("Failed to initialize configuration", error);
        }
    });

    setupFileInput('walletFileInput', handleWalletFileUpload);

    setupButton('connectUploadedWalletButton', async () => {
        try {
            const {config, ABI} = await initConfig();
            await connectWithUploadedWallet(config.contract.address, ABI);
        } catch (error) {
            handleError("Failed to initialize configuration", error);
        }
    });
}

export function setupWalletCreation() {
    setupButton('createWalletButton', createWallet);
    setupButton('downloadWalletButton', downloadWallet);
}

export function connectWithMetamask(contractAddress, ABI) {
    if (!window.ethereum) return showMessage("❌ Please install MetaMask!");

    state.web3 = new Web3(window.ethereum);

    ethereum.request({method: 'eth_requestAccounts'})
        .then(() => state.web3.eth.getAccounts())
        .then(accounts => {
            state.account = accounts[0];
            state.connectionType = 'metamask';
            updateWalletUI(state.account);
            state.contract = new state.web3.eth.Contract(ABI, contractAddress);
            showMessage("✅ Connected with MetaMask!");
        })
        .catch(error => handleError("Error connecting with MetaMask", error));
}

export function handleWalletFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            state.uploadedWallet = JSON.parse(e.target.result);
            showUploadedWalletInfo();
        } catch (error) {
            handleError("Invalid wallet file", error);
            state.uploadedWallet = null;
        }
    };
    reader.readAsText(file);
}

function showUploadedWalletInfo() {
    toggleElement('uploadedWalletInfo', `📁 Wallet file loaded: ${state.uploadedWallet.address || '(Address encrypted)'}`);
    toggleElement('walletDecryptSection');
    showMessage("✅ Wallet file loaded. Enter password to decrypt.");
}

export async function connectWithUploadedWallet(contractAddress, ABI) {
    if (!state.uploadedWallet) return showMessage("❌ No wallet file uploaded.");

    const password = getInputValue('walletPassword');
    if (!password) return showMessage("❌ Please enter your wallet password.");

    try {
        const providerUrl = getProviderUrl();
        state.web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
        const decryptedWallet = await state.web3.eth.accounts.decrypt(state.uploadedWallet, password);
        state.web3.eth.accounts.wallet.add(decryptedWallet);
        state.account = decryptedWallet.address;
        state.connectionType = 'localwallet';
        updateWalletUI(state.account);
        state.contract = new state.web3.eth.Contract(ABI, contractAddress);
        showMessage("✅ Connected with uploaded wallet!");
    } catch (error) {
        handleError("Error decrypting wallet", error);
    }
}

export function createWallet() {
    try {
        const web3Instance = new Web3();
        state.newWallet = web3Instance.eth.accounts.create();
        showNewWalletInfo();
    } catch (error) {
        handleError("Error creating wallet", error);
    }
}

function showNewWalletInfo() {
    const walletInfo = document.getElementById("newWalletInfo");
    if (!walletInfo) return;

    walletInfo.innerHTML = `
                    ✅ New wallet created!<br>
                    Address: <span class="address-container">
                        ${state.newWallet.address}
                        <span class="hover-instruction">(Click to copy)</span>
                        <span class="copy-tooltip">Copied!</span>
                    </span><br>
                    Private Key: <span class="private-key-container">
                        <span class="private-key-hidden">***SENSITIVE—NEVER SHARE***</span>
                        <span class="private-key-reveal">${state.newWallet.privateKey}</span>
                        <span class="hover-instruction">(Hover to reveal, click to copy)</span>
                        <span class="copy-tooltip">Copied!</span>
                    </span><br>
                    Set a password below to download your wallet file
                `;

    setupPrivateKeyCopy(walletInfo.querySelector('.private-key-container'));
    setupAddressCopy(walletInfo.querySelector('.address-container'));
    toggleElement('walletPasswordSection');
    showMessage("✅ New wallet created! Set a password to download it.");
}

function setupPrivateKeyCopy(container) {
    if (!container) return;

    container.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(state.newWallet.privateKey);
            showTooltip(container, "✅ Private key copied to clipboard!");
        } catch (err) {
            showMessage("❌ Failed to copy: " + err);
        }
    });
}

function setupAddressCopy(container) {
    if (!container) return;

    container.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(state.newWallet.address);
            showTooltip(container, "✅ Address copied to clipboard!");
        } catch (err) {
            showMessage("❌ Failed to copy: " + err);
        }
    });
}

export function downloadWallet() {
    if (!state.newWallet) return showMessage("❌ No wallet created yet. Please create a wallet first.");

    const password = getInputValue("walletPasswordCreate");
    if (!password) return showMessage("❌ Please enter a password to encrypt your wallet.");

    try {
        const web3Instance = new Web3();
        web3Instance.eth.accounts.encrypt(state.newWallet.privateKey, password)
            .then(downloadKeystoreFile);
    } catch (error) {
        handleError("Error downloading wallet", error);
    }
}

function downloadKeystoreFile(keystore) {
    const blob = new Blob([JSON.stringify(keystore, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ethmission-wallet-${state.newWallet.address.substring(2, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage("✅ Wallet downloaded successfully! Keep it safe.");
}

function setupButton(id, callback) {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', callback);
}

function setupFileInput(id, callback) {
    const input = document.getElementById(id);
    if (input) input.addEventListener('change', callback);
}

function toggleElement(id, text = '') {
    const element = document.getElementById(id);
    if (element) {
        element.style.display = 'block';
        if (text) element.innerText = text;
    }
}

function getInputValue(id) {
    return document.getElementById(id)?.value || '';
}

function showTooltip(container, message) {
    const tooltip = container.querySelector('.copy-tooltip');
    if (tooltip) {
        tooltip.classList.add('show-tooltip');
        setTimeout(() => tooltip.classList.remove('show-tooltip'), 2000);
    }
    showMessage(message);
}
