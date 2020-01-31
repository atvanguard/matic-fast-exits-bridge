const Web3 = require('web3')
const config = require('config')
const HDWalletProvider = require('@truffle/hdwallet-provider');
const bluebird = require('bluebird')

const childWeb3 = new Web3(new HDWalletProvider(process.env.MNEMONIC, process.env.MATIC_RPC))

async function execute() {
  const accounts = await childWeb3.eth.getAccounts()
  const token = config.get('contracts.tokens.chainbreakers')
  const childErc721 = new childWeb3.eth.Contract(require('../../build/contracts/ChildERC721Mintable.json').abi, token.child)
  try {
    let events = await childErc721.getPastEvents(
      'Transfer',
      { filter: { from: '0x0000000000000000000000000000000000000000' } },
      { fromBlock: 0, toBlock: 'latest' }
    )

    const tokenIds = events.map(event => event.raw.topics[3].toLowerCase())
    console.log(tokenIds, tokenIds.length)
    await bluebird.map(tokenIds, async tokenId => {
      const owner = await childErc721.methods.ownerOf(tokenId).call()
      await childWeb3.eth.sendTransaction({
        from: accounts[0],
        to: owner,
        value: childWeb3.utils.toWei('.01', 'ether')
      })
      console.log({ tokenId, owner })
    }, { concurrency: 3 })
  } catch(e) {
    console.log(e)
  }
}

execute()
