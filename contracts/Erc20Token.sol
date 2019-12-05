pragma solidity 0.5.12;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Erc20Token is ERC20 {
  function mint(uint256 amount) public {
    _mint(msg.sender, amount);
  }
}
