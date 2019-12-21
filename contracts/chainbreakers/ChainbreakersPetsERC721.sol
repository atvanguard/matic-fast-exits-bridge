pragma solidity 0.5.12;

import { ERC721Full } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import { ERC721Metadata } from "openzeppelin-solidity/contracts/token/ERC721/ERC721Metadata.sol";

contract ChainbreakersPetsERC721 is ERC721Full {
  constructor (string memory name, string memory symbol) public ERC721Full(name, symbol) {}

  /**
    * @dev Function to mint tokens.
    * @param to The address that will receive the minted tokens.
    * @param tokenId The token id to mint.
    * @param tokenURI The token URI of the minted token.
    * @return A boolean that indicates if the operation was successful.
    */
  function mintWithTokenURI(address to, uint256 tokenId, string memory tokenURI) public /* onlyModerators */ returns (bool) {
      _mint(to, tokenId);
      _setTokenURI(tokenId, tokenURI);
      return true;
  }
}
