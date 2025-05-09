'use strict';

import {getInputValue, handleError, showMessage, signAndSendTransaction, state} from './common.js';
import {displayVendorAddress, TICKET_PRICE} from './config.js';
import {checkBalances} from './balance.js';

function updatePrice() {
    const quantity = parseInt(document.getElementById('ticketQuantity')?.value) || 1;
    document.getElementById('totalPrice').textContent = (quantity * TICKET_PRICE).toFixed(2);
}

export function setupTicketPurchase() {
    const button = document.getElementById('buyTicketButton');
    button?.addEventListener('click', buyTicket);

    const quantityInput = document.getElementById('ticketQuantity');
    if (quantityInput) {
        quantityInput.addEventListener('change', updatePrice);
        quantityInput.addEventListener('input', updatePrice);

        updatePrice();
    }
}

export function setupTicketTransfer() {
    document.getElementById('transferAmountButton')?.addEventListener('click', transferTicket);
    document.getElementById('refundTicketsButton')?.addEventListener('click', refundTickets);
    displayVendorAddress();
}

export function buyTicket() {
    if (!isWalletConnected()) return;

    const throbber = document.getElementById('loadingThrobber');
    if (throbber) throbber.style.display = 'block';

    const quantity = parseInt(document.getElementById('ticketQuantity')?.value) || 1;
    const totalPrice = (TICKET_PRICE * quantity).toFixed(2);

    const method = state.contract.methods.buyTicket();
    const options = {from: state.account, value: toWei(totalPrice.toString())};

    sendTransaction(method, options, `${quantity} ticket${quantity > 1 ? 's' : ''} purchased!`, "Error buying ticket(s).");
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

export function refundTickets() {
    if (!isWalletConnected()) return;

    const amountToRefund = getInputValue("refundAmount");
    if (!amountToRefund) return handleError("Please enter the number of tickets to refund.");

    state.contract.methods.balanceOf(state.account).call()
        .then(balance => {
            const ticketBalance = fromWei(balance);
            if (ticketBalance <= 0) return handleError("You don't have any tickets to refund.");
            if (parseInt(amountToRefund) <= 0) return handleError("Please enter a valid amount.");

            if (confirm(`Send ${amountToRefund} ticket(s) to the vendor for 0.01 ETH?`)) {
                const method = state.contract.methods.refundTickets(amountToRefund);
                sendTransaction(method, {from: state.account}, `Transferred ${amountToRefund} ticket(s) to be burned`, "Error burning tickets.");
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
