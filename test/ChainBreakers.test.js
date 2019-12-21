const assert = require('assert');
const Web3 = require('web3')
const config = require('config')
const crypto = require('crypto')
const HDWalletProvider = require("@truffle/hdwallet-provider");

let web3, childWeb3
const gas = 2000000

describe('Bridge', function() {
  let accounts, alice

  beforeEach(async function() {
    web3 = new Web3(new HDWalletProvider(process.env.MNEMONIC, process.env.MAIN_RPC));
    childWeb3 = new Web3(process.env.MATIC_RPC);
    accounts = await web3.eth.getAccounts()
    alice = web3.utils.toChecksumAddress(accounts[0])
    bob = web3.utils.toChecksumAddress(accounts[1])
  })

  it('Withdraw ERC721', async function() {
    const token = config.get('contracts.tokens.chainbreakers')
    const rootContract = new web3.eth.Contract(require('../build/contracts/ChainbreakersPetsERC721.json').abi, token.root)
    const childContract = new childWeb3.eth.Contract(require('../build/contracts/ChildERC721Mintable.json').abi, token.child)
    const tokenId = `0x${crypto.randomBytes(32).toString('hex')}`
    const uri = `tokens.com/${tokenId}`
    assert.ok(await childContract.methods.isMinter(alice).call())
    await childContract.methods.mintWithTokenURI(bob, tokenId, uri).send({ from: alice, gas })
    await sleep(config.get('pollSeconds') * 2 * 1000); // Wait for the bridge to map token uri
    await childContract.methods.withdraw(tokenId).send({ from: bob, gas })
    await sleep(config.get('pollSeconds') * 2 * 1000); // Wait for the bridge to give on main
    assert.equal(await rootContract.methods.ownerOf(tokenId).call(), bob)
    assert.equal(await rootContract.methods.tokenURI(tokenId).call(), uri)
  });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
