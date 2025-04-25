'use strict';

export const CONTRACT_ABI_URL = '../../contracts/TicketTokenABI.json';
export const CONFIG_URL = '../config.json';
export const TICKET_PRICE = "0.01";

let config = null;
let ABI = null;

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

export const getVendorAccess = () => config?.vendor?.address;

export const getProviderUrl = () => config?.provider?.url;

export const displayVendorAddress = () => {
    document.getElementById('vendorAddress').textContent = getVendorAccess();
};

initConfig().catch(console.error);