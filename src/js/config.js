'use strict';

export const CONTRACT_ABI_URL = '../../contracts/TicketTokenABI.json';
export const CONFIG_URL = '../config.json';
export const TICKET_PRICE = "0.01";

let config = null;
let ABI = null;
let roles = [];

export async function initConfig() {
    try {
        const [configResponse, abiResponse] = await Promise.all([fetch(CONFIG_URL).then(res => res.json()), fetch(CONTRACT_ABI_URL).then(res => res.json())]);
        config = configResponse;
        ABI = abiResponse;
        return {config, ABI};
    } catch (error) {
        console.error("Failed to load configuration:", error);
        throw error;
    }
}

export async function registerRole(type, name, address) {
    roles.push({type, name, address});
    return Promise.resolve();
}

export async function getRegisteredRoles() {
    return Promise.resolve(roles);
}

export async function getTicketHolders(contract) {
    try {
        const result = await contract.methods.getTicketHolders().call();
        const addresses = result[0];
        const tickets = result[1];
        return addresses.map((address, index) => ({ address, tickets: tickets[index] }));
    } catch (error) {
        console.error("Failed to fetch ticket holders:", error);
        throw error;
    }
}

export const getVendorAccess = () => config?.vendor?.address;

export const getProviderUrl = () => config?.provider?.url;

export const getDoormanPassword = () => config?.doorman?.password;

export const displayVendorAddress = () => {
    document.getElementById('vendorAddress').textContent = getVendorAccess();
};

initConfig().catch(console.error);
