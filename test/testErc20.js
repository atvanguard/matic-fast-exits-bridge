const assert = require('assert');
const Web3 = require('web3')
const config = require('config')
const HDWalletProvider = require("@truffle/hdwallet-provider");

let web3, childWeb3
const gas = 1000000

describe('Bridge', function() {
  let accounts, alice

  beforeEach(async function() {
    web3 = new Web3(new HDWalletProvider(process.env.MNEMONIC, process.env.MAIN_RPC));
    childWeb3 = new Web3(process.env.MATIC_RPC);
    accounts = await web3.eth.getAccounts()
    alice = web3.utils.toChecksumAddress(accounts[1])
  })

  it('Withdraw ERC20', async function() {
    const abi = JSON.parse(JSON.stringify(config.get('contracts.erc20abi')))
    const token = config.get('contracts.tokens')[0]
    const rootContract = new web3.eth.Contract(abi, token.root)
    const childContract = new childWeb3.eth.Contract(abi, token.child)
    const amount = web3.utils.toWei('2')
    await childContract.methods.mint(amount).send({ from: alice, gas })

    // to be able to send funds
    await rootContract.methods.mint(web3.utils.toWei('10')).send({ from: accounts[0], gas })

    const aliceInitialBalance = web3.utils.toBN(await rootContract.methods.balanceOf(alice).call())
    const aliceInitialBalanceOnChild = web3.utils.toBN(await childContract.methods.balanceOf(alice).call())

    await childContract.methods.transfer(accounts[0], amount).send({ from: alice, gas })
    await sleep(config.get('pollSeconds') * 2 * 1000); // Wait for the bridge to give on main

    const aliceNowBalance = web3.utils.toBN(await rootContract.methods.balanceOf(alice).call())
    assert.ok(aliceNowBalance.eq(aliceInitialBalance.add(web3.utils.toBN(amount))))
    const aliceNowBalanceOnChild = web3.utils.toBN(await childContract.methods.balanceOf(alice).call())
    assert.ok(aliceNowBalanceOnChild.eq(aliceInitialBalanceOnChild.sub(web3.utils.toBN(amount))))
  });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
