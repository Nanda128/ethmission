'use strict';

import {state, showMessage, updateBalancesUI} from './common.js';

export function setupBalanceChecking() {
    document.getElementById('checkBalanceButton')?.addEventListener('click', checkBalances);
}

export function checkBalances() {
    const {account, contract, web3} = state;

    if (!account || !contract || !web3) {
        return showMessage("❌ Please connect your wallet first.");
    }

    Promise.all([contract.methods.balanceOf(account).call(), web3.eth.getBalance(account)])
        .then(([ticketBal, ethBal]) => {
            updateBalancesUI(ticketBal, ethBal);
            showMessage("✅ Balances updated!");
        })
        .catch(error => {
            console.error("Error fetching balances:", error);
            showMessage("❌ Error fetching balances. Please try again.");
        });
}