// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TicketToken is ERC20 {
    address public owner;
    uint public ticketPrice = 0.01 ether;

    mapping(address => bool) private holders;
    address[] private holderList;

    constructor() ERC20("TicketToken", "TKT") {
        owner = msg.sender;
    }

    function buyTicket() public payable {
        uint ticketsToBuy = msg.value / ticketPrice;
        require(ticketsToBuy > 0, "Insufficient ETH sent");
        
        if (!holders[msg.sender]) {
            holders[msg.sender] = true;
            holderList.push(msg.sender);
        }
        
        _mint(msg.sender, ticketsToBuy * 10 ** decimals());
        
        uint excess = msg.value % ticketPrice;
        if (excess > 0) {
            payable(msg.sender).transfer(excess);
        }
    }

    function refundTickets(uint amount) public {
        uint balance = balanceOf(msg.sender);
        require(balance >= amount * 10 ** decimals(), "Insufficient tickets to refund");
        
        _burn(msg.sender, amount * 10 ** decimals());
        
        if (balanceOf(msg.sender) == 0) {
            holders[msg.sender] = false;
        }
        
        payable(msg.sender).transfer(amount * ticketPrice);
    }

    function getTicketHolders() public view returns (address[] memory, uint[] memory) {
        uint count = holderList.length;
        address[] memory addresses = new address[](count);
        uint[] memory balances = new uint[](count);

        for (uint i = 0; i < count; i++) {
            addresses[i] = holderList[i];
            balances[i] = balanceOf(holderList[i]);
        }

        return (addresses, balances);
    }

    function withdraw() public {
        require(msg.sender == owner, "Not owner");
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}