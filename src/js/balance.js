'use strict';

import {handleError, showMessage, state, updateBalancesUI} from './common.js';
import {getDoormanPassword, getRegisteredRoles, getTicketHolders, initConfig, registerRole} from './config.js';

const registeredNames = new Set();
const registeredAddresses = new Set();

export function setupBalanceChecking() {
    ['checkBalanceButton', 'verifyTicketButton', 'checkVenueStatsButton', 'registerRoleButton']
        .forEach(id => setupButton(id, handlers[id]));
}

export function setupRoleSelection() {
    document.querySelectorAll('input[name="userRole"]').forEach(input => {
        input.addEventListener('change', () => handleRoleChange(input.value));
    });
}

async function handleRoleChange(selectedRole) {
    if (selectedRole === 'doorman' && !(await verifyDoormanPassword())) {
        handleError("Invalid doorman password.");
        resetToAttendeeRole();
    } else {
        applyRoleSelection(selectedRole);
        if (selectedRole === 'doorman') showMessage("✅ Doorman access granted.");
    }
}

function applyRoleSelection(role) {
    state.userRole = role;
    toggleRoleSection(role);
}

function resetToAttendeeRole() {
    document.querySelector('input[value="attendee"]').checked = true;
    applyRoleSelection('attendee');
}

async function verifyDoormanPassword() {
    const password = prompt("Please enter the doorman password:");
    if (!password) return false;

    try {
        await initConfig();
        return password === getDoormanPassword();
    } catch {
        handleError("Unable to verify doorman password. Please try again.");
        return false;
    }
}

function toggleRoleSection(role) {
    document.querySelectorAll('.role-section').forEach(section => section.style.display = 'none');
    document.getElementById(`${role}Section`).style.display = 'block';
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

function verifyTicketHolder() {
    const address = getInputValue('verifyAddress');
    if (!address) return handleError("Please enter a wallet address.");

    state.contract.methods.balanceOf(address).call()
        .then(balance => {
            document.getElementById('verificationResult').innerText = balance > 0 ? "✅ Valid ticket holder!" : "❌ No tickets found.";
        })
        .catch(() => handleError("Error verifying ticket holder."));
}

async function displayVenueStats() {
    const {account, contract, web3} = state;
    if (!account || !contract) return handleError("Please connect your wallet first.");

    const roles = await getRegisteredRoles();
    const isAuthorized = roles.some(role => role.address.toLowerCase() === account.toLowerCase());

    if (!isAuthorized) {
        return handleError("You are not authorized to view ticket distribution.");
    }

    getTicketHolders(contract)
        .then(holders => {
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
        })
        .catch(() => handleError("Error fetching venue stats."));
}

function registerNewRole() {
    const [roleType, roleName, roleAddress] = ['roleType', 'roleName', 'roleAddress'].map(getInputValue);
    if (!roleType || !roleName || !roleAddress) return handleError("Please fill in all fields.");

    if (registeredNames.has(roleName)) {
        return handleError("Role name already exists. Please choose a different name.");
    }

    if (!web3.utils.isAddress(roleAddress)) {
        return handleError("Invalid wallet address. Please enter a valid address.");
    }

    if (registeredAddresses.has(roleAddress)) {
        return handleError("Address already registered. Please use a different address.");
    }

    registerRole(roleType, roleName, roleAddress)
        .then(() => {
            registeredNames.add(roleName);
            registeredAddresses.add(roleAddress);
            showMessage(`✅ ${roleType} registered successfully!`);
            displayRegisteredRoles();
        })
        .catch(() => handleError("Error registering role."));
}

function displayRegisteredRoles() {
    getRegisteredRoles()
        .then(roles => {
            const rolesDiv = document.getElementById('registeredRoles');
            rolesDiv.innerHTML = roles.map(({type, name, address}) => `<p>${type}: ${name} (${address})</p>`).join('');
        })
        .catch(() => handleError("Error fetching registered roles."));
}

function setupButton(buttonId, handler) {
    document.getElementById(buttonId)?.addEventListener('click', handler);
}

function getInputValue(inputId) {
    return document.getElementById(inputId)?.value;
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

const handlers = {
    checkBalanceButton: checkBalances,
    verifyTicketButton: verifyTicketHolder,
    checkVenueStatsButton: displayVenueStats,
    registerRoleButton: registerNewRole
};