'use strict';

import {state, showMessage, signAndSendTransaction, handleError} from './common.js';
import {TICKET_PRICE, displayVendorAddress, getVendorAccess} from './config.js';
import {checkBalances} from './balance.js';

export function setupTicketPurchase() {
    const button = document.getElementById('buyTicketButton');
    button?.addEventListener('click', buyTicket);
}

export function setupTicketTransfer() {
    document.getElementById('transferAmountButton')?.addEventListener('click', transferTicket);
    document.getElementById('returnToVendorButton')?.addEventListener('click', returnTicketToVendor);
    displayVendorAddress();
}

export function buyTicket() {
    if (!isWalletConnected()) return;

    const throbber = document.getElementById('loadingThrobber');
    if (throbber) throbber.style.display = 'block';

    const method = state.contract.methods.buyTicket();
    const options = {from: state.account, value: toWei(TICKET_PRICE)};

    sendTransaction(method, options, "Ticket purchased!", "Error buying ticket.");
}

export function transferTicket() {
    if (!isWalletConnected()) return;

    const to = getInputValue("transferTo");
    const amount = getInputValue("transferAmount");
    if (!to || !amount) return handleError("Please enter recipient address and amount.");

    const amountInWei = toWei(amount);
    const method = state.contract.methods.transfer(to, amountInWei);
    sendTransaction(method, {from: state.account}, `Transferred ${amount} ticket(s) to ${to}`, "Error transferring ticket.");
}

export function returnTicketToVendor() {
    if (!isWalletConnected()) return;

    state.contract.methods.balanceOf(state.account).call()
        .then(balance => {
            const ticketBalance = fromWei(balance);
            if (ticketBalance <= 0) return handleError("You don't have any tickets to return.");

            if (confirm(`Return all ${ticketBalance} tickets to vendor?`)) {
                const method = state.contract.methods.transfer(getVendorAccess, balance);
                sendTransaction(method, {from: state.account}, `Returned ${ticketBalance} ticket(s) to vendor`, "Error returning tickets.");
            }
        })
        .catch(() => handleError("Error checking your ticket balance."));
}

function isWalletConnected() {
    if (!state.account || !state.contract || !state.web3) {
        handleError("Please connect your wallet first.");
        return false;
    }
    return true;
}

function sendTransaction(method, options, successMessage, errorMessage) {
    if (state.connectionType === 'metamask') {
        method.send(options)
            .then(() => {
                showMessage(`✅ ${successMessage}`);
                checkBalances();
            })
            .catch(() => {
                handleError(errorMessage);
                const throbber = document.getElementById('loadingThrobber');
                if (throbber) throbber.style.display = 'none';
            });
    } else {
        signAndSendTransaction(method.encodeABI(), options);
    }
}

function toWei(value) {
    return state.web3.utils.toWei(value, 'ether');
}

function fromWei(value) {
    return state.web3.utils.fromWei(value, 'ether');
}

function getInputValue(id) {
    return document.getElementById(id)?.value;
}
