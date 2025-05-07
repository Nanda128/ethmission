'use strict';

export const state = {
    web3: null, account: null, contract: null, connectionType: null, uploadedWallet: null, newWallet: null
};

export function showMessage(msg, isError = false) {
    const output = document.getElementById("output");
    if (!output) return;

    output.innerText = msg;
    output.style.backgroundColor = isError ? '#ffcccc' : '#ccffcc';
    output.style.display = 'block';
    setTimeout(() => output.style.display = 'none', 10000);
}

export function handleError(message, error = null) {
    console.error(message, error);
    showMessage(error ? `❌ ${message}: ${error.message}` : `❌ ${message}`, true);
}

export function updateWalletUI(address) {
    const walletAddress = document.getElementById("walletAddress");
    if (walletAddress) {
        walletAddress.innerText = `🔗 Connected: ${shortenAddress(address)}`;
        walletAddress.style.display = 'block';
    }

    document.querySelectorAll('.wallet-connection-options').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.wallet-connected-message').forEach(el => el.style.display = 'block');
}

export function shortenAddress(address) {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
}

export function updateBalancesUI(ticketBal, ethBal) {
    const balances = document.getElementById("balances");
    if (!balances || !state.web3) return;

    balances.innerHTML = `
                <p>🎫 Ticket Tokens: ${state.web3.utils.fromWei(ticketBal, 'ether')}</p>
                <p>💰 ETH: ${state.web3.utils.fromWei(ethBal, 'ether')} ETH</p>
            `;
    balances.style.display = 'block';
}

export function signAndSendTransaction(data, options) {
    if (!state.web3 || !state.account || !state.contract) {
        return handleError("Wallet not connected.");
    }

    const tx = {...options, to: state.contract.options.address, gas: 200000, data};
    const privateKey = state.web3.eth.accounts.wallet[state.account].privateKey;

    state.web3.eth.accounts.signTransaction(tx, privateKey)
        .then(signed => state.web3.eth.sendSignedTransaction(signed.rawTransaction)
            .on('receipt', () => showMessage("✅ Transaction successful!"))
            .on('error', err => handleError("Error sending transaction", err)))
        .catch(err => handleError("Error signing transaction", err));
}

export function isValidAddress(address) {
    return state.web3.utils.isAddress(address);
}

export function getInputValue(id) {
    return document.getElementById(id)?.value || null;
}
