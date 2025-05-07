'use strict';

import {handleError, showMessage, state, updateBalancesUI, isValidAddress, getInputValue} from './common.js';
import {getAdminPassword, getRegisteredRoles, getTicketHolders, initConfig, registerRole} from './config.js';

const handlers = {
    checkBalanceButton: checkBalances,
    verifyTicketButton: verifyTicketHolder,
    checkVenueStatsButton: displayVenueStats,
    registerRoleButton: registerNewRole
};

async function handleRoleChange(selectedRole) {
    if (selectedRole === 'Admin' && !(await verifyAdminPassword())) {
        handleError("Invalid Admin password.");
        resetToAttendeeRole();
    } else if (['Venue Manager', 'Doorman'].includes(selectedRole) && !(await verifyRoleRegistration(selectedRole))) {
        resetToAttendeeRole();
    } else {
        applyRoleSelection(selectedRole);
        if (selectedRole === 'Attendee') showMessage("✅ Attendee access granted.");
    }
}

async function verifyRoleRegistration(roleType) {
    if (!state.account) return handleError("Please connect your wallet first."), false;

    const roles = await getRegisteredRoles();
    const isRegistered = roles.some(role => role.type === roleType && role.address.toLowerCase() === state.account.toLowerCase());
    if (!isRegistered) handleError(`Your wallet is not registered as a ${roleType}.`);
    return isRegistered;
}

async function verifyAdminPassword() {
    const password = prompt("Please enter the Admin password:");
    if (!password) return false;

    try {
        await initConfig();
        return password === getAdminPassword();
    } catch {
        handleError("❌ Unable to verify Admin password. Please try again.");
        return false;
    }
}

async function displayVenueStats() {
    const {account, contract, web3} = state;
    if (!account || !contract) return handleError("Please connect your wallet first.");

    const roles = await getRegisteredRoles();
    if (!roles.some(role => role.address.toLowerCase() === account.toLowerCase())) {
        return handleError("You are not authorized to view ticket distribution.");
    }

    try {
        const holders = await getTicketHolders(contract);
        const statsDiv = document.getElementById('venueStats');
        statsDiv.innerHTML = holders.map(({address, tickets}) => {
            const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
            const ticketsInTKT = web3.utils.fromWei(tickets, 'ether');
            return `<li>
                            <span class="address-container" data-full-address="${address}">
                                ${shortAddress} <span class="hover-instruction">(Click to copy full address)</span>
                                <span class="copy-tooltip">Copied!</span>
                            </span> ${ticketsInTKT} TKT
                        </li>`;
        }).join('');
        setupAddressCopy(statsDiv);
    } catch {
        handleError("Error fetching venue stats.");
    }
}

export function setupBalanceChecking() {
    Object.keys(handlers).forEach(id => setupButton(id, handlers[id]));
}

export function setupRoleSelection() {
    document.querySelectorAll('input[name="userRole"]').forEach(input => {
        input.addEventListener('change', () => handleRoleChange(input.value));
    });
}

export function checkBalances() {
    const {account, contract, web3} = state;
    if (!account || !contract || !web3) return handleError("Please connect your wallet first.");

    const throbber = document.getElementById('loadingThrobber');
    Promise.all([contract.methods.balanceOf(account).call(), web3.eth.getBalance(account)])
        .then(([ticketBal, ethBal]) => {
            updateBalancesUI(ticketBal, ethBal);
            showMessage("✅ Balances updated!");
        })
        .catch(() => handleError("Error fetching balances."))
        .finally(() => throbber && (throbber.style.display = 'none'));
}

function toggleRoleSection(role) {
    document.querySelectorAll('.role-section').forEach(section => section.style.display = 'none');
    document.getElementById(`${role}Section`).style.display = 'block';
}

function verifyTicketHolder() {
    if (!state.contract) return handleError("Please connect your wallet first.");

    const address = getInputValue('verifyAddress');
    if (!address) return handleError("Please enter a wallet address.");

    state.contract.methods.balanceOf(address).call()
        .then(balance => {
            document.getElementById('verificationResult').innerText = balance > 0 ? "✅ Valid ticket holder!" : "❌ No tickets found.";
        })
        .catch(() => handleError("Error verifying ticket holder."));
}

function registerNewRole() {
    const roleType = getInputValue('roleType');
    const roleName = getInputValue('roleName');
    const roleAddress = getInputValue('roleAddress');

    if (!roleType || !roleName || !roleAddress) return handleError("Please fill in all fields.");
    if (!state.account) return handleError("Please connect your wallet first.");

    getRegisteredRoles().then(roles => {
        if (roles.some(role => role.name === roleName || role.address === roleAddress)) {
            return handleError("Name or address already registered. Please use different values.");
        }

        if (!isValidAddress(roleAddress)) {
            return handleError("Invalid wallet address or Web3 Initialization Error.");
        }

        registerRole(roleType, roleName, roleAddress)
            .then(() => {
                showMessage(`✅ ${roleType} registered successfully!`);
                displayRegisteredRoles();
            })
            .catch(() => handleError("Error registering role."));
    });
}

function applyRoleSelection(role) {
    state.userRole = role;
    toggleRoleSection(role);
    showMessage(`✅ ${role} access granted.`);
}

function resetToAttendeeRole() {
    document.querySelector('input[value="Attendee"]').checked = true;
    applyRoleSelection('Attendee');
}

function displayRegisteredRoles() {
    getRegisteredRoles().then(roles => {
        const rolesDiv = document.getElementById('registeredRoles');
        rolesDiv.innerHTML = roles.map(({name, address, type}) => `<p>${name} (${type}): ${address}</p>`).join('');
    });
}

function setupButton(buttonId, handler) {
    document.getElementById(buttonId)?.addEventListener('click', handler);
}

function setupAddressCopy(container) {
    container.querySelectorAll('.address-container').forEach(element => {
        element.addEventListener('click', async () => {
            try {
                const fullAddress = element.dataset.fullAddress;
                await navigator.clipboard.writeText(fullAddress);
                const tooltip = element.querySelector('.copy-tooltip');
                tooltip.classList.add('show-tooltip');
                setTimeout(() => tooltip.classList.remove('show-tooltip'), 2000);
                showMessage("✅ Full address copied to clipboard!");
            } catch {
                handleError("Failed to copy address.");
            }
        });
    });
}