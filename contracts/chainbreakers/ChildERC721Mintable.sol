pragma solidity 0.5.12;

import { ERC721MetadataMintable } from "openzeppelin-solidity/contracts/token/ERC721/ERC721MetadataMintable.sol";
import { ChildERC721 } from "matic-protocol/contracts/child/ChildERC721.sol";

contract ChildERC721Mintable is ChildERC721, ERC721MetadataMintable {
  constructor (address rootToken)
    ChildERC721(msg.sender, rootToken, "Mintable 721", "M721")
    public {}
}
