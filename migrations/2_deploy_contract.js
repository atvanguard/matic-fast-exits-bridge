const erc20 = artifacts.require('Erc20Token')

module.exports = async function(deployer) {
  const contracts = { tokens: [] }

  await deployer.deploy(erc20);
  contracts.tokens.push({
    root: erc20.address,
    isErc20: true
  })
  await deployer.deploy(erc20);
  contracts.tokens[0].child = erc20.address

  console.log(JSON.stringify(contracts, null, 2))
};
