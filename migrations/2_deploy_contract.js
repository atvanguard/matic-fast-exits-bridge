const erc20 = artifacts.require('Erc20Token')
const ChainbreakersPetsERC721 = artifacts.require('ChainbreakersPetsERC721')
const ChildERC721Mintable = artifacts.require('ChildERC721Mintable')

module.exports = async function(deployer) {
  const contracts = { tokens: {} }

  // Incento
  await deployer.deploy(erc20);
  contracts.tokens.incento = {
    root: erc20.address,
  }
  await deployer.deploy(erc20);
  contracts.tokens.incento.child = erc20.address

  // ChainBreakers
  await deployer.deploy(ChainbreakersPetsERC721, 'Pets', 'PTS');
  await deployer.deploy(ChildERC721Mintable, ChainbreakersPetsERC721.address);
  contracts.tokens.chainbreakers = {
    root: ChainbreakersPetsERC721.address,
    child: ChildERC721Mintable.address
  }

  console.log(JSON.stringify(contracts, null, 2))
};
